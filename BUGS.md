# BUGS.md — the working ledger

One entry per bug: symptom, root cause (when known), what changed, verification, remaining risk.
Status vocabulary: **OPEN**, **IN PROGRESS**, **FIXED**, **WONTFIX**, **FOUND, NOT FIXED**.

## Environment (recorded at Phase 0, 2026-11-17)

- **Real hardware**, not a VM: Dell Latitude-class laptop, Intel Core i5-8365U (Whiskey Lake),
  Intel UHD Graphics 620 iGPU (`lspci` 00:02.0), 7.6 GiB RAM. All lag measurements are on this GPU.
- **OS**: Debian 13 base, kernel `6.12.117+deb13-amd64`.
- **Display**: InsaneOS's own stack — `insane-server` (DRM/KMS + evdev, own compositor) with a
  Wayland socket for native apps, Xwayland for X11, QuickJS + React for the shell UI
  (see `docs/ARCHITECTURE.md`). The live session runs as
  `/usr/lib/insaneos/bin/insane-server --headless 1280x800 --user explorearafat --theme … --shell …`
  (the session service's invocation; the user's visible desktop is this process).
- **Session log** (crash/lag evidence lands here): `~/.cache/insaneos/session.log` — the server
  re-freopens its stderr there shortly after startup.
- **Settings file**: `~/.config/insaneos/settings.json`, loaded once at shell start, rewritten from
  memory ~300 ms after any change. Never edit it while a session is running (see memory note).
- **Audio**: PipeWire, shared-memory path from insane-server (docs/MEDIA.md).
- **Lag context specific to this machine**: the desktop wallpaper is the live video
  (`insane-galaxy.mp4`, motionRate 100) and every app window is a glass surface
  (`themes/default/components/Window.jsx` `backdropFilter: blur(glassBlur=24px)`), so the blur
  never rests while the video beneath changes. Any blur-path fix must be measured against this.

## Build, run, verify

- **Build**: `cd server && make build/insane-server` (the whole tree builds per-directory;
  `make -n` a target to see its graph). Debug/ASan build: compile the same sources with
  `-g -O0 -fsanitize=address,undefined` into a separate build dir (see REGRESSION_CHECKLIST.md).
- **Run (lab, does not touch the live session)**: scratch `XDG_RUNTIME_DIR` + `HOME` with its own
  `settings.json`, then
  `./build/insane-server --headless 1280x800 --profile --timeout 30 --theme ../themes/default/theme.bundle.js --fonts ../assets/fonts --shell ../assets/shell`
  from `server/`, with `INSANE_HEADLESS_RENDER=1` (renders with no viewer) and the testbench
  `./build/insaneos-testbench --auto N` driving frames. Profile lines land in the scratch
  `~/.cache/insaneos/session.log`, not the terminal.
- **Deploy**: `sudo bash fix/install-blur-governor.sh` — backs up to
  `/var/backups/insaneos-blurfix-<ts>/` with a `REVERT.sh`, takes effect at next login.
- **Always-on slow-frame log**: any frame over 30 ms prints one line (max 1 per 2 s) to the
  session log: `slow frame: … (layout, paint, blur … shrink N, media, wayland, term, after the paint)`.

---

## A. Dock lag, freeze and crash — IN PROGRESS

**Symptom**: the auto-hide dock's reveal and hover lag extremely; "Remove from Dock" can freeze or
hang the whole screen; occasional crashes.

**Work so far** (2026-11-16/17, commit `3b621f64` on `stabilize/baseline`):

1. **Blur frame-budget governor** (`server/src/canvas.c|canvas.h`, `server/src/main.c render_frame`,
   `server/src/ui/paint.c`, `server/src/ui/js.c`): when the backdrop blur itself takes >35 % of the
   frame period for 2 frames, the blur's downsample steps up (4, then 8); after 120 light frames it
   steps back down, never under the floor the performance profiles set (`blur_shrink_floor` through
   `insane.setBlurQuality`). Lab-verified on this machine: blur cost collapsed 8.5 → 1.5 ms/frame.
   Deployed 2026-11-17 14:31 (backup `/var/backups/insaneos-blurfix-20261117-143145`).
2. **User still reports dock-open lag** on the governor build. Live log showed 40–190 ms loop
   stalls (`tp:` rows; normal 0.1–0.3 ms). Layout confirmed incremental (`layout_ok`), settings
   saves don't fsync, intermittent 33–48 ms frames are **not** media/wayland/term/blur — the chunk
   sits inside the bare paint walk. Suspects: the below-copy rebuild, canvas primitives, QuickJS GC.
3. **Slow-frame logger** added to `render_frame` (same commit): frames >30 ms print their breakdown
   to the session log. Build with the logger is `server/build/insane-server` (2026-11-17 21:19;
   `canvas-test` + `bench-test` green), **not yet installed** — the user must re-run
   `sudo bash fix/install-blur-governor.sh`, log out/in, reproduce, then the `slow frame:` lines
   name the next cost. Governor-only binary is what currently runs.

**Hypotheses still to test** (in order): paint-walk stall (above), dock reveal re-layout/rebuild
frequency, hover timers stacking, use-after-free on remove-while-hovered (ASan build needed),
hide-timer race.

**Verification standard**: no frame > ~20 ms during reveal/hover on the user's hardware;
"Remove from Dock" never blocks the UI > 100 ms; 500 hover/remove/add cycles clean under ASan.

**Remaining risk**: the governor trades blur sharpness for latency by design; if the user dislikes
the softening, the floor (Settings → Energy → rendering quality) is the lever.

