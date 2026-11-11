/* js_termconf.h — insane.termconf: the Terminal's configuration file (see js_termconf.c, ../termconf.h). */
#ifndef INSANE_JS_TERMCONF_H
#define INSANE_JS_TERMCONF_H

#include "quickjs.h"

void js_termconf_register(JSContext *c, JSValue insane);

#endif
