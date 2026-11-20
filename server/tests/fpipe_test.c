/* fpipe_test.c — the frame pipeline's decisions (src/fpipe.c, docs/GPU.md "The frame pipeline"):
 *   - INSANE_PIPELINE (unset/1 auto by default, 0 off, 2 always) and the auto mode's engagement:
 *     two frames in a row that missed their vblank (built beyond 90 % of the period) while the JS
 *     part fits one (under 60 %) — the guard that keeps the Pi 5's outgrown case on the serial build;
 *   - what a display does next (build, submit, prepare, wait) and when input waits for the flip;
 *   - a display driven the way main.c drives it, on a vblank grid: a frame whose CPU part plus the GPU's
 *     part passes the period is shown every other vblank without the pipeline and at every vblank with
 *     it; a light frame is shown at every vblank either way; an idle display builds at once; nothing is
 *     prepared twice for one flip (no busy loop);
 *   - auto lets go after an idle gap (FPIPE_IDLE_MS without a frame) or the moment the JS work
 *     outgrows the period;
 *   - the JS frame callbacks run once per frame shown, also when a prepare painted nothing. */
#include "fpipe.h"

#include <stdio.h>
#include <string.h>

static int fails, checks;
static double clock_ms = 1000;
static void note(FPipe *p, double built_ms, double js_ms, double period_ms) { clock_ms += 16.67; fpipe_note(p, clock_ms, built_ms, js_ms, period_ms); }
static void note_at(FPipe *p, double at, double built_ms, double js_ms, double period_ms) { clock_ms = at; fpipe_note(p, at, built_ms, js_ms, period_ms); }
#define CHECK(c) do { checks++; if (!(c)) { fails++; fprintf(stderr, "%s:%d: CHECK(%s) failed\n", __FILE__, __LINE__, #c); } } while (0)

static void test_mode(void) {
    FPipe p;
    fpipe_init(&p, NULL);                       /* unset: auto (the default since 2026-11-21) */
    CHECK(p.mode == FPIPE_AUTO && !fpipe_engaged(&p));
    fpipe_init(&p, "");
    CHECK(p.mode == FPIPE_AUTO);
    fpipe_init(&p, "1");
    CHECK(p.mode == FPIPE_AUTO);
    fpipe_init(&p, "0");
    CHECK(p.mode == FPIPE_OFF && !fpipe_engaged(&p));
    note(&p, 30, 2, 16.67);                     /* off stays off, however heavy */
    note(&p, 30, 2, 16.67);
    CHECK(!fpipe_engaged(&p));
    fpipe_init(&p, "2");
    CHECK(p.mode == FPIPE_ALWAYS && fpipe_engaged(&p));
    note(&p, 1, 1, 16.67);
    CHECK(fpipe_engaged(&p));
    fpipe_init(&p, "yes");                      /* anything else: off */
    CHECK(p.mode == FPIPE_OFF);
}

static void test_auto(void) {
    FPipe p;
    fpipe_init(&p, "1");
    note(&p, 30, 2, 16.67);                     /* one vblank-missing frame: not yet */
    CHECK(!fpipe_engaged(&p));
    note(&p, 8, 2, 16.67);                      /* a build inside its own vblank: the run is broken */
    note(&p, 30, 2, 16.67);
    CHECK(!fpipe_engaged(&p));
    note(&p, 30, 2, 16.67);                     /* two in a row that missed, with room to prepaint */
    CHECK(fpipe_engaged(&p));
    /* the Pi 5's case: the JS work itself outgrew the period — let go at once, never re-engage */
    note(&p, 30, 18, 16.67);
    CHECK(!fpipe_engaged(&p));
    note(&p, 30, 18, 16.67);
    CHECK(!fpipe_engaged(&p));
    note(&p, 30, 2, 16.67);                     /* capable again: two in a row engage it */
    CHECK(!fpipe_engaged(&p));
    note(&p, 30, 2, 16.67);
    CHECK(fpipe_engaged(&p));
    /* while engaged a fast build is the pipeline's own doing: no light-run release */
    for (int i = 0; i < 200; i++) note(&p, 6, 2, 16.67);
    CHECK(fpipe_engaged(&p));
    /* no period: ignored */
    fpipe_init(&p, "1");
    note(&p, 30, 2, 0);
    note(&p, 30, 2, 0);
    CHECK(!fpipe_engaged(&p));
}

