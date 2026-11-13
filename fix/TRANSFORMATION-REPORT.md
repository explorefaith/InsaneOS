# Insane OS — Performance, Stability & Desktop-Experience Transformation Report

Session of 2026-11-13 (round 1 of the transformation charter, `fix.md`). Everything below is in
this tree, built and tested; on-screen numbers noted where they exist. Commits, oldest last:
`97186b7` (verified prior WIP) → `91399a6` (rebrand regressions) → `c69aaf2` (phases 1–2) →
`569eaa1` (phase 3) → `95c7cbb` (classic parity, docs).

## 1. What was changed

**Compositor (`server/src/`)**

- `main.c` — GPU frame failures go through `gpu_to_cpu` (sets `gpu_paused`) and the GPU retries
  with an exponential backoff (`gpu_retry_ms`: 1 s … 30 s); a `flip_pending` stuck > 2 s (wedged
  GPU) takes the dumb buffers back with a synchronous modeset (prior WIP, verified); the display's
  DPMS state drives `media_display_power` (below).
- `ui/js.c` — QuickJS interrupt handler + 3 s wall-clock budget on every event dispatch and promise
  job (never on bundle eval). A runaway script throws, logs with a stack, and the desktop survives.
- `ui/text.c` — the glyph cache wipes itself at 64 MB of bitmaps or 65536 entries (in place, no
  realloc; a caller's `Glyph *` reads as an empty glyph until the next lookup fills it).
- `ui/image.c` + `ui/paint.c` — the file-image cache's gc (runs with `tf_gc` in the paint pass)
  frees entries no frame has drawn for ~60 s once the cache passes 256 MB; `image_draw` reloads an
  evicted entry from its path, so nodes keep working across eviction.
- `media/media.c`, `media_int.h` — helper watchdog: a player with no message for 10 s (wedged
  decoder) is killed and reported exactly like a crash; `media_display_power` pauses/resumes the
  wallpaper and greeter players on DPMS (only the ones it paused); the zombie reaper no longer
  kill-spins on a pid a dispatch already waited for; every message refreshes the watchdog's clock.
- `media/mview.c` — a wallpaper's or the greeter's MediaView draws no background until its first
  frame exists (and while its ring rebuilds): the still wallpaper shows through instead of a black
  flash. Every other player keeps its black.
- `fw/rules.c`, `ui/js_monitor.c`, `sec/appid.c`, `sec/cgroup.c`, `sec/pwguard.c` — the rebrand's
  scope-prefix constants (15/11 for 17/13-byte prefixes) made **every per-app firewall rule fail to
  match**, gave Monitor app ids like `neos-fir`, and broke notification app names. Prefixes are
  measured (`sizeof`) now, so a rename cannot desynchronize them again.

**Wallpaper engine (`sdk/motion.jsx`, `apps/settings/Wallpaper.jsx`)**

- Retries grow (0.5 s, 1 s, 2 s, 4 s); a file that burns all four stays disabled across sessions
  (`motionDisabled` in settings) and its tile offers *try again* (`retryMotion`).
- The shipped motion catalog is the Wallpaper page's gallery again (it had been dropped — imported
  with no UI): five sections, verified downloads with progress, the two-destination apply dialog,
  remove, stopped→try again, still posters where the hardware is missing.
- The preview shows the player's own facts (hardware decode, the 30 fps cap, frames dropped); a
  user's own video is probed first (`userVideoProblem`, the heavy-video warning) and can go to
  either destination; the six "Pause when" switches have a page.
- All wallpaper/greeter `media.play` calls carry `fpsMax: 30` (prior WIP, verified).

**Design system (`sdk/`, `themes/`)**

- `sdk/animation.js` — `useTween` is the one rAF ramp (Reduce Motion honored by itself; `from:` for
  entrances; node shims for the scenes), with the interaction durations added (hover 100, panel
  160, fade 150, toggle 160, banner 240) and `easeOutBack`.
- `sdk/theme.js` — `deriveTokens`: every theme receives `accentHover/accentPress/accentSubtle`
  from its own accent and `shadowWindow/-Dim/Panel/Popup` + `scrim/scrimPanel` from its mode. The
  shadow literals repeated in six places are gone; banners' light palette comes from tokens.
- Controls: Button presses (accentPress + 2 % settle), the Toggle knob travels, Slider arrows
  (yielding to text fields).
