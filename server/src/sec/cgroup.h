/* cgroup.h — each app goes into its own cgroup v2 (a "scope"), so the monitoring agent
 * attributes traffic and hardware by that name and so memory and CPU limits can be set on it.
 *
 *   app-insaneos-lpk-<id>.scope   isolated native .lpk apps (sandbox.c)
 *   app-insaneos-<id>.scope       Linux apps (.desktop) launched by apps.c
 *
 * Reusable: called in the freshly forked child, right before execve. insane-server runs
 * without root; it needs its cgroup subtree to be delegated (insane-sessiond prepares it, see
 * docs/SESSIONS.md and docs/PRIVACY.md). If that's not possible (no delegation, missing controller,
 * old kernel), it warns in the log and goes on without a cgroup: the app runs anyway, without limits. */
#ifndef INSANE_SEC_CGROUP_H
#define INSANE_SEC_CGROUP_H

#include <stddef.h>
#include <string.h>
#include <sys/types.h>

typedef struct {
    long mem_high_mb;       /* memory.high in MB (0 = no limit) */
    long mem_max_mb;        /* memory.max in MB (0 = no limit) */
    int  cpu_percent;       /* cpu.max as % of one core (0 = no limit; 100 = one core) */
    int  cpu_weight;        /* cpu.weight 1..10000 (0 = untouched; CFS share against the siblings) */
} CgroupLimits;

/* CPU weights inside the session subtree: the compositor's «server» leaf weighs ten apps, and the
 * app the user works in weighs four of the rest, so a build or a sync in another scope cannot take
 * the focused app's CPU. Plain CFS weights: no real-time, no starvation — an unfocused app always
 * keeps its share while the foreground is idle. The compositor asks insane-sessiond for the
 * focused scope's weight (fgprio.c); a wallpaper player enters at CG_WALLPAPER_CPU_WEIGHT. */
#define CG_FG_CPU_WEIGHT 400
#define CG_APP_CPU_WEIGHT 100
#define CG_WALLPAPER_CPU_WEIGHT 50

/* Moves the current process into scope `name` inside the session's delegated subtree and
 * applies the limits. 0 if it ended up in the scope; -1 if it couldn't (already warned, the caller goes on). */
int cgroup_enter(const char *name, const CgroupLimits *lim);

/* Shortcut for the child before execve: enters app-insaneos-<id>.scope with loose limits. The
 * launcher refuses to exec when it fails inside a Insane OS session. */
int app_scope_enter(const char *id);   /* 0 placed; -1 not (invalid scope name, refused or no answer) */

/* Scopes of Insane OS's own helpers (desktop:<id> in the firewall): a .desktop with that id must not inherit their rules.
 * "lpk-<x>": its scope would read as the package <x>, lpk:<x>, with that package's rules and grants. */
static inline int app_scope_reserved(const char *id) { return !strcmp(id, "insaneos-rclone") || !strcmp(id, "insaneos-cloud") || !strcmp(id, "insaneos-rdesk") || !strncmp(id, "lpk-", 4) || !strncmp(id, "insaneos-vm", 9); }

/* The cgroup v2 path of the current process, relative to /sys/fs/cgroup (e.g. ".../app.slice/..."),
 * so the monitor knows which scope it's in. "" if it couldn't be read. */
const char *cgroup_self(void);

/* Called by insane-sessiond (root) in a session's child, before insane-server's execve: creates the
 * session's cgroup subtree with memory/CPU/pids enabled and moves the process into its «server»
 * leaf. The subtree stays root-owned (cgroup_harden_session); app scopes are created later by
 * insane-sessiond on request (cgroup_place_serve). Best effort: without delegation (Delegate=yes in
 * insaneos.service) it warns and goes on. Returns 0 on success. See docs/SESSIONS.md. */
int cgroup_delegate_session(unsigned uid, unsigned gid);
/* cpu.weight of the session's «server» leaf (the compositor), against 100 for each app scope and helper */
#define CG_SERVER_CPU_WEIGHT "1000"


/* Called by insane-sessiond at startup (root, insaneos.service with Delegate=yes): moves itself to the
 * "supervisor" leaf so the service root can enable memory/CPU/pids for the
 * sessions' subtrees (cgroup v2's "no internal processes" rule). 0 if it did. */
int cgroup_service_init(void);

/* (0.8.5) Called by insane-sessiond in insane-netd's child, before its execve: moves the process into
 * the root-owned insaneos.service/<name> leaf (only "netd"), so insane-netperm can count the network
 * service's own traffic (DHCP, the VPN daemons) apart from insane-sessiond's. Best effort: 0 placed. */
int cgroup_service_leaf(const char *name);

/* (0.8.5) A root process of a session (the admin helper's download child, before it drops to
 * nobody) moves itself into scope `name` of its own session's subtree: insane-sessiond's placement
 * service only places session users, and root may write the root-owned cgroup.procs itself. Only
 * from the session's «server» leaf, only itself. 0 placed. */
int cgroup_enter_root(const char *name);

/* (0.8.5) A quarter of a second for insane-netperm to see a scope that was just created (it watches
 * the session folder with inotify) before the process in it opens a connection: otherwise the first
 * connections would meet no policy. Called after placing a process in a new scope that connects at
 * once (the Store's download child, the components' connectors). */
void cgroup_settle(void);

/* ---- Root-owned app scopes (insane-sessiond) ----
 * With insane-sessiond, a session's subtree stays root-owned: the scopes are created by root, with a
 * root-owned cgroup.procs, so an app cannot move itself to another cgroup (it would escape its
 * per-app firewall rules and accounting). cgroup_enter() asks insane-sessiond over CGROUP_SOCK to
 * place the calling process; without insane-sessiond (development) it self-migrates as before. */
#define CGROUP_SOCK "/run/insaneos/cgroup.sock"

/* 1 if insane-sessiond accepts creating this scope name. */
int cgroup_scope_name_ok(const char *name);

/* chown root:root a session subtree (insaneos-session-<uid>, its leaves and scopes). Root only. */
void cgroup_harden_session(int sessfd);

/* insane-sessiond: serve one connection on CGROUP_SOCK ("enter <scope> <memhigh> <memmax> <cpu%>").
 * Only a peer that is in its session's «server» leaf and runs a binary from bindir can be placed,
 * and only itself (SO_PEERCRED pid). Answers "ok" or "err <reason>". 0 if placed. */
int cgroup_place_serve(int cfd, const char *bindir, int insecure);

/* The compositor (from its «server» leaf) sets an app scope's cpu.weight — the focused app up, the
 * previously focused one back down (fgprio.c). One attempt, silent when refused or unanswered.
 * 0 applied, -1 not. */
int cgroup_weight(const char *scope, int weight);

/* The app-insaneos-*.scope the pid lives in, under this user's own session subtree (the same rule
 * appid.c applies, but the scope name itself, not the app id). 0 found, -1 not (the compositor's
 * own leaf, Xwayland's, a helper's or another user's — never eligible for the foreground weight). */
int cgroup_scope_of_pid(pid_t pid, char *out, size_t n);

#endif
