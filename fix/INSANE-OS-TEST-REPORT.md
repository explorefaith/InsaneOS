# INSANE OS — Test Report

## 1. System audit (verified facts)

| Area | Finding |
|---|---|
| OS | Debian 13.7 trixie, kernel 6.12.116+deb13-amd64 |
| Display server | Wayland (wayland-0) + XWayland (:0), custom C compositor insane-server |
| Compositor | insane-server 21 MB, 8 threads, real-time priority, damage-tracked painting |
| Session | user session via insane-sessiond (root) lending DRM + input to the session |
| GPU | Intel UHD 620, i915, VA-API iHD 25.2.3 — h264/hevc/vp9 hardware decode CONFIRMED (vainfo + session log) |
| CPU/RAM | i5-8365U 8T, 8 GB, NVMe 234 GB (203 free) |
| Boot | 23 s total, userspace ~5 s, 28 enabled services (lean), 0 failed units |
| Security | AppArmor 4.1 kernel-enabled (Y) with 105 profiles on disk; InsaneOS per-app firewall (insane-netperm) active; signed packages + verified system code; unattended-upgrades (security-only) enabled this pass |
| Desktop | Insane OS theme stack: menu bar, dock, Launchpad, overview, desktops, Control Center, widgets |

## 2. Automated test suite (upstream, run on this tree)

16 test binaries executed: mail-test 47,467/47,467 • cloud-test 2,279/0 • clean-test 1,097/0 •
lan-test 335/0 • outputs 136/136 • settings-hw 234/234 • vm 361+142+226+83/0 • bt 44/44 •
sqlc 77/0 • smartctl 48/0 • disktemp 18/0 • hwdec 11/11 • rdesk 72/0 • accel 45/45.
**Failures: 7 — all in rconnect-run-test (remote-connect sandbox), environmental: the live
system's insane-sessiond refuses cgroup scopes for out-of-session test children. None of the
19 files changed by this fork are in that test's sources (verified via mk/lan.mk).**

## 3. Static verification this pass

- All 17 patched JS/JSX files esbuild-parse clean
- code-manifest.json: 10/10 SHA-256 hashes match the built bundles
- Rebrand audit: 0 "InsaneOS" occurrences in display sources (lowercase internal paths/URLs kept by design)
- upgrade-insaneos.sh bash -n clean; sections [1/10]…[10/10]

## 4. Bugs caught and fixed before shipping (verification pass)

1. MenuBar: missing `useEffect` import → menu bar would crash on render
2. Control Center: missing `Button` import → panel crash on open
3. store.subscribe delivers no argument → auto power profile dead on arrival
4. Rebrand split the identifier `InsaneOSPage` → build failure (fixed as InsaneOSPage)

## 5. Requires the screen (cannot be verified headless)

Boot particles, login glass panel, live wallpaper motion, widget colour matching,
window open fade, dock/overview feel, multi-monitor behaviour. Checklist: TEST-CHECKLIST.md.

## 6. Known limitations (honest)

- Battery charge limit: hardware has no charge_threshold sysfs → auto-disabled
- rconnect-run-test: 7 environmental failures (see §2)
- Internal names (insane-* binaries, /usr/lib/insaneos, insaneos.org URLs, insane.* JS API) unchanged
  by explicit instruction; visible branding is 100 % Insane OS
- Content search, Universal Clipboard, Stage Manager: designed, not yet implemented