static void test_step(void) {
    /* no flip pending: a prepared frame is submitted; else built if there is something to show */
    CHECK(fpipe_step(1, 0, FPIPE_READY, 0, 0) == FPIPE_SUBMIT);
    CHECK(fpipe_step(0, 0, FPIPE_READY, 1, 1) == FPIPE_SUBMIT);     /* even after the pipeline let go */
    CHECK(fpipe_step(1, 0, FPIPE_NONE, 1, 0) == FPIPE_BUILD);
    CHECK(fpipe_step(1, 0, FPIPE_EMPTY, 1, 0) == FPIPE_BUILD);      /* the attempt painted nothing: built now */
    CHECK(fpipe_step(1, 0, FPIPE_NONE, 0, 0) == FPIPE_WAIT);
    /* flip pending: prepared only with the pipeline, once, and only with work to do ahead */
    CHECK(fpipe_step(1, 1, FPIPE_NONE, 1, 1) == FPIPE_PREPARE);
    CHECK(fpipe_step(0, 1, FPIPE_NONE, 1, 1) == FPIPE_WAIT);
    CHECK(fpipe_step(1, 1, FPIPE_NONE, 1, 0) == FPIPE_WAIT);
    CHECK(fpipe_step(1, 1, FPIPE_READY, 1, 1) == FPIPE_WAIT);
    CHECK(fpipe_step(1, 1, FPIPE_EMPTY, 1, 1) == FPIPE_WAIT);
    /* input waits: always without the pipeline while the flip is pending; with it only once prepared */
    CHECK(!fpipe_blocked(0, 0, FPIPE_NONE) && !fpipe_blocked(1, 0, FPIPE_READY));
    CHECK(fpipe_blocked(0, 1, FPIPE_NONE));
    CHECK(!fpipe_blocked(1, 1, FPIPE_NONE));
    CHECK(fpipe_blocked(1, 1, FPIPE_READY) && fpipe_blocked(1, 1, FPIPE_EMPTY));
}

/* One display driven like main.c's loop on a vblank grid (period P, µs). Every frame has cpu µs of CPU work
 * (input, JS, layout, paint) and sub µs to submit (upload, swap, flip ioctl); the GPU then needs gpu µs, and a
 * flip lands on the first vblank after both. animate: there is always a next frame to build. Returns the flips
 * shown in n periods; *prepares counts frames painted ahead, *spins render calls that did nothing. The note
 * carries built = the flip's landing minus the frame's start (what a real build's sync waits inflate) and
 * js = the frame's own CPU part. */
typedef struct { long shown, prepares, spins, max_latency; } Sim;
static Sim simulate(int mode, long cpu, long sub, long gpu, int animate, long n) {
    const long P = 16667;
    FPipe fp;
    fpipe_init(&fp, mode == FPIPE_OFF ? "0" : mode == FPIPE_ALWAYS ? "2" : "1");
    Sim r = { 0, 0, 0, 0 };
    long t = 0, flip_at = -1;                   /* when the pending flip lands (-1: none) */
    int prep = FPIPE_NONE;
    long input_t = 0, prep_input = 0, inflight_input = 0;    /* when the newest input shown by a frame came */
    int damage = 1;
    while (t < n * P) {
        int pending = flip_at >= 0;
        if (pending && t >= flip_at) {          /* the flip event */
            pending = 0;
            flip_at = -1;
            r.shown++;
            long lat = t - inflight_input;
            if (lat > r.max_latency) r.max_latency = lat;
        }
        if (animate) { damage = 1; input_t = t; }       /* new input every wake: the frame shows it */
        int eligible = fpipe_engaged(&fp);
        int step = fpipe_step(eligible, pending, prep, damage, damage);
        long busy = 0, built = 0;
        if (step == FPIPE_SUBMIT) {
            busy += sub;
            prep = FPIPE_NONE;
            inflight_input = prep_input;
            flip_at = ((t + busy + gpu) / P + 1) * P;   /* the next vblank after the GPU is done */
            pending = 1;
            built = flip_at - t;                        /* the submit's own wait, as a real build measures it */
            fpipe_note(&fp, (double)t / 1000, (double)built / 1000, 0, P / 1000.0);
        } else if (step == FPIPE_BUILD) {
            busy += cpu + sub;
            damage = 0;
            inflight_input = input_t;
            flip_at = ((t + busy + gpu) / P + 1) * P;
            pending = 1;
            built = flip_at - t;
            fpipe_note(&fp, (double)t / 1000, (double)built / 1000, (double)cpu / 1000, P / 1000.0);
        }
        /* then, like render_frame, the next frame may be painted ahead */
        if (fpipe_step(fpipe_engaged(&fp), pending, prep, 0, damage) == FPIPE_PREPARE) {
            busy += cpu;
            prep = damage ? FPIPE_READY : FPIPE_EMPTY;
            prep_input = input_t;
            damage = 0;
            r.prepares++;
        } else if (step == FPIPE_WAIT && pending && !fpipe_blocked(fpipe_engaged(&fp), pending, prep) && damage) r.spins++;
        t += busy;
        if (!busy) t = flip_at >= 0 ? (flip_at > t ? flip_at : t + 1) : t + P / 4;   /* poll until the next event */
    }
    return r;
}

