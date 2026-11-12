/* dotdeb_admin.h — DotDeb, the official Insane OS app store: one closed action that installs a
 * Debian package of the shipped catalog. JS names an entry of the catalog, never a command or a URL. */
#ifndef INSANE_PKG_DOTDEB_ADMIN_H
#define INSANE_PKG_DOTDEB_ADMIN_H
#include "../admin.h"

void pkg_act_dotdeb_install(const AdminReq *r, const char *arg, size_t len);

#define DOTDEB_ADMIN_ACTIONS \
    { "dotdeb-install", pkg_act_dotdeb_install, A_FORK },

#endif
