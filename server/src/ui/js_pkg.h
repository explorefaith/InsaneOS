/* js_pkg.h — insane.pkg (Debian package queries, see js_pkg.c). */
#ifndef INSANE_JS_PKG_H
#define INSANE_JS_PKG_H

#include "quickjs.h"

void js_pkg_register(JSContext *c, JSValue insane);

#endif
