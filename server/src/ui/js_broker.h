/* js_broker.h — lado app del broker (ver appclient.c, sec/broker.h). Provee el objeto `insane` del
 * proceso de la app: las primitivas de dibujo (locales) más fs/clipboard/perms, que van por el
 * broker a insane-server, que verifica los permisos. */
#ifndef INSANE_JS_BROKER_H
#define INSANE_JS_BROKER_H

#include "quickjs.h"

int  js_broker_fd(void);              /* fd del broker para poll; -1 si no hay */
void js_broker_poll(void);            /* mensajes del servidor sin pedir (indicadores, tema) */
int  js_broker_pending(void);         /* events queued during an RPC, not dispatched yet */
int  js_broker_companion_fd(void);       /* the socket to the companion, or -1 */
void js_broker_companion_read(void);     /* it has something: → __insaneBrokerEvent("companion", data) */
void js_broker_set_pkgdir(const char *dir, int system);   /* before the sandbox; system: assets/sysapps */
int  js_broker_code_refused(void);    /* the system app's app.js was refused (verified code) */
int  js_broker_wants_network(void);   /* la app declaró `network` y lo tiene permitido */
void js_broker_register(JSContext *c, JSValue insane, const char *app_id);
/* insane.appWindows: the app's own windows (app/appclient.c, docs/PRIVACY.md) */
void app_windows_register(JSContext *c, JSValue insane);

/* RPCs over the broker for the app-side modules (js_brokercam.c). rpc_fd returns the passed fd
 * (or -1) and copies the reply text to info; js_broker_send does not wait for a reply. */
#include <stddef.h>
#include <stdint.h>
int  js_broker_rpc(int op, const void *payload, uint32_t len, int *status, char **out, uint32_t *outlen);
int  js_broker_rpc_fd(int op, const void *payload, uint32_t len, char *info, size_t n);
int  js_broker_send(int op, const void *payload, uint32_t len);
/* the same RPC passing fds (SCM_RIGHTS, at most 16) with the request: files for insane-maild */
int  js_broker_rpc_fds(int op, const void *payload, uint32_t len, const int *fds, int nfds, int *status, char **out, uint32_t *outlen);
/* insane.mail of the isolated system Mail, Calendar, Contacts and Reminders (js_brokermail.c) */
void js_brokermail_register(JSContext *c, JSValue insane, const char *app_id);
void js_brokermail_chunk(const char *data, size_t len);
/* insane.media of an isolated app: the camera (js_brokercam.c) */
void js_brokercam_register(JSContext *c, JSValue insane);
void js_brokercam_event(const char *data, size_t len);

/* Passwords (app mode): ask insane-server to hand the FIDO2 key to insane-vault (see js_broker.c). */
int js_broker_vault_fido(char *name, size_t n, char *err, size_t en);

#endif
