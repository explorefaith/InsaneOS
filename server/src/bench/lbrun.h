/* lbrun.h — InsaneBench in insane-server (docs/BENCHMARK.md, "0.8.6 — InsaneBench"): one run at a time, on
 * its own thread. It records the conditions, waits for a quiet system, launches insane-bench (lbmain.c)
 * with the render node and, for Full, a scratch file it opened itself, checks every record that comes
 * back, watches temperatures and throttling, and saves the result as
 * ~/.local/state/insaneos/insanebench.json (the previous one becomes insanebench-prev.json). Exposed to JS
 * as insane.sysinfo.bench (ui/js_hw.c). */
#ifndef INSANE_BENCH_LBRUN_H
#define INSANE_BENCH_LBRUN_H

/* mode: "quick" or "full" (peak performance; then video in insane-media, lbvideo.c), or "desktop" (the
 * compositor's frame times while the app animates a scene, alone and then with insane-bench loading every core
 * at the lowest priority; lbframes.c). sustained_s: Full's sustained test (0 = none, 20–1800); extra: JSON
 * the caller adds as "session" (displays, composition), produced by insane-server itself. 0 started,
 * -1 refused (another run, a bad argument, no helper). Desktop results are kept apart, in
 * insanebench-desktop.json. */
int   lbrun_start(const char *mode, int sustained_s, const char *extra);
void  lbrun_cancel(void);
/* the state as JSON (malloc'd): {"state":"idle|waiting|running|done|stopped|failed|cancelled","mode",
 * "step":"<measurement>","progress":0..1,"result":{…} once finished} */
char *lbrun_poll(void);
/* the saved results (malloc'd JSON text, NULL if none): which = 0 the last peak run, 1 the previous one,
 * 2 the last desktop run, 3 the previous one */
char *lbrun_saved(int which);
/* every recorded boot's time to the first frame, grouped by Insane OS version (malloc'd JSON array):
 * [{"version","boots","median","min","max","first","test"}], the first boot after an update kept apart;
 * "test": the latest boot time test's boots of that version (bench/boottest.h), {boots, of, at, median,
 * min, max} */
char *lbrun_boot_history(const char *path);

#endif
