/* js_monitor.h — insane.monitor (metrics for the Monitor app; see js_monitor.c). */
#ifndef INSANE_JS_MONITOR_H
#define INSANE_JS_MONITOR_H

#include "quickjs.h"

void js_monitor_register(JSContext *c, JSValue insane, const char *assets_dir);

#endif
