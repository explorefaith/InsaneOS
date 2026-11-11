/* js_share.h — insane.share: the shell's side of the screen-sharing API (see js_share.c). */
#ifndef INSANE_JS_SHARE_H
#define INSANE_JS_SHARE_H

#include "quickjs.h"

void js_share_register(JSContext *c, JSValue insane);

#endif
