/* gpu_scissor.c — does the buffer-age scissor pay on this GPU? (docs/GPU.md, "The buffer-age scissor").
 * A test tool, never installed.
 *
 * The 0.8.7 decision kept the scissor off: on the Pi 5's V3D it cost more than it saved (a scissor
 * still loads the tiles it touches), and the correctness runs (build/engine-test, 7,567 frames) were
 * followed by a scratch driver on llvmpipe only — `gpu_frame_ex` itself has never run with it on a
 * real desktop GPU. This tool answers the performance question the same way gpu_contention.c asks
 * its question: the frame's shape on a render node, no display, GPU time from the native fence.
 *
 * The frame is the GPU path's own: a persistent 1920 × 1080 scene texture whose changed rectangle is
 * TexSubImage'd every frame (uploads are damage-scoped on the GPU path too), then composed into one
 * of three FBOs standing in for the GBM chain. FULL composes everything (clear + whole draw);
 * SCISSOR composes only the buffer-age region — this frame's damage joined with the previous age − 1
 * frames' (gsc_region, the very code gpu_frame_ex runs) — with the scissor and no clear. The two
 * modes upload exactly the same pixels: only the drawn region differs, which is the thing measured.
 *
 *   build/gpu-scissor [--node /dev/dri/renderD128] [--frames 240] [--load spin|read|none] [--cores n] [--verify]
 *
 * --verify answers the correctness half on the real driver (GPU.md's gap: "not checked ... no GPU
 * has"): every 20th frame the region is composed scissored and read back, then the same frame is
 * composed whole into another FBO and the region compared — 0 differing pixels expected, since the
 * engine-test proves the gsc logic and this checks the GL side (scissor + partial draw, no clear).
 *
 * One JSON line per phase. `dmg%` is the moving rectangle's share of the screen; `region%` the
 * buffer-age region actually drawn. A last line carries the renderer and the verdict: whether the
 * scissor's GPU time wins, and by how much, alone and under load. Ambient load is not controlled —
 * run it on a quiet machine for published numbers (docs/BENCHMARK.md's conditions).
 */
#include "../src/gpu/gscissor.h"

#include <EGL/egl.h>
#include <EGL/eglext.h>
#include <GLES2/gl2.h>
#include <fcntl.h>
#include <gbm.h>
#include <stdatomic.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/syscall.h>
#include <time.h>
#include <unistd.h>
#include <linux/sync_file.h>
#include <poll.h>
#include <pthread.h>

#define FW 1920
#define FH 1080
#define CHAIN 3                     /* the GBM surface's buffers */
#define MAX_WORKERS 64

static uint64_t now_ns(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return (uint64_t)t.tv_sec * 1000000000ull + (uint64_t)t.tv_nsec;
}

/* ---- the load: the same workers gpu_contention.c uses, spinners or readers ---- */

typedef struct { pthread_t th; int kind; } Worker;
static atomic_int stop_workers;
static volatile uint64_t sink;
#define WORK_BYTES (64u << 20)

static void *worker(void *arg) {
    int kind = (int)(intptr_t)arg;
    uint8_t *buf = kind == 1 ? malloc(WORK_BYTES) : NULL;
    if (buf) memset(buf, 1, WORK_BYTES);
    uint64_t x = 88172645463325252ull;
    while (!atomic_load_explicit(&stop_workers, memory_order_relaxed)) {
        if (!kind) for (int i = 0; i < 100000; i++) { x ^= x << 13; x ^= x >> 7; x ^= x << 17; }
        else if (buf) for (size_t i = 0; i + 64 <= WORK_BYTES; i += 64) x += buf[i];
    }
    sink += x;
    free(buf);
    return NULL;
}

/* ---- the GPU ---- */

static struct {
    EGLDisplay dpy;
    GLuint prog, tex, fbo[CHAIN];
    GLint u_tex;
    uint32_t *px;
    PFNEGLCREATESYNCKHRPROC create_sync;
    PFNEGLDESTROYSYNCKHRPROC destroy_sync;
    PFNEGLDUPNATIVEFENCEFDANDROIDPROC dup_fence;
    int fence;
} G;