static void test_sim(void) {
    /* the Pi 5 under an all-core load (docs/BENCHMARK.md): about 13 ms of CPU, 1 ms to submit, 3 ms of GPU —
     * the JS work outgrows the period, so auto must never engage: exactly the serial build's pace */
    Sim off = simulate(FPIPE_OFF, 13000, 1000, 3000, 1, 600);
    Sim au = simulate(FPIPE_AUTO, 13000, 1000, 3000, 1, 600);
    Sim on = simulate(FPIPE_ALWAYS, 13000, 1000, 3000, 1, 600);
    CHECK(off.shown >= 299 && off.shown <= 301 && off.prepares == 0);   /* every other vblank: 30 Hz */
    CHECK(au.shown == off.shown && au.prepares == 0);                   /* the guard: auto stays off here */
    CHECK(on.shown >= 598 && on.prepares >= 597);                       /* every vblank: 60 Hz (forced) */
    CHECK(on.max_latency <= 3 * 16667 && off.max_latency <= 3 * 16667); /* input to screen: within 3 periods */
    /* the laptop's shape (docs/GPU.md): 5 ms of CPU, 1 ms to submit, 2 ms of GPU — the serial build
     * already holds 60 Hz, and the pipeline overlaps the sync without costing a frame of latency */
    Sim l_off = simulate(FPIPE_OFF, 5000, 1000, 2000, 1, 600), l_au = simulate(FPIPE_AUTO, 5000, 1000, 2000, 1, 600);
    CHECK(l_off.shown >= 598 && l_au.shown >= 598 && l_au.prepares > 0);
    CHECK(l_au.max_latency <= 2 * 16667);                               /* not one frame more than without it */
    /* heavier than a period even pipelined: one frame per 21 ms of CPU (about 47 a second instead of 30),
     * never more than one ahead (input within 3 periods), and no busy loop — and auto never engages
     * (its JS work is 20 ms against a 16.67 ms period) */
    Sim h = simulate(FPIPE_ALWAYS, 20000, 1000, 3000, 1, 600), h_off = simulate(FPIPE_OFF, 20000, 1000, 3000, 1, 600);
    CHECK(h.shown >= 460 && h.shown <= 480 && h.spins == 0 && h.max_latency <= 3 * 16667);
    CHECK(h_off.shown >= 299 && h_off.shown <= 301);
    Sim h_au = simulate(FPIPE_AUTO, 20000, 1000, 3000, 1, 600);
    CHECK(h_au.shown == h_off.shown && h_au.prepares == 0);
    CHECK(on.spins == 0 && au.spins == 0 && h_au.spins == 0);
    /* idle: one change is built and shown at once, nothing is prepared */
    Sim idle = simulate(FPIPE_ALWAYS, 13000, 1000, 3000, 0, 60);
    CHECK(idle.shown == 1 && idle.prepares == 0);
}

/* Auto after an idle desktop: no frames come, so nothing is counted; the first frame after a gap longer than
 * FPIPE_IDLE_MS lets go, and a vblank-missing one counts as the first of the two that engage it again. */
static void test_idle(void) {
    FPipe p;
    fpipe_init(&p, "1");
    note_at(&p, 1000, 30, 2, 16.67);
    note_at(&p, 1016.7, 30, 2, 16.67);
    CHECK(fpipe_engaged(&p));
    note_at(&p, 1416.7, 30, 2, 16.67);          /* 400 ms later: not idle */
    CHECK(fpipe_engaged(&p));
    note_at(&p, 1916.7, 30, 2, 16.67);          /* exactly FPIPE_IDLE_MS later: not yet idle */
    CHECK(fpipe_engaged(&p));
    note_at(&p, 2600, 30, 2, 16.67);            /* 683 ms without a frame: off at once; this very
                                                 * frame counts as the first of the two that re-engage */
    CHECK(!fpipe_engaged(&p) && p.heavy == 1);
    note_at(&p, 2616.7, 30, 2, 16.67);
    CHECK(fpipe_engaged(&p));
    /* the JS work outgrowing the period lets go even without a gap */
    note_at(&p, 2633.4, 30, 18, 16.67);
    CHECK(!fpipe_engaged(&p));
    /* always and off ignore the gap */
    fpipe_init(&p, "2");
    note_at(&p, 1000, 5, 2, 16.67);
    note_at(&p, 9000, 5, 2, 16.67);
    CHECK(fpipe_engaged(&p));
    fpipe_init(&p, "0");
    note_at(&p, 1000, 30, 2, 16.67);
    note_at(&p, 1016.7, 30, 2, 16.67);
    note_at(&p, 9000, 30, 2, 16.67);
    CHECK(!fpipe_engaged(&p));
    /* a frame-by-frame run: a heavy drag engages it, the desktop goes idle for 2 s, then a light click
     * whose build fits its own vblank: nothing to gain, the pipeline stays off */
    fpipe_init(&p, "1");
    double t = 1000;
    for (int i = 0; i < 100; i++, t += 16.67) note_at(&p, t, 30, 2, 16.67);
    CHECK(fpipe_engaged(&p));
    note_at(&p, t + 2000, 8, 4, 16.67);         /* a 2 s gap lets go; the click's build fits its vblank */
    CHECK(!fpipe_engaged(&p));
    CHECK(fpipe_blocked(fpipe_engaged(&p), 1, FPIPE_NONE));      /* input during that frame's flip waits for it */
}

