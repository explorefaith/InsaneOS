# Insane OS Desktop Transformation — Architecture Plan

Mission: transform Insane OS into the reference experience (see
`docs/design/reference-video-analysis.md`) while respecting the existing
architecture. This plan maps the mission's phases onto concrete increments on
top of the audited stack (audit summary: one C11 compositor `insane-server`
embedding QuickJS + React shell; `insane.*` in-process APIs already cover
monitor/sound/net/bt/display/settings/wallpaper/notifications; sessiond +
greeter for boot/login).

## Non-negotiable constraints (from the mission + BUGS.md)

1. No second compositor, no wlroots/libdrm/libinput — the existing stack stays.
2. New **system** code is C11 (mission's 85% C rule). The shell's visual layer
   stays in the existing React/JSX theme stack — that is this OS's shell
   language, and the mission forbids rewriting working components.
3. Never hand-edit `~/.config/insaneos/settings.json` while a session runs
   (the shell rewrites it 300 ms after any change).
4. Blur is the perf-critical path (live wallpaper + 24 px glass blur on every
   window) — every visual addition is measured in the headless lab before it
   ships (BUGS.md slow-frame log).
5. New user-visible strings must exist in all 6 locales (en, es, fr, it, lt,
   pt) — `tools/i18n-check.mjs` fails the build otherwise.
6. Nothing deploys to the live system without its own explicit step
   (`fix/upgrade-insaneos.sh` backs up + REVERT). Lab verification first.

## Increment 1 — Island shell + Auto accent (this session)

The reference's two signature features:

1. **Island bar mode** (`settings.barStyle`, default `island`): the menu bar
   renders as the floating centered pill (video's Dynamic Island) instead of a
   full-width strip; `full` keeps today's bar. Settings → Desktop & Dock →
   Menu Bar gets the picker. Work-area reservation (MENU_H) is unchanged, so
   window management, panels and menus are untouched. Per-display behaviour,
   anchoring (`insane.getLayout`) and outside-click closing are preserved.
2. **Auto accent** (the wallpaper→shell retint): new C API
   `insane.media.accent(id)` in `server/src/ui/js_media.c` — decimated
   full-frame hue-bucket histogram (O(4096), saturation²-weighted,
   mid-luminance preference) over the same sources `pixels()` accepts. The
   shell calls it when `settings.accent === 'auto'`: live wallpapers sample
   the playing frame, static wallpapers decode once via `media.image('shell',
   …)` → accent → close. `tokens.js` tone-maps the result per mode (dark:
   L 0.62, light: L 0.44, saturation clamped) into `t.accent`; fallback is the
   OS violet when the server predates the API or no wallpaper resolved.
   Control Center gains the Auto chip; default accent becomes `auto`.

Also in Increment 1: deep-charcoal dark surfaces in `tokens.js` (menuBg,
panelBg pulled a step darker), and the accent dots become labelled pill chips
like the reference's theme row.

## Increment 2 — Real audio spectrum (planned next)

C: extend the sound/media layer with a sink-tap spectrum (shared-memory media
audio + PipeWire monitor tap → small FFT, `insane.sound.spectrum()`,
throttled). Shell: a desktop visualizer widget + Control Center strip driven
only by real audio data (mission §6), with a reduced-motion path and a
frame-budget check against the blur governor.

## Increment 3 — Island pages (planned)

The island's three pages from the reference, built on existing APIs:
- **System metrics page**: `insane.monitor` (4 Hz only-while-queried) → CPU/
  RAM/GPU/NET history graphs, per-core bars.
- **Weather page**: Open-Meteo fetch (cached, consent-gated, offline-safe),
  7-day rows; degraded gracefully to "unavailable" — never fake states.
- Control Center keeps today's toggles (they already map to real subsystems).

## Increment 4 — Settings + session polish (planned)

Appearance page expansion (accent presets incl. Auto, glass sliders already
exist), keyboard/shortcuts page against `insane.wm`/shortcut tables, lock
screen + greeter restyle pass, boot splash colour match.

## Verification protocol (every increment)

1. `cd server && make build/insane-server build/insaneos-testbench`
2. `node tools/build-theme.mjs default classic` (i18n gate included)
3. Headless lab from BUGS.md (scratch XDG_RUNTIME_DIR+HOME,
   `INSANE_HEADLESS_RENDER=1`, testbench --auto), then the scratch
   `~/.cache/insaneos/session.log` must show zero react errors and no new
   slow frames vs. the pre-change baseline.
4. `server/tests` targets that cover touched areas + REGRESSION_CHECKLIST
   relevant rows.
5. Commit per milestone with the failure-mode in the message (house style).
