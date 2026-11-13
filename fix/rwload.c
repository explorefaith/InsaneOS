/* rwload.c — a self-contained load generator for the real-world responsiveness suite
 * (fix/realworld-suite.sh). No dependencies, built once by the script with cc.
 *
 *   rwload cpu <threads> <seconds> [nice]     CPU burn, nice 0 like a real build (19 = polite)
 *   rwload mem  <MB> <seconds> [churn]        balloon: touch every page, hold, optionally keep
 *                                             writing (churn per pass) so reclaim can't drop it
 *   rwload churn <MB> <threads> <seconds>     memory bandwidth: one scratch buffer per thread,
 *                                             rewritten forever (the GPU-late condition of docs/GPU.md)
 *
 * Prints nothing; exits 0. All allocations are touched so the RSS is real, like a build's or a
 * browser's would be — an untouched balloon only pressures the page cache, not the working set.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

static double mono(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return t.tv_sec + t.tv_nsec / 1e9;
}

static double deadline(int seconds) { return mono() + seconds; }

static void burn_until(double until) {
    unsigned x = 2463534242u;
    while (mono() < until) for (int i = 0; i < 1 << 16; i++) x = x * 1664525u + 1013904223u;
    (void)x;
}

int main(int argc, char **argv) {
    if (argc < 4) { fprintf(stderr, "usage: %s cpu <threads> <seconds> [nice] | mem <MB> <seconds> [churn] | churn <MB> <threads> <seconds>\n", argv[0]); return 2; }
    double until = 0;
    if (!strcmp(argv[1], "cpu")) {
        int threads = atoi(argv[2]), secs = atoi(argv[3]);
        int nice = argc > 4 ? atoi(argv[4]) : 0;
        until = deadline(secs);
        for (int i = 1; i < threads; i++) {
            pid_t p = fork();
            if (p == 0) { if (nice) setpriority(PRIO_PROCESS, 0, nice); burn_until(until); _exit(0); }
            if (p < 0) break;
        }
        if (nice) setpriority(PRIO_PROCESS, 0, nice);
        burn_until(until);
        while (wait(NULL) > 0) {}
        return 0;
    }
    if (!strcmp(argv[1], "mem")) {
        long mb = atol(argv[2]);
        int secs = atoi(argv[3]);
        int churn = argc > 4 ? atoi(argv[4]) : 0;
        size_t bytes = (size_t)mb << 20;
        char *buf = malloc(bytes);
        if (!buf) { fprintf(stderr, "rwload: %ld MB refused\n", mb); return 1; }
        memset(buf, 0x5a, bytes);                       /* every page in */
        until = deadline(secs);
        double last = mono();
        while (mono() < until) {
            if (churn && mono() - last >= 1.0) {        /* one scrub a second: the pages stay hot */
                for (size_t i = 0; i < bytes; i += 4096) buf[i] = (char)(i ^ 0xa5);
                last = mono();
            }
            usleep(200000);
        }
        free(buf);
        return 0;
    }
    if (!strcmp(argv[1], "churn")) {
        long mb = atol(argv[2]);
        int threads = atoi(argv[3]), secs = atoi(argv[4]);
        size_t bytes = ((size_t)mb << 20) / (threads > 0 ? threads : 1);
        until = deadline(secs);
        for (int i = 0; i < threads; i++) {
            pid_t p = fork();
            if (p == 0) {
                char *buf = malloc(bytes ? bytes : 1);
                if (!buf) _exit(1);
                memset(buf, 1, bytes);
                while (mono() < until) for (size_t j = 0; j < bytes; j += 64) buf[j] = (char)(buf[j] + 1);
                _exit(0);
            }
            if (p < 0) break;
        }
        while (wait(NULL) > 0) {}
        return 0;
    }
    fprintf(stderr, "rwload: unknown mode %s\n", argv[1]);
    return 2;
}
