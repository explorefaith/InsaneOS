/* js_clean.h — insane.clean (Cleaner; see js_clean.c). */
#ifndef INSANE_JS_CLEAN_H
#define INSANE_JS_CLEAN_H

#include "quickjs.h"

void js_clean_register(JSContext *c, JSValue insane);

#endif
