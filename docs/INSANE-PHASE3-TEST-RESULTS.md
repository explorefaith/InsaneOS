# INSANE OS — Phase 3 test results

Everything ran for real on 2026-11-19; commands and counts quoted. The manual (live-desktop)
items are listed honestly at the end — the headless lab renders but has no pointer, radios,
battery, lid or second display.

## Build

- `make` (server): exit 0 after every C round (drain_jobs_armed, keygrab rows, sessiond fixes,
  mirror sleeplock) — binaries rebuilt clean, no new warnings.
- `node tools/build-theme.mjs default|classic|greeter`: exit 0 (3054 KB default bundle).
- `node tools/i18n-check.mjs`: es/fr/it/pt 12122/12122 keys; lt partial as documented;
  err-check 585 codes, 0 problems; brands ok.

## Automated tests

| Suite | Result |
|---|---|
| make test (C) | green except the 2 documented imager-signature failures (466 checks, 2 failed — predate all compositor work) |
| build/keygrab-test | `keygrab: ok` (walks the fixed grab tables incl. the new ❖arrows rows) |
| server/tests/desktop_model_test.mjs | green (the workspaces model, untouched) |
| tests/theme_studio_*.mjs | 111 + 60 + 1503 + 1241 checks passed |
| tests/widgetmodel_test.mjs | 9 checks |
| tests/autohide_model_test.mjs | 689/689 |
| tests/paneglyph_test.mjs | green |

## Headless compositor lab

| Run | After | Result |
|---|---|---|
| L5 | Phase 2 complete | 0 react errors |
| L6-L8 | shell round + WM round + session round | 0 react errors each; paint ≈ 10 ms; bench 47–56 fps |

## Manual (live desktop — the acceptance gate, after upgrade-insaneos.sh)

1. Window management: drag/resize/minimize/maximize/restore/close, snap halves/quarters (drag to
   edges + ❖arrows — new in Flow), center + Move & Resize from the window menu (new in Flow).
2. Workspaces: create/remove/switch/❖1…9/move a window/Overview drag/rename — verify persistence
   across logout and reboot.
3. The Overview over a fullscreen own-app (Player/Photos) — it now refuses; verify no regression
   for Linux fullscreen.
4. The island: date under the time, the network/audio glyphs opening the CC, the tray row inside
   the CC, the Dock's focused dot and click-to-minimize, the launcher's Recents + settings
   results.
5. Sessions: login, wrong-password feedback, the eye toggle, lock (monitor really leaves),
   unlock, switch user, logout, reboot/shutdown dialogs, suspend/resume on real hardware.
6. Autologin: with a deliberately broken theme bundle, the boot must land on the login screen
   (bounded retries) — never a dark display (G1/G2's fix).
7. Display: resolution/scale/rotation/primary/arrange/mirror on real panels; hotplug.
8. Hardware: Wi-Fi connect/roam, BT pair/connect, audio device switching, brightness, battery
   thresholds.
9. Notifications: banners, history, DND, the CC toggle.
10. A 30-minute stress pass (open 10+ windows, switch, snap, overview) watching the monitor's
    CPU/RAM/GPU rows for growth.