static GLuint shader(GLenum kind, const char *src) {
    GLuint s = glCreateShader(kind);
    glShaderSource(s, 1, &src, NULL);
    glCompileShader(s);
    return s;
}

static int gl_setup(const char *node) {
    int fd = open(node, O_RDWR | O_CLOEXEC);
    if (fd < 0) { perror(node); return -1; }
    struct gbm_device *gbm = gbm_create_device(fd);
    PFNEGLGETPLATFORMDISPLAYEXTPROC get = (PFNEGLGETPLATFORMDISPLAYEXTPROC)eglGetProcAddress("eglGetPlatformDisplayEXT");
    if (!gbm || !get) { fprintf(stderr, "no GBM or EGL display\n"); return -1; }
    G.dpy = get(EGL_PLATFORM_GBM_KHR, gbm, NULL);
    EGLint maj, min, n = 0;
    if (G.dpy == EGL_NO_DISPLAY || !eglInitialize(G.dpy, &maj, &min)) { fprintf(stderr, "EGL did not start\n"); return -1; }
    eglBindAPI(EGL_OPENGL_ES_API);
    static const EGLint cattr[] = { EGL_RENDERABLE_TYPE, EGL_OPENGL_ES2_BIT, EGL_NONE }, xattr[] = { EGL_CONTEXT_CLIENT_VERSION, 2, EGL_NONE };
    EGLConfig cfg = NULL;
    eglChooseConfig(G.dpy, cattr, &cfg, 1, &n);
    EGLContext ctx = eglCreateContext(G.dpy, n ? cfg : EGL_NO_CONFIG_KHR, EGL_NO_CONTEXT, xattr);
    if (ctx == EGL_NO_CONTEXT || !eglMakeCurrent(G.dpy, EGL_NO_SURFACE, EGL_NO_SURFACE, ctx)) { fprintf(stderr, "no surfaceless GLES2 context\n"); return -1; }
    const char *ex = eglQueryString(G.dpy, EGL_EXTENSIONS);
    if (ex && strstr(ex, "EGL_ANDROID_native_fence_sync")) {
        G.create_sync = (PFNEGLCREATESYNCKHRPROC)eglGetProcAddress("eglCreateSyncKHR");
        G.destroy_sync = (PFNEGLDESTROYSYNCKHRPROC)eglGetProcAddress("eglDestroySyncKHR");
        G.dup_fence = (PFNEGLDUPNATIVEFENCEFDANDROIDPROC)eglGetProcAddress("eglDupNativeFenceFDANDROID");
        G.fence = G.create_sync && G.destroy_sync && G.dup_fence;
    }
    GLuint p = glCreateProgram();
    glAttachShader(p, shader(GL_VERTEX_SHADER, "attribute vec2 a; varying vec2 v; void main() { v = a * 0.5 + 0.5; gl_Position = vec4(a, 0, 1); }"));
    glAttachShader(p, shader(GL_FRAGMENT_SHADER, "precision mediump float; varying vec2 v; uniform sampler2D t; void main() { gl_FragColor = texture2D(t, v); }"));
    glBindAttribLocation(p, 0, "a");
    glLinkProgram(p);
    G.prog = p;
    G.u_tex = glGetUniformLocation(p, "t");
    G.px = malloc(FW * FH * 4);
    if (!G.px) return -1;
    for (int i = 0; i < FW * FH; i++) G.px[i] = 0xff000000u | (uint32_t)(i * 2654435761u >> 8);
    glGenTextures(1, &G.tex);
    glBindTexture(GL_TEXTURE_2D, G.tex);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, FW, FH, 0, GL_RGBA, GL_UNSIGNED_BYTE, G.px);
    glGenFramebuffers(CHAIN, G.fbo);
    GLuint t[CHAIN];
    glGenTextures(CHAIN, t);
    for (int i = 0; i < CHAIN; i++) {
        glBindTexture(GL_TEXTURE_2D, t[i]);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, FW, FH, 0, GL_RGBA, GL_UNSIGNED_BYTE, NULL);
        glBindFramebuffer(GL_FRAMEBUFFER, G.fbo[i]);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, t[i], 0);
    }
    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE) { fprintf(stderr, "framebuffer incomplete\n"); return -1; }
    glViewport(0, 0, FW, FH);
    fprintf(stderr, "gpu-scissor: %s, GPU time from %s\n", glGetString(GL_RENDERER), G.fence ? "the native fence" : "glFinish");
    return 0;
}

