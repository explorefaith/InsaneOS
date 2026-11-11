/* js_help.h — insane.help (Help articles) and insane.time.zoneOffset (Clock). See js_help.c. */
#ifndef INSANE_JS_HELP_H
#define INSANE_JS_HELP_H

#include "quickjs.h"

/* Call after js_sys_register (it adds zoneOffset to the insane.time object that one creates). */
void js_help_register(JSContext *c, JSValue insane);

#endif
