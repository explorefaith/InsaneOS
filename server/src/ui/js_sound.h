/* js_sound.h — insane.sound (see js_sound.c and docs/SOUND.md). */
#ifndef INSANE_JS_SOUND_H
#define INSANE_JS_SOUND_H

#include "quickjs.h"

void js_sound_register(JSContext *c, JSValue insane);

#endif
