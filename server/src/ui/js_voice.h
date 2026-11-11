/* js_voice.h — insane.voice: reading text aloud (see js_voice.c). */
#ifndef INSANE_JS_VOICE_H
#define INSANE_JS_VOICE_H

#include "quickjs.h"

void js_voice_register(JSContext *c, JSValue insane);

#endif
