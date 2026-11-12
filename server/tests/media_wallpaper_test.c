/* media_wallpaper_test.c — the live wallpaper's decode path, without a compositor: insane-server's own
 * spawn protocol (media.c media_spawn, proto.h) against the real insane-media binary, hardware-only,
 * exactly how MotionWallpaper plays it (sdk/motion.jsx: loop, audio 0, hwOnly 1). Skips (exit 77)
 * with no render node or no built helper: nothing here proves a machine without a GPU wrong.
 *
 * Verifies, and prints one line per claim:
 *   - the helper starts and answers with its frame ring (a memfd sealed against shrinking);
 *   - the decode is in hardware (MM_STATS v[3]); with hwonly the helper exits rather than fall back,
 *     so a 0 here is a failure, not a software run;
 *   - frames arrive and two frames taken a few hundred ms apart differ (a still frame is not a wallpaper);
 *   - how much of one core the helper used while playing (utime+stime from /proc).
 */
#include <errno.h>
#include <fcntl.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/sysinfo.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#include "../src/media/proto.h"

#ifndef HELPER
#define HELPER "build/insane-media"
#endif

static double now_ms(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return (double)t.tv_sec * 1e3 + (double)t.tv_nsec / 1e6;
}

static long helper_cpu_ticks(pid_t pid) {
    char p[64];
    snprintf(p, sizeof p, "/proc/%d/stat", (int)pid);
    FILE *f = fopen(p, "r");
    if (!f) return -1;
    char buf[2048];
    size_t n = fread(buf, 1, sizeof buf - 1, f);
    fclose(f);
    buf[n] = 0;
    /* field 14 (utime) and 15 (stime); the comm field may contain spaces, so start after the last ')' */
    char *s = strrchr(buf, ')');
    if (!s) return -1;
    long utime = 0, stime = 0;
    if (sscanf(s + 2, "%*c %*d %*d %*d %*d %*d %*u %*u %*u %*u %*u %*u %lu %lu", &utime, &stime) != 2) return -1;
    return utime + stime;
}

static int open_render(void) {
    for (int i = 128; i < 136; i++) {
        char p[32];
        snprintf(p, sizeof p, "/dev/dri/renderD%d", i);
        int fd = open(p, O_RDWR | O_CLOEXEC);
        if (fd >= 0) return fd;
    }
    return -1;
}

/* A frame's fingerprint: FNV-1a over every 401st byte of the slot, alpha included. */
static unsigned frame_hash(const uint8_t *base, size_t bytes) {
    unsigned h = 2166136261u;
    for (size_t i = 0; i < bytes; i += 401) { h ^= base[i]; h *= 16777619u; }
    return h;
}

/* Two frames of the wallpaper, as PPM, into /tmp/insaneos-wpframes (or $INSANE_WALLPAPER_DUMP): the
 * decoded wallpaper, two seconds apart, to look at. BGRA → RGB. */
static void dump_ppm(const char *what, const uint8_t *base, int w, int h) {
    const char *dir = getenv("INSANE_WALLPAPER_DUMP");
    if (!dir || !*dir) dir = "/tmp/insaneos-wpframes";
    mkdir("/tmp/insaneos-wpframes", 0755);
    char p[512];
    snprintf(p, sizeof p, what, dir);
    FILE *f = fopen(p, "wb");
    if (!f) return;
    fprintf(f, "P6\n%d %d\n255\n", w, h);
    for (int i = 0; i < w * h; i++) {
        const uint8_t *px = base + (size_t)i * 4;      /* premultiplied BGRA; alpha 255 here */
        unsigned char rgb[3] = { px[2], px[1], px[0] };
        fwrite(rgb, 1, 3, f);
    }
    fclose(f);
    printf("media-wallpaper-test: frame written to %s\n", p);
}