## B. Crown (LordOS) logo next to the battery — FIXED

**Symptom**: an old LordOS crown PNG next to the battery in the top bar could not be removed.

**Root cause**: the Cleaner status item drew a crown asset hardcoded in the panel's status-item
code; a keyboard layout label also showed by default.

**Fix**: commit `0e6816eb` — the Cleaner status item draws a generated four-point spark now
(`tools/gen-cleaner-status.py` generated it, crown PNGs replaced) and the layout label is off by
default (Settings → Keyboard keeps it available). Order/spacing of the remaining items unchanged.

**Verification**: the user confirmed from their own screenshots (panel shows no crown).

## C. Shared auto-hide for the top bar — OPEN

**Requirement**: with any app window open, the top bar auto-hides like the dock; edge reveal;
hides 2–3 s after the cursor leaves. ONE reusable auto-hide component (edge trigger, delay timer,
show/hide animation) used by dock AND top bar; timer cancel/restart on re-enter; no stacked
timers; no hiding while a bar menu/popup is open; current behavior preserved when no window is
open; fullscreen apps handled. (After A is stable.)

**Status**: not started. Waiting on the dock/top-bar architecture notes (docs/ARCHITECTURE_NOTES.md).

## D. No way to uninstall installed apps — OPEN

**Requirement**: uninstall in the launcher context menu and/or Settings, integrated with the
existing package system; confirmation dialog; protection for system-critical apps; visible error
on failure; removal from the dock too; background run with progress so the UI never freezes.

**Status**: not started. Package system to integrate with: `.lpk` packages
(`server/src/sec/`, `tools/lpk.mjs`, per docs/PRIVACY.md) and apt for system packages — the exact
integration point is the first thing to establish.

## E. Settings layout and icons — OPEN

**Requirement**: content uses the window width responsively (no ~700 px dead column), multi-column
cards where sensible, one consistent monochrome vector icon set for sidebar + in-page icons,
consistent spacing on any resolution; fixed through the shared layout, not per-page hacks.

**Root cause identified**: `apps/settings/index.jsx` renders every page inside
`maxWidth: 680` (line ~804; a `980` exception already exists for Cloud). Shared primitives live in
`apps/settings/ui.jsx` (Stack, Section, SettingRow, …). Sidebar icons are unicode glyphs in
`Badge` (`index.jsx` GROUPS) — the "inconsistent, AI-looking" icons.

**Status**: fix planned: raise the shared max-width, add a responsive two-column arrangement in
`ui.jsx` for wide windows, one drawn monochrome icon component replacing the glyph soup.

## F. Wallpaper page restructure — OPEN

**Requirement** (top→bottom): category grids with full captions (ellipsis+tooltip allowed), then
Live wallpaper, then "Custom wallpaper" (image file) and "Custom live wallpaper" (video file or
URL). Keep the click-to-choose-destination dialog. Validate files, graceful bad-file handling,
async video loading.

**Current state** (`apps/settings/Wallpaper.jsx`): categories exist (nature/anime/cars) but
captions are truncated with no tooltip (PicTile/LiveTile, `maxWidth: 168`); **no custom image
picker at all**; custom video exists but is a small button inside the Live section; Glass section
sits last. Restructure + the missing custom sections is the work.

## G. Raw translation keys in the UI — OPEN

**Symptom**: Settings → Energy shows raw keys (`prefs.power.quality.auto/.balanced/.performance/.low`).

**Root cause identified**: `apps/settings/Power.jsx` QualityRow calls `tr('prefs.power.quality.*')`
directly (line ~76) — those keys are missing from the locale catalogs, and `tr()` falls through to
the raw key. Other pages use `tOptional(key) || 'English fallback'`, which is why only some pages
show raw keys.

**Status**: audit planned — enumerate every `tr(`/`t(`/`tOptional(` key across apps/ + themes/ +
sdk/, compare against `assets/locales/`, add the missing strings (English catalog first, shipped
languages where the key is visible). `tools/i18n-check.mjs` exists and will be extended/used as
the missing-key check so this cannot silently happen again.

## H. Sound and feedback — PARTLY DONE, IN PROGRESS

**Done** (commit `16e83572`): the sound-effects layer — synthesized samples (shutter, trash,
plug/unplug, …), `insane.sound.play(name, vol)`, `sdk/soundfx.js` gating everything behind
Settings → Sound → Sound Effects (master, volume, per-event, chatty opt-in); the shutter plays
only after a capture actually saved or copied; the charger note rides the AC watcher;
notifications and the startup chime honor their toggles.

**Remaining**: a shared spinner/progress component for any operation longer than ~300 ms
(uninstall, wallpaper loading, …) and an audit of which small actions still lack sound or
progress. No new audio backend, no new dependencies.

## I. Other small issues — LEDGER (FOUND, NOT FIXED)

- The worktree has the old `web/` site tree deleted but uncommitted (the new site lives in
  `website/`); not OS code — left untouched, the user decides when it lands.
- `imager-test` shows 2/466 crypto-check failures that predate all compositor work (known, do not
  chase).
- Widgets feature is out of scope for this task by definition.

## Assumptions and safe-path decisions

- The governor approach (soften blur instead of dropping frames) was chosen because the
  alternative — disabling glass during video wallpaper — changes the desktop's look without the
  user asking. Recorded per rule 7.
- `stabilize/baseline` carries the baseline tag `stabilize-baseline-20261117` (commit `0a257d37`).
  Bug fixes land as small commits on it, one bug per commit.
