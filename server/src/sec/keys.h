/* keys.h — official Insane OS public keys (Ed25519, in hex). Anything signed with one of these
 * keys is shown as "Insane OS"; the catalog (catalog.json) is only valid when signed by one of them.
 *
 * Today there's only one: the DEVELOPMENT key (packaging/keys/insaneos-dev.pub). Its private key is
 * not in the repository: it lives on the development machine, in ~/.config/insaneos-dev/insaneos-dev.key
 * (see docs/SIGNING.md). For a public release the final key is added and this one removed.
 * They're compiled into the binary on purpose: no file in the home folder can add
 * an official key. */
#ifndef INSANE_SEC_KEYS_H
#define INSANE_SEC_KEYS_H

static const char *const insaneos_official_keys[] = {
    "3deb68366612b82046761673f6d8936a10b87aa4dab52b90d5a7039354b7ddb7",     /* Insane OS (development) */
    NULL,
};

#endif