static uint64_t fence_done(int fd) {
    struct pollfd p = { .fd = fd, .events = POLLIN };
    if (poll(&p, 1, 2000) <= 0) return 0;
    struct sync_fence_info fi[4];
    struct sync_file_info info;
    memset(&info, 0, sizeof info);
    memset(fi, 0, sizeof fi);
    uint64_t t = 0;
    if (!ioctl(fd, SYNC_IOC_FILE_INFO, &info) && info.num_fences > 0 && info.num_fences <= 4) {
        info.sync_fence_info = (uint64_t)(uintptr_t)fi;
        if (!ioctl(fd, SYNC_IOC_FILE_INFO, &info))
            for (uint32_t i = 0; i < info.num_fences; i++) if (fi[i].timestamp_ns > t) t = fi[i].timestamp_ns;
    }
    return t;
}

/* the frame's change: a rectangle moving around the screen, its share of the pixels given */
static Rect damage(int f, double share) {
    int w = (int)(FW * share), h = (int)(FH * share);
    int x = (int)((0.5 + 0.45 * (f % 60) / 60.0) * (FW - w));
    int y = (int)((0.5 + 0.45 * ((f / 60) % 60) / 60.0) * (FH - h));
    return (Rect){ x, y, x + w, y + h };
}

/* one frame. full: clear + whole draw. scissor: the buffer-age region only. The upload (the
 * changed rectangle into the persistent texture) is the same in both. */
static double frame(int f, int full, double share) {
    static GpuScissor sc;
    static int back, ages;
    Rect cur = damage(f, share);
    uint64_t t0 = now_ns();
    glBindTexture(GL_TEXTURE_2D, G.tex);
    /* the changed pixels only, as upload_rect does on the GPU path */
    for (int y = cur.y0; y < cur.y1; y++)
        glTexSubImage2D(GL_TEXTURE_2D, 0, cur.x0, y, cur.x1 - cur.x0, 1, GL_RGBA, GL_UNSIGNED_BYTE, G.px + (size_t)y * FW + cur.x0);
    uint64_t t1 = now_ns();
    glBindFramebuffer(GL_FRAMEBUFFER, G.fbo[back]);
    static const GLfloat v[] = { -1, -1, 1, -1, -1, 1, 1, 1 };
    glUseProgram(G.prog);
    glUniform1i(G.u_tex, 0);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 0, v);
    glEnableVertexAttribArray(0);
    Rect reg = { 0, 0, FW, FH };
    if (!full) {
        /* the age the EGL chain would answer: how many swaps ago this buffer was last shown
         * (undefined on a buffer's first frame — the whole output, as gsc_region does) */
        int age = ages < CHAIN ? 0 : 1 + (ages % (CHAIN - 1));
        reg = gsc_region(&sc, age, cur, FW, FH);
        glScissor(reg.x0, FH - reg.y1, reg.x1 - reg.x0, reg.y1 - reg.y0);
        glEnable(GL_SCISSOR_TEST);
    } else {
        glDisable(GL_SCISSOR_TEST);
        glClear(GL_COLOR_BUFFER_BIT);
    }
    glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
    glDisable(GL_SCISSOR_TEST);
    uint64_t done, start = t1, t2 = t1;
    if (G.fence) {
        EGLSyncKHR s = G.create_sync(G.dpy, EGL_SYNC_NATIVE_FENCE_ANDROID, NULL);
        glFlush();
        t2 = now_ns();
        int fd = s != EGL_NO_SYNC_KHR ? G.dup_fence(G.dpy, s) : -1;
        if (s != EGL_NO_SYNC_KHR) G.destroy_sync(G.dpy, s);
        if (fd >= 0) { done = fence_done(fd); close(fd); }
        else done = 0;
    } else done = 0;
    if (done <= t2) { glFinish(); done = now_ns(); }
    gsc_push(&sc, full ? (Rect){ 0, 0, FW, FH } : cur);   /* gpu_frame_ex pushes what was drawn */
    back = (back + 1) % CHAIN;
    ages++;
    (void)t0;
    return (double)(done - start) / 1e6;
}

