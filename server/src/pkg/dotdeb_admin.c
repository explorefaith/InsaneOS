/* dotdeb_admin.c — DotDeb's install action (apps/dotdeb, the official Insane OS app store).
 *
 *   dotdeb-install "<id>"    installs the Debian package of catalog entry <id>
 *
 * The catalog (assets/dotdeb/apps.json, shipped in the package and read here as root) carries, per
 * entry, the Debian package names. JS names an entry, never a command: the package list is validated
 * against a closed charset here, and apt-get runs with a fixed argv — no shell, nothing from JS. The
 * child streams apt-get's own output to the app through fd 3, so the store shows the real progress.
 */
#include "dotdeb_admin.h"
#include "../sec/json.h"

#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

#define DOTDEB_CATALOG "/usr/lib/insaneos/assets/dotdeb/apps.json"
#define MAX_PKGS 8
#define MAX_PKG_NAME 48

static const JVal *get(const JVal *o, const char *k) {
    if (!o || o->type != J_OBJ) return NULL;
    for (const JVal *m = o->kid; m; m = m->next) if (!strcmp(m->key, k)) return m;
    return NULL;
}
static const char *str(const JVal *o, const char *k) {
    const JVal *v = get(o, k);
    return v && v->type == J_STR ? v->str : NULL;
}

/* A Debian package name: lowercase letters, digits, + - . ~ (Policy's charset, without : and /). */
static int pkg_ok(const char *s, size_t n) {
    if (!n || n >= MAX_PKG_NAME) return 0;
    for (size_t i = 0; i < n; i++) {
        char c = s[i];
        if (!((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '+' || c == '-' || c == '.' || c == '~')) return 0;
    }
    return 1;
}

static int id_ok(const char *s, size_t n) {
    if (!n || n > 48) return 0;
    for (size_t i = 0; i < n; i++) {
        char c = s[i];
        if (!((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-')) return 0;
    }
    return 1;
}

void pkg_act_dotdeb_install(const AdminReq *r, const char *arg, size_t len) {
    (void)r;
    if (!len || strlen(arg) != len || !id_ok(arg, len)) { admin_err("admin.invalidArgument", NULL); return; }
    int fd = open(DOTDEB_CATALOG, O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
    if (fd < 0) { admin_err("dotdeb.noCatalog", NULL); return; }
    struct stat st;
    char *buf = NULL;
    const char *pkgs = NULL;
    JDoc d;
    if (!fstat(fd, &st) && S_ISREG(st.st_mode) && st.st_uid == 0 && st.st_size > 0 && st.st_size < (1 << 20) && (buf = malloc((size_t)st.st_size + 1))) {
        ssize_t got = read(fd, buf, (size_t)st.st_size);
        if (got == st.st_size && !json_parse(buf, (size_t)got, &d, NULL, 0)) {
            for (const JVal *it = get(d.root, "items") ? get(d.root, "items")->kid : NULL; it && !pkgs; it = it->next) {
                const char *id = str(it, "id");
                if (id && !strcmp(id, arg)) pkgs = str(it, "packages");
            }
        }
    }
    close(fd);
    if (!pkgs) { free(buf); admin_err("dotdeb.unknownApp", "id", arg, NULL); return; }

    /* the entry's package list, validated against the closed charset */
    const char *argv[6 + MAX_PKGS] = { "/usr/bin/apt-get", "install", "-y", "--no-install-recommends" };
    int a = 4, count = 0;
    const char *p = pkgs;
    char names[MAX_PKGS][MAX_PKG_NAME];
    while (*p) {
        while (*p == ' ') p++;
        const char *e = strchr(p, ' ');
        size_t n = e ? (size_t)(e - p) : strlen(p);
        if (!pkg_ok(p, n) || count >= MAX_PKGS) { free(buf); admin_err("dotdeb.badPackage", NULL); return; }
        memcpy(names[count], p, n);
        names[count][n] = 0;
        argv[a++] = names[count];
        count++;
        if (!e) break;
        p = e + 1;
    }
    argv[a] = NULL;
    free(buf);
    dprintf(3, "installing %d package%s with apt-get\n", count, count == 1 ? "" : "s");
    dup2(3, 1);                                     /* apt-get's own progress streams to the app */
    dup2(3, 2);
    execv(argv[0], (char *const *)argv);
    _exit(127);                                     /* exec failed: the pipe closes, the app sees it */
}
