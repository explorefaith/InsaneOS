/* fgprio.h — the focused app's CPU share (round 3, "foreground application priority").
 *
 * When the keyboard moves to a Wayland app, that app's cgroup scope (app-insaneos-*.scope) gets
 * cpu.weight CG_FG_CPU_WEIGHT against CG_APP_CPU_WEIGHT for every other scope, and the previously
 * focused one goes back down. Plain CFS weights inside the session subtree: no real-time, no
 * isolation, nothing starves — under an all-core build the focused app keeps roughly four times an
 * unfocused app's share, and when the foreground sleeps the others run as before. The compositor
 * asks root (insane-sessiond's cgroup service, sec/cgroup.c) because the scopes are root-owned;
 * without insane-sessiond the whole feature quietly does nothing.
 *
 * Not eligible: the compositor's own leaf, Xwayland's (its windows' processes live elsewhere, so
 * the focused X11 app keeps the default weight — attribution cannot follow the X focus), helpers,
 * and anything outside this user's session subtree. */
#ifndef INSANE_SEC_FGPRIO_H
#define INSANE_SEC_FGPRIO_H
#include <sys/types.h>

/* The keyboard focus moved: the app surface's client pid, or 0 when it left the apps (the desktop,
 * the login screen). Cheap enough for every focus change: two /proc reads and two sysfs writes at
 * most, and only when the scope actually differs from the last one. */
void fgprio_focus(pid_t pid);
#endif
