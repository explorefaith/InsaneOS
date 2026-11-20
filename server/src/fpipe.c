/* fpipe.c — see fpipe.h. */
#include "fpipe.h"

#include <string.h>

void fpipe_init(FPipe *p, const char *env) {
    memset(p, 0, sizeof *p);
    if (!env || !*env || !strcmp(env, "1")) p->mode = FPIPE_AUTO;
    else if (!strcmp(env, "2")) p->mode = FPIPE_ALWAYS;
    else p->mode = FPIPE_OFF;                   /* an explicit INSANE_PIPELINE=0 keeps the serial build */
}

void fpipe_note(FPipe *p, double now_ms, double built_ms, double js_ms, double period_ms) {
    if (p->mode != FPIPE_AUTO || period_ms <= 0) return;
    int idle = p->last > 0 && now_ms - p->last > FPIPE_IDLE_MS;
    p->last = now_ms;
    if (idle) { p->on = 0; p->heavy = 0; }
    if (js_ms >= period_ms * 0.6) {             /* the CPU part outgrew a vblank: prepainting cannot help */
        p->on = 0; p->heavy = 0;                /* (the Pi 5's loaded case) — the serial build is correct */
        return;
    }
    if (!p->on) {
        p->heavy = built_ms > period_ms * 0.9 ? p->heavy + 1 : 0;   /* a frame that missed its vblank */
        if (p->heavy >= 2) p->on = 1;
        return;
    }
    /* while engaged there is no light-run release: a fast build is the pipeline's own doing —
     * releasing on it would only flap between the two paces */
}

int fpipe_engaged(const FPipe *p) { return p->mode == FPIPE_ALWAYS || (p->mode == FPIPE_AUTO && p->on); }

int fpipe_step(int eligible, int pending, int prep, int needs, int paint) {
    if (!pending) {
        if (prep == FPIPE_READY) return FPIPE_SUBMIT;
        return needs || paint ? FPIPE_BUILD : FPIPE_WAIT;
    }
    return eligible && prep == FPIPE_NONE && paint ? FPIPE_PREPARE : FPIPE_WAIT;
}

int fpipe_blocked(int eligible, int pending, int prep) { return pending && (!eligible || prep != FPIPE_NONE); }

int fpipe_hold_callbacks(int prep, int asked_again) { return prep == FPIPE_EMPTY && asked_again; }
