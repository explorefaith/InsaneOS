/* vclient.h — insane-server side of insane-vault (see vault.c and docs/PASSWORDS.md).
 *
 * insane-server launches the helper once per session (fixed path: <this binary's folder>/insane-vault,
 * no arguments, minimal environment), hands it the vaults folder
 * (~/.local/share/insaneos/vault) and the socket already connected to the session D-Bus bus (for
 * Secret Service), and then talks to it over the control channel. A dedicated thread reads the
 * replies and events and leaves them in a queue that JS reads with vc_poll() (insane.vault.poll): the
 * compositor never waits for insane-vault. Decrypted data passing through here (what the UI shows)
 * is wiped from the C buffers as soon as it is delivered. */
#ifndef INSANE_VAULT_VCLIENT_H
#define INSANE_VAULT_VCLIENT_H

#include <stddef.h>
#include <stdint.h>

int   vc_available(void);                     /* 1 if the binary is present */
int   vc_start(void);                         /* launches it if not running; 0 on success */
/* Request (JSON) with optional fds (it takes ownership of them). Returns the id (> 0) or -1. */
int   vc_request(const char *json, size_t len, int *fds, int nfds);
/* Pending replies and events: [{"id":n,"kind":"rep"|"evt","data":{…}}] (malloc) or NULL. */
char *vc_poll(void);
void  vc_poll_free(char *s);                  /* wipes and frees what vc_poll returned */
int   vc_pending(void);                       /* requests without a reply */
/* Control (insane-server only) */
void  vc_lock_all(const char *why);           /* "screen", "switch", "logout", "idle" */
void  vc_session_password(const char *pass);  /* from insane-sessiond: open the session keyring */
int   vc_fido_attach(char *name, size_t n);   /* opens the first FIDO2 key and hands it to insane-vault */
void  vc_prompt_done(unsigned prompt, int ok);/* result of the Secret Service unlock prompt */
/* Dedicated channel for the sandboxed Passwords app process: returns the fd of the other end. */
int   vc_attach_app(void);
/* Private requests from insane-server's own C code (the broker's keyring op for .lpk apps,
 * src/sec/brokerkr.c), on the system channel: the reply never reaches the JS queue (vc_poll).
 * vc_request_private returns the id (> 0) or -1; vc_take_private returns the next reply (malloc'd,
 * NUL-terminated; the caller wipes and frees it) or NULL; vc_private_fd becomes readable when a
 * reply is waiting (for poll). If insane-vault dies, every open private request gets
 * {"error":"crash"}. */
int   vc_request_private(const char *json, size_t len);
char *vc_take_private(uint32_t *id, size_t *len);
int   vc_private_fd(void);
int   vc_private_pending(void);               /* private requests without a reply, or replies not taken */
/* A private request from a insane-server thread that may wait (never the main loop): 0 and the reply in *rep
 * (malloc'd; the caller wipes and frees it), -1 not sent or no reply within timeout_ms. */
int   vc_request_wait(const char *json, size_t len, char **rep, size_t *rlen, int timeout_ms);
/* fn(event JSON) on insane-vault's reader thread for every event ({"ev":"unlocked","v":"login"}…), before JS gets it */
void  vc_set_event_hook(void (*fn)(const char *json, size_t len));

#endif
