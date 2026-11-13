/* fgprio.c — the focused app's CPU share, see fgprio.h. */
#include "fgprio.h"
#include "cgroup.h"

#include <stdio.h>
#include <string.h>

static char cur_scope[96];          /* the scope currently holding the foreground weight, "" none */
static int no_sessiond;             /* no insane-sessiond answered (development): don't try again */

void fgprio_focus(pid_t pid) {
    char scope[96] = "";
    if (pid > 0 && !no_sessiond && cgroup_scope_of_pid(pid, scope, sizeof scope)) scope[0] = 0;
    if (!strcmp(scope, cur_scope)) return;              /* the same app kept (or took back) the keyboard */
    if (cur_scope[0]) cgroup_weight(cur_scope, CG_APP_CPU_WEIGHT);      /* best effort, silent */
    cur_scope[0] = 0;
    if (!scope[0]) return;
    int r = cgroup_weight(scope, CG_FG_CPU_WEIGHT);
    if (r == -2) { no_sessiond = 1; return; }
    if (r) return;                                      /* refused this scope: the next focus tries again */
    memcpy(cur_scope, scope, sizeof cur_scope - 1);
    cur_scope[sizeof cur_scope - 1] = 0;
}