/* The JS frame callbacks against the frames shown: one display, light frames, an animation callback that never
 * changes anything and always asks for the next frame, and an app on the GPU path that sends a new frame after each
 * frame callback (so the display keeps flipping without UI damage). Driven like main.c's loop and render_frame:
 * a render runs when the display is not waiting for its flip or a frame can be prepared; the callbacks run in it
 * unless held (hold: fpipe_hold_callbacks; 0 simulates the code before the fix); a frame is built after the flip
 * for the app; while the flip is pending the callbacks make a prepare, which paints nothing (FPIPE_EMPTY). */
static void sim_callbacks(int mode, int hold, long n, long *shown, long *cbs) {
    const long P = 16667, cpu = 2000, gpu = 2000;
    FPipe fp;
    fpipe_init(&fp, mode == FPIPE_OFF ? "0" : mode == FPIPE_ALWAYS ? "2" : "1");
    long t = 0, flip_at = -1;
    int prep = FPIPE_NONE, prep_js = 0, app_new = 1;
    *shown = *cbs = 0;
    while (t < n * P) {
        int pending = flip_at >= 0;
        if (pending && t >= flip_at) { pending = 0; flip_at = -1; (*shown)++; }
        int eligible = fpipe_engaged(&fp);
        int ahead = fpipe_step(eligible, pending, prep, 0, 1) == FPIPE_PREPARE;
        if (pending && !ahead) { t = flip_at; continue; }
        int prep_only = pending, held = 0, ran = 0;
        long busy = 0;
        if (!prep_only) {
            held = hold && fpipe_hold_callbacks(prep, prep_js);
            prep_js = 0;
        }
        if (!held) { (*cbs)++; ran = 1; }         /* the callback runs, changes nothing, asks again */
        busy += cpu;
        if (!pending && (fpipe_step(eligible, 0, prep, app_new, 0) == FPIPE_BUILD)) {
            prep = FPIPE_NONE;                     /* (prep_undo) */
            prep_js = 0;
            flip_at = ((t + busy + gpu) / P + 1) * P;
            pending = 1;
            fpipe_note(&fp, (double)t / 1000, (double)(flip_at - t) / 1000, (double)cpu / 1000, P / 1000.0);
        }
        if (fpipe_step(eligible, pending, prep, 0, prep_only) == FPIPE_PREPARE) {
            prep = FPIPE_EMPTY;                    /* nothing to paint */
            prep_js = ran;                         /* (the callback asked again) */
        }
        if (!prep_only) app_new = 1;              /* wl_frame_done: the app sends its next frame at once */
        t += busy;
    }
}

static void test_callbacks(void) {
    long shown, cbs;
    sim_callbacks(FPIPE_OFF, 1, 600, &shown, &cbs);
    CHECK(shown >= 598 && cbs >= shown && cbs <= shown + 1);         /* once per frame shown */
    long off_cbs = cbs;
    sim_callbacks(FPIPE_ALWAYS, 0, 600, &shown, &cbs);               /* before the fix: twice per frame */
    CHECK(shown >= 598 && cbs >= 2 * shown - 1);
    sim_callbacks(FPIPE_ALWAYS, 1, 600, &shown, &cbs);               /* with it: once, as with the pipeline off */
    CHECK(shown >= 598 && cbs >= shown && cbs <= shown + 2 && cbs <= off_cbs + 1);   /* (+1: one prepared at the end) */
    sim_callbacks(FPIPE_AUTO, 1, 600, &shown, &cbs);                 /* auto engages here and holds the same rule */
    CHECK(shown >= 598 && cbs >= shown && cbs <= off_cbs + 3);
    /* the rule: only after a prepare that painted nothing and whose callbacks asked again */
    CHECK(fpipe_hold_callbacks(FPIPE_EMPTY, 1));
    CHECK(!fpipe_hold_callbacks(FPIPE_EMPTY, 0) && !fpipe_hold_callbacks(FPIPE_READY, 1) && !fpipe_hold_callbacks(FPIPE_NONE, 1));
}

int main(void) {
    test_mode();
    test_auto();
    test_step();
    test_sim();
    test_idle();
    test_callbacks();
    printf("fpipe-test: %d checks, %d failed\n", checks, fails);
    return fails ? 1 : 0;
}
