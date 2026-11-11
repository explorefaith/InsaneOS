/* js_hw.h — insane.display, insane.power, insane.bt, insane.mime, insane.timedate (see js_hw.c). */
#ifndef INSANE_JS_HW_H
#define INSANE_JS_HW_H

#include "quickjs.h"

void js_hw_register(JSContext *c, JSValue insane);

/* How this session composes the screen right now, for insane.sysinfo (in main.c): "gpu", or why it
 * goes by the CPU: "headless" (no monitor), "no-display", "rotated" (a rotated display),
 * "capture" (recording, or a remote viewer with protected windows), "gpu-off" (gpu_info says why). */
const char *insane_composition(void);

#endif
