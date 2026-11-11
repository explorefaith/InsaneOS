/* js_media.h — insane.media (see js_media.c and docs/MEDIA.md). */
#ifndef INSANE_JS_MEDIA_H
#define INSANE_JS_MEDIA_H

#include "quickjs.h"

struct Node;
void js_media_register(JSContext *c, JSValue insane);
void js_media_node(struct Node *n, int id);       /* `media` prop of a media node */

#endif
