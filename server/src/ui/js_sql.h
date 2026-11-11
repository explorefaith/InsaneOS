/* js_sql.h — insane.sql: MySQL and MariaDB through insane-sql (see js_sql.c and docs/DATABASES.md). */
#ifndef INSANE_JS_SQL_H
#define INSANE_JS_SQL_H

#include "quickjs.h"

void js_sql_register(JSContext *c, JSValue insane);

#endif
