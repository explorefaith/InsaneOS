/* js_backup.h — insane.backup (Backups; see js_backup.c). */
#ifndef INSANE_JS_BACKUP_H
#define INSANE_JS_BACKUP_H

#include "quickjs.h"

void js_backup_register(JSContext *c, JSValue insane);

#endif
