/* netd.c — insane-netd: Insane OS networking belongs to the system, not to a session (docs/NETWORK.md,
 * "The network belongs to the system").
 *
 * insane-sessiond starts it at boot (fixed path next to its own binary, root-owned and not writable
 * by others), with no arguments, and restarts it if it exits. It brings the network up before
 * anyone logs in (DHCP, saved Wi-Fi, /etc/insaneos/net/if configs, DNS), so the greeter shows the IP
 * and the remote desktop is reachable, and keeps it up while sessions come and go. It is admin.c
 * built with INSANE_NETD: its table has only the net-* actions (same validation), served on
 * /run/insaneos/netd.sock, a 0600 socket that only the sessions' root helpers connect to. It runs
 * nothing beyond what those actions already run (wpa_supplicant, openvpn, charon, pppd, resolvectl,
 * networkctl… at fixed paths). */
#include "../admin.h"

#include <stdio.h>
#include <string.h>
#include <unistd.h>

int main(int argc, char **argv) {
    (void)argv;
    if (argc != 1) { fprintf(stderr, "usage: insane-netd (no arguments; started by insane-sessiond)\n"); return 2; }
    if (geteuid() != 0) { fprintf(stderr, "insane-netd: must run as root\n"); return 1; }
    setvbuf(stderr, NULL, _IOLBF, 0);
    return admin_netd_serve();
}