- Control Center: Do Not Disturb and Night Light tiles (the Classic theme's own calls).
- Launchpad: arrow-key grid navigation with a roving selection, Enter opens, search ranked by
  Spotlight's scorer (`scoreText`), mode-aware scrim/search/chips.
- Notification banners slide in and fade (they popped in with none).
- Insane Classic's window frames got the same entrance/close ramps as Flow's.
- Desktop widgets' dates and SYSTEM label speak the interface language.
- `docs/DESIGN.md` documents the derived tokens and the motion system; `docs/WALLPAPERS.md` the
  display-power backstop, the watchdog, the retry policy and the transparent first frame.

## 2. Performance problems identified (audit highlights)

- The GPU failure path never set `gpu_paused` — one failed frame meant CPU composition until the
  next display resync (asymmetry with the flip-stall path).
- No QuickJS interrupt handler: a theme infinite loop froze the single-threaded compositor forever.
- Glyph cache and file-image cache grew without bound (CJK/emoji sessions, gallery sessions).
- Wallpaper decode continued at full rate with the screen off (DPMS) — only the JS rules paused it,
  and `screenOff` was never fed; no watchdog existed for a hung (not dead) helper.
- A wallpaper's MediaView painted opaque black between "playing" and the first frame.
- (Measured elsewhere, unchanged this round: GPU-late frames under all-core load on the Pi are the
  binding constraint; the buffer-age scissor is built but off by decision of the 0.8.7 run.)

## 3. Optimizations implemented

See §1. Stability-first, per the charter: every change above removes unbounded work or unbounded
memory, or shortens the time a failure is visible. Nothing renders more when idle: the image gc and
glyph wipe only run on thresholds; the watchdog's poll deadline only exists while a player plays.

## 4. How the live-wallpaper crash issue was addressed

Four layers, so no single failure is visible: (1) the still wallpaper is always drawn underneath
and the MediaView adds no black before its first frame; (2) crashes and hangs both reach the session
as the same "closed" event (the watchdog turns a hang into a crash report); (3) retries with growing
waits, then a persisted per-file disable with *try again* in Settings; (4) `hwOnly` stays absolute —
a helper that would decode in software exits, and the still image stays. The compositor itself
pauses the players when the screen is off, whatever the session's JavaScript is doing.

## 5. UI components redesigned

Wallpaper settings (catalog gallery), Control Center (+2 tiles), Launchpad (keyboard + scoring +
mode-aware surfaces), notification banners (motion + token light palette), Buttons/Toggles/Sliders
(press, knob travel, keyboard), Classic window frames (motion parity).

## 6. Before-and-after measurements

- Full C suite: `fw-rules-test` **16170/16181 → 16181/16181** (the 11 failures were the scope
  regression); `tzif-test` **1 mismatched zone → 0 different over 216 168 instants** (Lord_Howe,
  the 30-minute-DST case, was dead since the rebrand); `remote-sec-test` 395 → **396/396**.
- JS suites: menubar scene **14 failures → 0**, classic-taskbar **6 → 0**; 90 suites pass; the 4
  remaining failures (sound, pkg, hwreport, and `imager-test` in C) are pre-existing — see §8.
- InsaneBench (`insaneos-sysreport bench`) refuses to run on battery by design (reproducible
  conditions; this machine is at 28 %, powersave). The comparative run belongs on AC — the harness,
  `server/src/testbench` and `docs/BENCHMARK.md`'s conditions tables are the procedure. No numbers
  were invented to fill this section.

## 7. Tests performed

Full `make test` (C: fw-rules 16181, fwlists 8307/8307, cloud 2279, backup 220, gpustat 63, fwdest 99, voltage 35, nethist 22 checks; damage fuzz 12 seeds clean; npcompile 480 000 random decisions, npcompile 480 000 random decisions, timer-order 427 538
callbacks, tzif 216 168 instants, mview, hwfall, wallpaper-find/-admin/-image, media-wallpaper…),
`tests/run_suites.sh` (90 JS suites), the menubar and classic-taskbar scenes (63 checks), theme
bundle build (all apps), three code-manifest-verified bundles. The motion-model suite covers the
new `hwCodecs` split (52 checks).

## 8. Remaining limitations

- `imager-test`: `release-SHA256SUMS.sig` does not verify against the repo's public release key
  (pre-existing at `000142d`). Re-signing the fixture needs the release private key; the assertion
  was not weakened.
- sound/pkg/hwreport JS suites fail on this machine for environmental reasons recorded before this
  session began (they pass in the release environment).
- `clean-test` is nondeterministic on this machine (different checks fail per run; reproduced at the
  pre-session commit `e5d75c8`) — timestamp/state races in the test's throwaway folder, not in the
  cleaner's code paths this session touched.
- InsaneBench before/after on this laptop awaits AC power (battery guard is a feature).
- No focus-visible rings on mouse-driven controls yet (the engine has no semantic focus tree — only
  TextInput, menus, Spotlight, StartMenu and now Launchpad are keyboard-first).
- Performance profiles change CPU/IO policy (power-profiles-daemon) but no render-side knobs yet
  (blur quality/frame rate follow effects and Reduce Motion instead).
- The Pi's GPU-late frames under load (BENCHMARK.md) are untouched this round.

## 9. Known issues

- The JS watchdog budget (3 s) interrupts a single legitimate JS task that runs longer — none is
  known in the shipped themes; if one appears, it surfaces as a logged exception, not a freeze.
- The glyph wipe re-rasterizes the visible text (a few ms) at the 64 MB crossing; it has never been
  observed to cross in a normal session.
- Classic's snap-layouts hover still uses its own 550 ms/3000 ms waits (interaction waits, not
  motion durations; left as they were).

## 10. Build and install

```sh
# build dependencies (Debian 13) — README.md's list
cd server && make -j"$(nproc)" && make test      # compositor, helpers, tests
cd .. && npm ci && node tools/build-theme.mjs    # the theme and app bundles
cd fix && sudo bash upgrade-insaneos.sh && sudo reboot   # install on a running Insane OS machine
```

The upgrade script backs up everything it replaces to `/var/backups/insaneos-fix-<time>/` with a
one-command `REVERT.sh`. On-screen checklist: `fix/TEST-CHECKLIST.md`.
