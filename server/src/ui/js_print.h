/* js_print.h — insane.print: printers (CUPS over IPP) and eSCL scanners (see js_print.c). */
#ifndef INSANE_JS_PRINT_H
#define INSANE_JS_PRINT_H

#include "quickjs.h"

void js_print_register(JSContext *c, JSValue insane);

#endif