/* --verify: the scissored region must match the whole composition, pixel for pixel, on this driver */
static GLuint vread_fbo, vread_tex;
static uint32_t vbuf[FW * FH], vref[FW * FH];

static void compose_to(GLuint fbo, Rect reg, int full) {
    glBindFramebuffer(GL_FRAMEBUFFER, fbo);
    static const GLfloat v[] = { -1, -1, 1, -1, -1, 1, 1, 1 };
    glUseProgram(G.prog);
    glUniform1i(G.u_tex, 0);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 0, v);
    glEnableVertexAttribArray(0);
    if (full) { glDisable(GL_SCISSOR_TEST); glClear(GL_COLOR_BUFFER_BIT); }
    else { Rect c = gsc_clip(reg, FW, FH); glScissor(c.x0, FH - c.y1, c.x1 - c.x0, c.y1 - c.y0); glEnable(GL_SCISSOR_TEST); }
    glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
    glDisable(GL_SCISSOR_TEST);
}

static int verify_run(void) {
    glGenTextures(1, &vread_tex);
    glBindTexture(GL_TEXTURE_2D, vread_tex);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, FW, FH, 0, GL_RGBA, GL_UNSIGNED_BYTE, NULL);
    glGenFramebuffers(1, &vread_fbo);
    glBindFramebuffer(GL_FRAMEBUFFER, vread_fbo);
    glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, vread_tex, 0);
    static GpuScissor sc;
    long checked = 0, diffs = 0, worst = 0;
    for (int f = 0; f < 600; f++) {
        Rect cur = damage(f, 0.05 + 0.25 * (f % 7) / 7.0);
        for (int y = cur.y0; y < cur.y1; y++)      /* the texture moves on: every frame rewrites its box */
            for (int x = cur.x0; x < cur.x1; x++) G.px[(size_t)y * FW + x] = 0xff000000u | (uint32_t)(f * 97 + y * FW + x);
        glBindTexture(GL_TEXTURE_2D, G.tex);
        for (int y = cur.y0; y < cur.y1; y++)
            glTexSubImage2D(GL_TEXTURE_2D, 0, cur.x0, y, cur.x1 - cur.x0, 1, GL_RGBA, GL_UNSIGNED_BYTE, G.px + (size_t)y * FW + cur.x0);
        int age = f < CHAIN ? 0 : 1 + (f % (CHAIN - 1));
        Rect reg = gsc_region(&sc, age, cur, FW, FH);
        compose_to(G.fbo[0], reg, 0);               /* scissored, no clear: the back buffer keeps its past */
        compose_to(vread_fbo, reg, 1);              /* the same frame composed whole */
        glFinish();
        if (f % 20 == 19 && gsc_area(reg)) {        /* read back both, compare the region */
            Rect c = gsc_clip(reg, FW, FH);
            glBindFramebuffer(GL_FRAMEBUFFER, G.fbo[0]);
            glReadPixels(c.x0, FH - c.y1, c.x1 - c.x0, c.y1 - c.y0, GL_RGBA, GL_UNSIGNED_BYTE, vbuf);
            glBindFramebuffer(GL_FRAMEBUFFER, vread_fbo);
            glReadPixels(c.x0, FH - c.y1, c.x1 - c.x0, c.y1 - c.y0, GL_RGBA, GL_UNSIGNED_BYTE, vref);
            for (long i = 0; i < (long)(c.x1 - c.x0) * (c.y1 - c.y0); i++) {
                checked++;
                if (vbuf[i] != vref[i]) { diffs++; long d = __builtin_popcount(vbuf[i] ^ vref[i]); if (d > worst) worst = d; }
            }
        }
        gsc_push(&sc, gsc_area(reg) ? reg : (Rect){ 0, 0, 0, 0 });
    }
    glFinish();
    /* the content the FBO kept across frames is only right if every intervening frame drew its
     * region: the comparison above reads frames whose past was written by this same loop */
    printf("{\"verify\":{\"checked\":%ld,\"differ\":%ld,\"worstBits\":%ld}}\n", checked, diffs, worst);
    return diffs ? 1 : 0;
}

