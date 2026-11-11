/* js_wm.h — insane.wm: window dragging in C (see js_wm.c and grab.h). */
#ifndef INSANE_JS_WM_H
#define INSANE_JS_WM_H

#include "quickjs.h"

void js_wm_register(JSContext *c, JSValue insane);
void js_wm_end(int node, int edges, float dx, float dy, float dw, float dh);   /* → __insaneWm('end', …) */

#endif
