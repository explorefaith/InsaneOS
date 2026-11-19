# INSANE OS — Phase 3 bug tracker

Every discovered issue with its actual resolution. The findings' evidence lives in
[INSANE-PHASE3-ARCHITECTURE.md](INSANE-PHASE3-ARCHITECTURE.md) (sections 7–9 + the agent
reports). Status: DISCOVERED → INVESTIGATING → FIXING → FIXED → TESTING → VERIFIED → BLOCKED.

## Round 1 — the independent audit agents

### WM/workspace agent (10 findings)

| ID | Sev | One line | Status | Evidence |
|---|---|---|---|---|
| W1 | P1 | drag-end job drain ran without the interrupt budget — a runaway promise chain froze the compositor | VERIFIED | drain_jobs_armed (js.c), server rebuild clean, C tests green (only the 2 documented imager failures) |
| W2 | P2 | Insane Flow had no ❖arrows snapping and no drag-to-edge snap | VERIFIED | snap: true + shortcuts entry + keygrab rows for both flow tables; keygrab-test ok |
| W3 | P2 | Meta+Alt+B ran a no-op (the top bar is gone) | VERIFIED | entry + import removed |
| W4 | P2 | the Window-menu feature set unreachable in Flow (Move & Resize, arrange, center) | VERIFIED | the CSD window menu carries Center + moveResizeItems |
| W5 | P2 | the JS drag-out path clamped only the top — a maximized window could vanish | VERIFIED | wm.move clamps all sides with grab.c's 48 px keep |
| W6 | P3 | KG_TAKE shortcuts fire over a fullscreen Linux app | VERIFIED FIXED (round 3: wl.c gates TAKE over fullscreen; ⌥F4/⌃⇧Esc remain the escape hatches) |
| W7 | P3 | the CSD resize fallback had no upper clamp | VERIFIED | display-bounded in sdk/wayland.js |
| W8 | P3 | the PiP frame could leave the screen | VERIFIED | 48 px keep within its display |
| W9 | P3 | the Overview opened over an own-app fullscreen window | VERIFIED | blocked() checks own fullscreen on the active desktop |
| W10 | P3 | F4/F12 die over Linux windows | WONTFIX (documented trade-off: a global grab would break F4/F12 inside Linux apps; ❖ is the desktop's key everywhere) |

### Shell agent (11 findings)

| ID | Sev | One line | Status |
|---|---|---|---|
| S-1 | P2 | the island clock showed no date | VERIFIED (a one-minute date ticker under the time) |
| S-2 | P2 | the island had no network/audio status | VERIFIED (two drawn glyphs opening the CC) |
| S-3 | P2 | the tray component was dead code (7 registered status items rendered nowhere in Flow) | VERIFIED (StatusItems + PrivacyIndicators render in the Control Center) |
| S-4 | P2 | the Dock's running dot didn't mark the focused app | VERIFIED (accent, wider) |
| S-5 | P2 | a Dock click never minimized a focused single-window app | VERIFIED (mirrors Classic) |
| S-6 | P3 | the launcher had no recents | VERIFIED (a Recent row from the Dock's recording) |
| S-7 | P3 | the launcher search had no settings shortcuts | VERIFIED (the settings rows under the grid) |
| S-8 | P3 | Classic's bar showed no battery | VERIFIED (a battery button opening Settings → Power) |
| S-9 | P3 | Classic's desktop context menu missed the new entries | VERIFIED (ported) |
| S-10 | P3 | runShortcut bypassed the when guard | VERIFIED |
| S-11 | P3 | stale "left edge" comments | VERIFIED |

### Session/lock agent (9 findings)

| ID | Sev | One line | Status |
|---|---|---|---|
| G1 | P1 | the autologin worker restarted unconditionally — infinite session attempts or infinite monitor re-lends | VERIFIED (bounded at 3, 20 s apart, stops after the first show; then the login screen) |
| G2 | P1 | a theme bundle that throws at boot returned −1 before fallback/recovery — a permanent dark greeter | VERIFIED (every load failure walks fallbacks + recovery) |
| G3 | P2 | a failed greeter lend left a dark display with nothing scheduled | VERIFIED (+2 s retry) |
| G4 | P2 | a login worker killed without replying wedged the greeter busy forever | VERIFIED (login_replied flag; the reap answers the error) |
| G5 | P2 | sleeplock_monitor_taken dead code — the inhibitor released after 4 s, not on undisplay | VERIFIED (mirror.c's RP_UNDISPLAY calls it) |
| G6 | P3 | lock/switch parsed by substring | VERIFIED (field compare, like power/display) |
| G7 | P3 | an invalid username answered busy | VERIFIED (answers fail) |
| G8 | P3 | no password visibility toggle on the greeter | VERIFIED (the eye beside the submit arrow) |
| G9 | P3 | the autologin loop spammed session logs | VERIFIED (one line per bounded retry) |

## Round 2 — display/GPU/hardware/performance (self-audit, the quota-limited agent's scope)

No new defects. What was verified with quoted paths:

| Area | Finding | Status |
|---|---|---|
| GPU fallback | every init failure (no-3d, no-gbm, no-egl, no-config, no-context, software renderer, shaders) prints its reason and composes on CPU — gpu.c:498-556's `goto fail` chain; a black screen is unreachable from GPU init | VERIFIED |
| Resolution/hotplug | `display_take_resync()` → `outputs_apply()` between frames (main.c:2795); a failed new configuration restores the previous one (`display_resync_done`'s undo, display.c) | VERIFIED |
| Startup | display attach and outputs apply run before the theme eval; the boot splash hand-off covers the gap; sessiond's boot-time test measures it (bootSeconds) | VERIFIED |
| Unmanaged timers | swept every `setInterval(` in themes/sdk/apps: all effect-cleared, self-stopping (fade/backdrop), refcounted (crypto want, trash, tickers) or cheap-and-gated (motion's 5 s evaluate runs only with a player; diskwatch: 30 s temps, 6 h health) | VERIFIED (no bare runaway interval) |
| Wi-Fi/BT/audio | the settings apps drive the real paths (net-wifi-* through netd, bt store + agent, the sound state) | VERIFIED (Phase-2 shapes + NETWORK.md) |

## Round 3 — the two ledgered decisions made, L4 closed

| ID | Sev | One line | Status |
|---|---|---|---|
| W6 | P3→FIXED | over a fullscreen Linux app the TAKE shortcuts reach the app (invisible windows no longer acted on); ⌥F4 and ⌃⇧Esc stay taken — the two escape hatches | VERIFIED (wl.c gate; keygrab-test ok; server rebuilt) |
| W10 | P3→WONTFIX (documented) | F4/F12 over Linux windows — taking them globally would break F4/F12 inside Linux apps (devtools); ❖ remains the desktop's key everywhere | CLOSED as a documented trade-off |
| L4 | — | TS widgets now drag on the real desktop: right-click → Arrange widgets (while a theme is live), dashed borders, live tsMove per frame, Esc leaves, one undo step per desktop drag through tsDesktopUndo → the Themes page's history | VERIFIED (build + lab zero errors) |

## Open (ledgered, not bugs)

- W6's general fullscreen-over-TAKE policy and W10's F-key grabs: UX decisions, not mechanical
  fixes — changing them changes what keys reach Linux apps.
- The display/GPU/hardware/performance agent is still walking (round 2 pending).