static int cmp(const void *a, const void *b) {
    double x = *(const double *)a, y = *(const double *)b;
    return x < y ? -1 : x > y ? 1 : 0;
}

static double p(const double *v, int n, double q) {
    double *c = malloc(sizeof *c * (size_t)n);
    memcpy(c, v, sizeof *c * (size_t)n);
    qsort(c, (size_t)n, sizeof *c, cmp);
    double r = c[(int)(q * (n - 1))];
    free(c);
    return r;
}

int main(int argc, char **argv) {
    const char *node = "/dev/dri/renderD128";
    int frames = 240, cores = 4, kind = 1, verify = 0;  /* kind 1: readers, the memory-traffic load */
    const double shares[] = { 0.015, 0.05, 0.15, 0.30 };
    for (int i = 1; i < argc; i++) {
        if (!strcmp(argv[i], "--verify")) { verify = 1; continue; }
        if (i + 1 >= argc) { fprintf(stderr, "usage: gpu-scissor [--node path] [--frames n] [--load spin|read|none] [--cores n] [--verify]\n"); return 2; }
        if (!strcmp(argv[i], "--node")) node = argv[++i];
        else if (!strcmp(argv[i], "--frames")) frames = atoi(argv[++i]);
        else if (!strcmp(argv[i], "--cores")) cores = atoi(argv[++i]);
        else if (!strcmp(argv[i], "--load")) { i++; kind = !strcmp(argv[i], "spin") ? 0 : !strcmp(argv[i], "read") ? 1 : 2; }
        else { fprintf(stderr, "usage: gpu-scissor [--node path] [--frames n] [--load spin|read|none] [--cores n] [--verify]\n"); return 2; }
    }
    if (frames < 20 || frames > 100000 || cores < 0 || cores > MAX_WORKERS) { fprintf(stderr, "bad --frames or --cores\n"); return 2; }
    if (gl_setup(node)) return 1;
    if (verify) return verify_run();
    Worker w[MAX_WORKERS];
    memset(w, 0, sizeof w);
    atomic_store(&stop_workers, 0);
    for (int i = 0; i < cores && kind != 2; i++) pthread_create(&w[i].th, NULL, worker, (void *)(intptr_t)kind);
    if (cores && kind != 2) usleep(600000);
    for (unsigned si = 0; si < sizeof shares / sizeof shares[0]; si++) {
        double *fu = malloc(sizeof *fu * (size_t)frames), *fs = malloc(sizeof *fs * (size_t)frames);
        /* interleave A/B/A/B per half-chain of frames so ambient load hits both the same */
        for (int f = 0; f < frames; f++) {
            int full = (f / 30) % 2 == 0;               /* 30 frames full, 30 scissored, … */
            double t = frame(f, full, shares[si]);
            if (full) fu[f / 60 * 30 + f % 30] = t;
            else fs[f / 60 * 30 + f % 30] = t;
        }
        int n = frames / 2;
        printf("{\"dmg%%\":%.3f,\"full_p50\":%.3f,\"full_p99\":%.3f,\"scis_p50\":%.3f,\"scis_p99\":%.3f,\"win%%\":%.1f}\n",
               shares[si], p(fu, n, 0.5), p(fu, n, 0.99), p(fs, n, 0.5), p(fs, n, 0.99),
               100.0 * (1 - (p(fs, n, 0.5) / (p(fu, n, 0.5) + 1e-9))));
        fflush(stdout);
        free(fu);
        free(fs);
    }
    atomic_store(&stop_workers, 1);
    for (int i = 0; i < cores && kind != 2; i++) pthread_join(w[i].th, NULL);
    printf("{\"verdict\":\"see win%% per damage share\",\"renderer\":\"%s\",\"fence\":%s,\"load\":\"%s\",\"cores\":%d}\n",
           glGetString(GL_RENDERER), G.fence ? "true" : "false", kind == 0 ? "spin" : kind == 1 ? "read" : "none", kind == 2 ? 0 : cores);
    return 0;
}
