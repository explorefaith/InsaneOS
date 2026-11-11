/* js_fw.h — insane.fw: per-app network permissions (see js_fw.c and docs/FIREWALL.md). */
#ifndef INSANE_JS_FW_H
#define INSANE_JS_FW_H

#include "quickjs.h"
#include <stdint.h>

void js_fw_register(JSContext *c, JSValue insane);
/* the latest per-app counters from insane-netperm (its JSON, or NULL) and a number that changes with them */
const char *js_fw_counts(uint64_t *seq);

#endif
