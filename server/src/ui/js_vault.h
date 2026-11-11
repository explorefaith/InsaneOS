/* js_vault.h — insane.vault: Contraseñas y el llavero por el ayudante insane-vault (ver js_vault.c). */
#ifndef INSANE_JS_VAULT_H
#define INSANE_JS_VAULT_H

#include "quickjs.h"

void js_vault_register(JSContext *c, JSValue insane);

/* App process (insane-server --app): insane.vault on the app's own channel to insane-vault (INSANE_VAULT_FD). */
void js_vault_register_app(JSContext *c, JSValue insane);

#endif
