/* js_imager.h — insane.imager (the Insane OS Imager; see js_imager.c, docs/IMAGER.md). */
#ifndef INSANE_JS_IMAGER_H
#define INSANE_JS_IMAGER_H

#include "quickjs.h"

void js_imager_register(JSContext *c, JSValue insane);

#endif