int main(void) {
    const char *clip = getenv("INSANE_WALLPAPER_CLIP");
    if (!clip) clip = "../Wallpaper/insane-galaxy.mp4";
    int render = open_render();
    int in = open(clip, O_RDONLY | O_CLOEXEC);
    struct stat st;
    if (render < 0 || in < 0 || fstat(in, &st) || !S_ISREG(st.st_mode)) {
        fprintf(stderr, "media-wallpaper-test: skipped (render node %s, clip %s)\n",
                render < 0 ? "missing" : "ok", in < 0 ? "missing" : "ok");
        return 77;
    }
    if (access(HELPER, X_OK)) {
        fprintf(stderr, "media-wallpaper-test: skipped (%s is not built)\n", HELPER);
        return 77;
    }

    int sv[2];
    if (socketpair(AF_UNIX, SOCK_SEQPACKET | SOCK_CLOEXEC, 0, sv)) { perror("socketpair"); return 1; }
    pid_t pid = fork();
    if (pid < 0) { perror("fork"); return 1; }
    if (!pid) {
        if (dup2(sv[1], 3) < 0) _exit(127);
        int dfd = open("/dev/null", O_RDWR);
        dup2(dfd, 0);
        if (dfd > 3) close(dfd);
#ifdef SYS_close_range
        syscall(SYS_close_range, 4U, ~0U, 0);
#endif
        signal(SIGPIPE, SIG_DFL);
        execl(HELPER, "insane-media", (char *)NULL);
        _exit(127);
    }
    close(sv[1]);

    const char *params = "native=0\nloop=1\nautoplay=1\naudio=0\nhw=1\nhwonly=1\nrate=100\nhwaccel=vaapi\n";
    int64_t job[6] = { MK_PLAY, 0, 0, 0, 0, 0 };
    int fds[3] = { in, -1, render };
    if (mp_send(sv[0], MM_JOB, 0, job, params, strlen(params), fds, 3)) {
        fprintf(stderr, "media-wallpaper-test: FAIL the job didn't reach the helper\n");
        kill(pid, SIGKILL);
        return 1;
    }
    close(in);

    uint8_t *map = NULL;
    size_t map_len = 0;
    int ring_w = 0, ring_h = 0, ring_slots = 0, ring_gen = -1;
    long frames = 0, differing = 0, decoded = -1, shown = -1, hw = -1;
    int state = -1, failed = 0;
    char err[256] = "";
    unsigned prev_hash = 0;
    int have_prev = 0, dumped = 0;
    double prev_t = 0, first_frame_t = 0, last_frame_t = 0;
    long cpu0 = -1, cpu1 = -1;
    double t0 = now_ms(), deadline = t0 + 30000;

    while (now_ms() < deadline) {
        MediaMsg m;
        char payload[MP_PAYLOAD_MAX + 1];
        int rfds[MP_MAX_FDS] = { -1, -1, -1, -1 };
        int r = mp_recv(sv[0], &m, payload, sizeof payload, rfds, MP_MAX_FDS);
        if (r < 0) {                       /* nothing: wait a little, the frames are paced by the clip */
            usleep(20000);
            continue;
        }
        if (r == 0) break;                 /* the helper went away */
        switch (m.type) {
        case MM_RING:
            ring_w = (int)m.v[1]; ring_h = (int)m.v[2]; ring_slots = (int)m.v[3]; ring_gen = (int)m.v[0];
            if (rfds[0] >= 0 && ring_w > 0 && ring_h > 0 && ring_slots >= 1 && ring_slots <= MP_RING_SLOTS) {
                size_t need = (size_t)ring_w * (size_t)ring_h * 4 * (size_t)ring_slots;
                int seals = fcntl(rfds[0], F_GET_SEALS);
                struct stat rst;
                if (seals >= 0 && (seals & F_SEAL_SHRINK) && !fstat(rfds[0], &rst) && (size_t)rst.st_size >= need
                    && (map = mmap(NULL, need, PROT_READ, MAP_SHARED, rfds[0], 0)) != MAP_FAILED) {
                    map_len = need;
                    printf("media-wallpaper-test: ring %dx%d, %d slots (gen %d, memfd sealed)\n", ring_w, ring_h, ring_slots, ring_gen);
                } else map = NULL;
            }
            break;
        case MM_FRAME: {
            int gen = (int)(m.id >> 8), slot = (int)(m.id & 0xff);
            if (!map || gen != ring_gen || slot >= ring_slots) break;
            double t = now_ms();
            if (!first_frame_t) first_frame_t = t;
            last_frame_t = t;
            frames++;
            const uint8_t *base = map + (size_t)slot * ring_w * ring_h * 4;
            size_t bytes = (size_t)ring_w * (size_t)ring_h * 4;
            unsigned hsh = frame_hash(base, bytes);
            if (dumped < 2 && (frames == 5 || frames == 55)) {          /* two frames ~1.7 s apart, as evidence */
                dump_ppm(dumped ? "%s/frame2.ppm" : "%s/frame1.ppm", base, ring_w, ring_h);
                dumped++;
            }
            if (have_prev && t - prev_t >= 300 && hsh != prev_hash) differing++;
            if (!have_prev || t - prev_t >= 300) { prev_hash = hsh; prev_t = t; have_prev = 1; }
            if (cpu0 < 0) cpu0 = helper_cpu_ticks(pid);
            mp_sendv(sv[0], MM_ACK, m.id, 0, 0, 0, 0);
            break;
        }
        case MM_STATS:
            decoded = m.v[0]; shown = m.v[1]; hw = m.v[3];
            break;
        case MM_STATE:
            state = (int)m.v[0];
            if (state == MS_FAILED) failed = 1;
            break;
        case MM_ERROR:
            snprintf(err, sizeof err, "%.*s", (int)sizeof err - 1, payload);
            break;
        default: break;
        }
        for (int i = 0; i < MP_MAX_FDS; i++) if (rfds[i] >= 0) close(rfds[i]);
        /* enough evidence: ~2 s of frames, at least two comparisons */
        if (frames >= 60 && differing >= 2) break;
    }
    cpu1 = helper_cpu_ticks(pid);
    double played_s = last_frame_t && first_frame_t ? (last_frame_t - first_frame_t) / 1e3 : 0;
    double cpu_pct = cpu0 >= 0 && cpu1 >= 0 && played_s > 0.2
        ? (double)(cpu1 - cpu0) / (double)sysconf(_SC_CLK_TCK) / played_s * 100.0 : -1;

    mp_sendv(sv[0], MM_STOP, 0, 0, 0, 0, 0);
    mp_sendv(sv[0], MM_STOP, 0, 0, 0, 0, 0);
    close(sv[0]);
    for (int i = 0; i < 50 && kill(pid, 0) == 0; i++) usleep(20000);
    kill(pid, SIGKILL);
    waitpid(pid, NULL, 0);
    if (map) munmap(map, map_len);
    close(render);

    printf("media-wallpaper-test: frames=%ld differing=%ld decoded=%ld shown=%ld hw=%ld state=%d played=%.1fs\n",
           frames, differing, decoded, shown, hw, state, played_s);
    if (cpu_pct >= 0) printf("media-wallpaper-test: helper cpu %.0f%% of one core while playing\n", cpu_pct);
    else printf("media-wallpaper-test: helper cpu not measurable\n");

    int bad = 0;
    if (failed) { fprintf(stderr, "media-wallpaper-test: FAIL helper failed: %s\n", err[0] ? err : "MS_FAILED"); bad = 1; }
    if (frames < 30) { fprintf(stderr, "media-wallpaper-test: FAIL too few frames (%ld)\n", frames); bad = 1; }
    if (differing < 2) { fprintf(stderr, "media-wallpaper-test: FAIL the frames never change (%ld comparisons differed)\n", differing); bad = 1; }
    if (hw != 1) { fprintf(stderr, "media-wallpaper-test: FAIL the decode was not in hardware (hw=%ld; hwonly refuses software)\n", hw); bad = 1; }
    if (bad) return 1;
    printf("media-wallpaper-test: OK\n");
    return 0;
}
