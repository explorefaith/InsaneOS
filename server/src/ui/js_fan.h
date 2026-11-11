/* js_fan.h — insane.fan, the session side of insane-fand (see js_fan.c, docs/FANS.md). */
#ifndef INSANE_JS_FAN_H
#define INSANE_JS_FAN_H

#include "quickjs.h"

void js_fan_register(JSContext *c, JSValue insane);

#endif
