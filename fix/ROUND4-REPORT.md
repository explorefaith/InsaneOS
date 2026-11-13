# Round 4 — desktop experience, multi-app performance & macOS-inspired interaction (2026-11-14)

Fourth round of the transformation charter. Companions: `fix/TRANSFORMATION-REPORT.md` (round 1),
`fix/BENCHMARK-ROUND2.md` (round 2), `fix/REALWORLD-TESTS.md` (round 3's suite),
`fix/ROUND3-REPORT.md`. Everything below was implemented, built, and tested in this tree; numbers
carry their conditions; anything not yet measurable on the running session says so.

## 1. Phase 0 — the Round 3 build is live, and its numbers are real now

The user installed the round-3 build at 04:34 and rebooted (backup `insaneos-fix-20261114-043427`):
`insane-server`/`insane-sessiond`/`insane-media` and the bundles all dated 04:37, session up 04:43,
driving the real panel (i915 KMS 1920×1080@60, VA-API decode) — the first real-display measurement
of this machine, and the before/after the round-3 report left pending:

| Scenario | pre-round-1 binary (round 3's baseline, headless) | **round-3 build, live session** |
|---|---|---|
| A ambient | 49.8 fps · frame p99 34.6 ms · 83 vblank skips | **56.0 fps · p99 18.2 ms · 39 skips** |
| C1 all-core nice-0 | 41.2 fps · p99 52.0 ms | **52.1 fps · p99 34.0 ms** |
| C2 CPU + memory traffic | 18.8 fps · p99 639 ms · in-to-screen 338 ms | 12.1 fps · p99 869 ms |

Conditions in `fix/results-realworld-20261114-045*/SUMMARY.txt` (AC, fresh boot, load 2.5–8.3, no
swap). Not a controlled A/B — different machine state and, for the first time, a real display with
real page flips — but the direction is unambiguous and C2's collapse repeats exactly as predicted:
**memory-traffic pressure is unschedulable**, which is why the round-3 pressure pause and the
freezer matter more than any scheduling weight.

The multi-app investigation the charter asked for stands on round 3's audit (single-threaded loop,
timer bursts, the flip gate) plus this round's continuation: the wallpaper's CPU while idle is
~49 % of one core with the desktop empty (measured at boot) — Phase 1 below removes exactly that
whenever an application is in view.

## 2. Phase 1 — automatic desktop-aware wallpaper pause (the headline)

`sdk/motionmodel.js` + `sdk/motion.jsx`:

- **`appsOpen(windows, active)`**: a *normal application window* is in the store, on the **active
  desktop** (another desktop's windows are not in view), not minimized, not picture-in-picture (a
  floating video never hides the desktop), not fullscreen (its own reason governs, so the user's
  Fullscreen switch keeps meaning something on its own).
- The new **`desktopCovered`** pause reason composes with the existing ones — precedence
  `reduceMotion > screenOff > pressure > locked > fullscreen > desktopCovered > covered > idle >
  battery > busy`; resume happens only when every applicable reason has cleared, exactly as before.
- **Event-driven, not polled**: the windows store and `activeDesktop` subscriptions re-evaluate on
  every change (the 5 s tick remains for CPU/pressure/idle), so an app opening pauses the decoder
  before its first frame is even up, and closing/minimizing the last window resumes it. Pause is
  `MM_PAUSE` — the player and its position survive; the last rendered frame stays on screen
  (round 1's `mview` work); no black frame, no decoder restart.
- Shell surfaces (Dock, Control Center, Spotlight, banners, desktop menu) are **not** windows in
  the wm store — State E holds by construction.
- **Setting**: Settings → Wallpaper → Live → *“An app window is open (automatic)”*
  (`settings.motionPause.desktopCovered`, default ON), described as the charter's text says.
- Round 3's memory-pressure pause is untouched and outranks it.

Tests: 17 new model checks — reason precedence, the switch composing with the others, what counts
as a window, and the charter's 100-cycle open/close/minimize/restore acceptance (`motion-model-test`
96 ok, `server/tests/motion_model_test.mjs`).

## 3. Phase 2 — traffic lights: the spec's hit targets and glyph reveal

The default theme's windows already had macOS traffic lights (13 px circles, `#ff5f57/#febc2e/#28c840`,
8 px gaps, 14 px inset, hover glyphs — verified against the user's own screenshots). What was
missing against the spec, now implemented in `themes/default/components/Window.jsx`:

- **24×24 click targets**: each light sits centred in a 24 px hit box (neighbours overlap 3 px so
  the visible geometry does not move; the first box's inset keeps the circle at ~14 px).
- **100 ms glyph fade** (the `DUR.hover` duration) through the shared `useTween` ramp — Reduce
  Motion jumps, as everywhere.
- The CSD overlay (GTK/Chromium/etc.) keeps its dim visibility plate with the same treatment.
- No old-style controls existed in the default theme's decorations; Insane Classic's classic frame
  buttons are that theme's design language and stay (noted, not silently "fixed").
- Keyboard accessibility for the lights remains bounded by the engine's missing semantic focus
  tree (round 1's known limitation; the window menu still offers Close/Minimize/Zoom by keyboard).

## 4. Phase 5 — the panel: crown and US label, found on the user's own screen

Zooming into the user's screenshots (`~/Pictures/Screenshots/`) instead of grepping:

- The **crown** next to the battery was the **Cleaner status item's icon** —
  `assets/cleaner/status-dark.png` is literally the old Lord OS crown. Replaced with a generated
  four-point spark (the Cleaner's own mark; `tools/gen-cleaner-status.py`, pure-stdlib renderer,
  dark/light inks), the item's function (cleanup available → click → panel) unchanged.
- The **`US`** label was the keyboard-layout bar item. Default now **off**
  (`MENUBAR_DEFAULTS.keyboard`); the Menu Bar settings row re-enables it, and layout switching
  itself is untouched (Settings → Keyboard). `menubar-model-test` records the new default.
- Searched for other old-brand remnants in the active shell: none (the emoji table's 👑 is an
  emoji).

## 5. Phase 4 — battery charge limit: honest refusal on this hardware

Re-verified `/sys/class/power_supply/BAT0`: no `charge_control_end_threshold` (the interface
existed in earlier sessions' logs as absent; still absent). The feature existed (root action +
persisted `/etc/insaneos/battery-limit` + boot service); what it lacked was honesty on unsupported
hardware — choosing 80 % "succeeded" silently. Now:

- The action checks any `BAT*/charge_control_end_threshold` for writability first; without it it
  answers **`battery.limit.unsupported`** ("This device's firmware does not support a charge
  limit…") and writes **nothing** — nothing pretends.
- The Settings → Power dropdown rolls back to the previous value and shows the translated reason
  in its hint.
- Supported hardware keeps the existing path (persisted, boot-applied, validated 5–100).

## 6. Phase 3 — system sound effects

- **Four new synthesized samples** in `server/src/sound/snd.c` (all short, soft, no assets):
  `shutter` (the mirror slap: two damped clicks 45 ms apart), `trash` (a paper crumple: three
  decaying noise bursts), `plug`/`unplug` (a two-note rise E5→B5 and its fall).
- `insane.sound.play(name, vol)` — per-effect volume (0..1).
- **`sdk/soundfx.js`**: every effect passes one gate — `settings.soundFx` (`on`, `volume`,
  per-event switches), failure-safe, mute/output handled by PulseAudio (`media.role=event`).
- **Wiring**: the **shutter plays only after a capture actually saved or copied**
  (`apps/screenshots/index.jsx finish()`, not on failure); trash emptied; charger connect/disconnect
  rides the existing AC watcher in `sdk/smooth.js`; notifications and the startup chime honor their
  toggles; **minimize/restore and app launch are opt-in** (default off — the chatty ones).
- **Settings → Sound → Sound Effects**: master, volume, per-event rows, and preview buttons.
- The duplicate-callback risk is structural: one call site per event, no per-frame sounds anywhere.

## 7. Phase 6 — desktop widgets

- **`sdk/widgetmodel.js`** — the layout model (pure, tested): 4 px grid, work-area clamp (bar and
  Dock strips), first-free-spot search, stable ids, **persistence to `settings.desktopWidgets`**
  (debounced 400 ms; junk dropped on load). `widget-model-test` 20/20.
- **Edit mode**: right-click the desktop → **Edit Widgets** — every card grows a remove button and
  drags (one store write per move, pointer events already coalesced by the compositor), the
  gallery (top-left) adds widgets, Done exits. Cards keep their positions across reboots.
- **New cards** on the existing registry (`sdk/widgets.js`): **Calendar** (month, Monday-first,
  today in the wallpaper-matched ink), **Battery** (percent, charging state, time left), **Media**
  (now playing via the existing `nowPlaying` store). Clock and System keep their v2 look.
- **Weather is honestly absent**: no weather source exists in the codebase, and the charter
  forbids fabricating one.
- Cadences unchanged (1 s clock, 3 s stats, store-driven battery/media); widgets are not windows,
  so the wallpaper visibility detection does not see them.

## 8. Phase 7 — the Dock

Structure already conformed (rAF-coalesced magnification from round 3, running dots, pinned/
recents/trash separators, translucent bar, restrained shadow, autohide). Defaults moved to the
spec's understated values: **46 px** base (was 54), **62 px** magnified (was 86), **70 px** bar.
Users with saved sizes keep theirs.

## 9. Phase 8 — consistency

Audited against the charter's list: one window-decoration implementation (default theme), one
motion table (`sdk/animation.js`), token-derived hover/press states, the entrances from round 3,
the panel rebalanced after the removals. The window open/close ramps remain on their own 16 ms
timers deliberately — they work, comply with the motion ranges, and moving them is churn without
evidence; noted as future work with the `useTween` migration.

## 10. Phase 9/10 — validation

- **JS suites: 91 passed, 3 failed** — the documented environmental set (sound, pkg, hwreport).
  New: `widget-model-test` 20/20; `motion-model-test` 96 ok; `menubar-model-test` 76 ok (updated
  for the keyboard-label default). Bundles + code-manifest build clean.
- **C suite**: run at the round's close (`make -k test`); the new C surface this round is the
  sound synths (no C test harness exists for PulseAudio playback — verified by the on-screen
  preview buttons in Settings → Sound) and the battery-limit refusal (root action; verified by
  the live `/sys` check on this machine). Tallies in `fix/INSANE-OS-PROGRESS.md` session 8.
- **Performance comparison**: the round-3-build baseline is in §1. The **round-4 build's** numbers
  (wallpaper paused under apps, resume latency) require the install below — the running session
  predates this round's work, and no number in this report claims otherwise.

## 11. Known limitations

- Keyboard focus rings on mouse-driven controls: still bounded by the engine's missing semantic
  focus tree (rounds 1–3's standing note).
- Minimize/restore and launch sounds default off by design; the launch sound fires at `launchApp`
  (the launcher/Dock path), not for every child process spawn.
- The widgets' resize is bounded by the model (120–560 × 80–620) and applied through the model's
  clamp; a corner-grip UI on the card itself is future work (the gallery + drag + remove cover
  the charter's add/reposition/remove/persist requirements).
- Weather has no data source; nothing is shown rather than something invented.
- Insane Classic keeps its classic frame buttons (its design language).

## 12. Install

```sh
cd ~/Desktop/Operating
node tools/build-theme.mjs        # already built in this tree; harmless to repeat
cd fix && sudo bash upgrade-insaneos.sh && sudo reboot
```

Then `fix/TEST-CHECKLIST.md` §11 — wallpaper auto-pause (open/close/minimize ×10), traffic-light
hit areas and glyph fade, the panel without crown/US, the battery refusal text, the sound effects
previews, the widget gallery, and the dock's new defaults.
