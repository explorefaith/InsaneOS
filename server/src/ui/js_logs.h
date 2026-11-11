/* js_logs.h — insane.logs (Logs app; see js_logs.c and docs/SYSTEM.md). */
#ifndef INSANE_JS_LOGS_H
#define INSANE_JS_LOGS_H

#include "quickjs.h"

void js_logs_register(JSContext *c, JSValue insane);
/* epoll fd for the main loop (thread results and inotify), or -1 */
int  logs_fd(void);
/* kind: "result" (id), "journal", "file" (name) */
void logs_dispatch(void (*fn)(const char *kind, int id, const char *name));

#endif
