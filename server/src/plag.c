/* plag.c — pointer latency trace, see plag.h (privacy rules there). */
#include "plag.h"

#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/time.h>
#include <time.h>
#include <unistd.h>

static int enabled;

#define PLG_MAX 512                     /* samples per stage between flushes */
#define PLG_LINES 2000                 /* 2000 lines ≈ 2.8 h of tracing, then it stops by itself */
#define PLG_FLUSH_MS 5000.0

static uint32_t s1[PLG_MAX], s2[PLG_MAX], s3[PLG_MAX];   /* µs, saturating */
static int n1, n2, n3;
static int batch;                        /* a SYN moved the pointer and dispatch has not run yet */
static uint64_t batch_read_ns;           /* the batch's first report was read then */
static int have_dispatch;                /* a dispatch waits for the next flip to pair with */
static uint64_t last_dispatch_ns;
static unsigned lines;
static double next_flush;
static FILE *out;

static uint64_t mono_ns(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return (uint64_t)t.tv_sec * 1000000000ull + (uint64_t)t.tv_nsec;
}

void plag_init(int greeter) {
    const char *e = getenv("INSANE_INPUT_DEBUG");
    enabled = !greeter && e && !strcmp(e, "1");
    if (enabled)
        fprintf(stderr, "plag: pointer latency trace on (INSANE_INPUT_DEBUG=1), in $XDG_RUNTIME_DIR/insaneos-pointerlag.log\n");
}

int plag_enabled(void) { return enabled; }

static void stop(const char *why) {
    enabled = 0;
    n1 = n2 = n3 = batch = have_dispatch = 0;
    if (out) { fprintf(out, "pointerlag stop: %s\n", why); fclose(out); out = NULL; }
    fprintf(stderr, "plag: trace stopped (%s)\n", why);
}

static int open_out(void) {
    if (out) return 0;
    const char *rt = getenv("XDG_RUNTIME_DIR");
    char path[512];
    if (!rt || rt[0] != '/' || snprintf(path, sizeof path, "%s/insaneos-pointerlag.log", rt) >= (int)sizeof path) return -1;
    unlink(path);                        /* a trace left by an earlier session of this user */
    int fd = open(path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0600);
    if (fd < 0) return -1;
    if (!(out = fdopen(fd, "w"))) { close(fd); return -1; }
    setvbuf(out, NULL, _IOLBF, 0);
    fprintf(out, "pointerlag start: percentiles in µs after the kernel's evdev timestamp; "
                 "stage1 evdev→read, stage2 read→dispatch, stage3 dispatch→flip\n");
    return 0;
}

static void push(uint32_t *a, int *n, uint64_t lat_us) {
    if (*n >= PLG_MAX) return;           /* the flush at 5 s keeps this from ever filling */
    if (lat_us > 60000000ull) lat_us = 60000000ull;   /* saturate at one minute */
    a[(*n)++] = (uint32_t)lat_us;
}

static int cmp_u32(const void *pa, const void *pb) {
    uint32_t a = *(const uint32_t *)pa, b = *(const uint32_t *)pb;
    return a < b ? -1 : a > b ? 1 : 0;
}

static uint32_t pct(const uint32_t *a, int n, int p) {   /* a is sorted; nearest-rank */
    if (n <= 0) return 0;
    int k = (p * n + 99) / 100;
    if (k < 1) k = 1;
    if (k > n) k = n;
    return a[k - 1];
}

static void flush(double now) {
    next_flush = now + PLG_FLUSH_MS;
    if (!n1 && !n2 && !n3) return;
    if (open_out()) { if (enabled) stop("cannot create the trace file"); return; }
    static uint32_t t1[PLG_MAX], t2[PLG_MAX], t3[PLG_MAX];
    memcpy(t1, s1, sizeof s1[0] * (size_t)n1);
    memcpy(t2, s2, sizeof s2[0] * (size_t)n2);
    memcpy(t3, s3, sizeof s3[0] * (size_t)n3);
    qsort(t1, (size_t)n1, sizeof t1[0], cmp_u32);
    qsort(t2, (size_t)n2, sizeof t2[0], cmp_u32);
    qsort(t3, (size_t)n3, sizeof t3[0], cmp_u32);
    fprintf(out, "pointerlag n1=%u stage1 %u/%u/%u/%u n2=%u stage2 %u/%u/%u/%u n3=%u stage3 %u/%u/%u/%u\n",
            (unsigned)n1, pct(t1, n1, 50), pct(t1, n1, 95), pct(t1, n1, 99), n1 ? t1[n1 - 1] : 0,
            (unsigned)n2, pct(t2, n2, 50), pct(t2, n2, 95), pct(t2, n2, 99), n2 ? t2[n2 - 1] : 0,
            (unsigned)n3, pct(t3, n3, 50), pct(t3, n3, 95), pct(t3, n3, 99), n3 ? t3[n3 - 1] : 0);
    n1 = n2 = n3 = 0;
    if (++lines >= PLG_LINES) stop("line limit");
}

void plag_event(const struct timeval *tv) {
    if (!enabled) return;
    uint64_t now = mono_ns();
    /* the kernel stamps with the clock EVIOCSCLOCKID asked for: monotonic for every pointer device
     * (input.c sets it, tp/tp.c for the touchpads); a stamp still in the past means a clock the
     * compositor does not read — measured against the read instead of a wrong huge latency */
    uint64_t ev = (uint64_t)tv->tv_sec * 1000000000ull + (uint64_t)tv->tv_usec * 1000ull;
    if (ev > now) ev = now;
    push(s1, &n1, (now - ev) / 1000);
    if (!batch) { batch = 1; batch_read_ns = now; }
}

void plag_dispatch(void) {
    if (!enabled || !batch) return;
    batch = 0;
    uint64_t now = mono_ns();
    push(s2, &n2, (now - batch_read_ns) / 1000);
    last_dispatch_ns = now;
    have_dispatch = 1;
}

void plag_presented(uint64_t flip_ns) {
    if (!enabled || !have_dispatch) return;
    have_dispatch = 0;
    uint64_t shown = flip_ns ? flip_ns : mono_ns();
    if (shown < last_dispatch_ns) return;        /* a flip older than the dispatch: not its frame */
    push(s3, &n3, (shown - last_dispatch_ns) / 1000);
}

void plag_flush(void) {
    if (!enabled) return;
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    double now = t.tv_sec * 1e3 + t.tv_nsec / 1e6;
    if (!next_flush) { next_flush = now + PLG_FLUSH_MS; return; }
    if (now >= next_flush) flush(now);
}
