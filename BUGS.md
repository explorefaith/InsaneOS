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

## A. Dock lag, freeze and crash — FIXED (both halves verified on the live desktop)

**Live-desktop verification (2026-11-18, user-confirmed)**: after `fix/upgrade-insaneos.sh`
deployed the fixed bundle (`2deb7ed2…`, byte-identical to the repo build), Remove from Dock
works — repeatedly, no freeze, no black screen — and the live session log carries zero react
errors. Bug A is closed.

**Symptom 1 (lag)**: the auto-hide dock's reveal and hover lagged; fixed by the blur frame-budget
governor (below) — the user confirmed the lag is gone on the deployed build (2026-11-17).

**Symptom 2 (Remove from Dock freezes/black screen) — ROOT CAUSE FOUND & FIXED (2026-11-18)**:
**React error #185 (maximum update depth exceeded)** in the shell. The Dock component published
its icons' screen rects (`dockIconRects` — the minimize genie's targets) from an effect with no
deps that called `dockIconRects.set()` **synchronously inside React's passive phase**. After an
unpin the rects legitimately differ on every pass (one icon fewer, the poof, the glide, the
hide-slide, the magnification), so the set forced a synchronous re-render of the store's readers
(`useSyncExternalStore`), whose effects measured again and set again — the nesting climbed 50
deep, React raised #185, and the reconciler **unmounted the shell's root**: one empty frame
painted, the screen went black and stayed black, the inputs had nowhere to go. The compositor
stayed healthy the whole time (the frozen-state gdb capture shows the main loop idling in
`poll(timeout=16)`), which is why ASan, dmesg and the journal all came up empty — the bug was
pure JavaScript.

**How it was found**: the session log survived a restart (rotation), the frozen state was
captured live by `fix/hang-watchdog.sh` (gdb + connector map, `results/hang-bt-captured.txt`),
the ASan build cleared the C side, and a lab reproduction harness (a temporary
`settings.benchUnpin` hook driving pin/unpin cycles) died on its **first** unpin with the same
signature — then an unminified bundle (`UNMINIFIED=1 node tools/build-theme.mjs`) named the
exact stack: `commitPassiveMountOnFiber → dock.js store set → forceStoreRerender → #185`.

**Fix** (`themes/default/components/Dock.jsx`): the publish moves one animation frame out of the
passive phase — `requestAnimationFrame(() => dockIconRects.set(...))` publishes the newest rects
as a fresh update instead of a nested one; the genie reads them a frame later (imperceptible)
and the per-frame cost is unchanged (the 0.5 px compare already skipped no-op sets).

**Verification**: the lab harness died on unpin #1 before the fix (React #185 logged, ASan
clean, 2–3 frames total) and ran **400/400 cycles alive with zero react errors** (829 frames,
layout 0.17 ms / paint 5.65 ms average) after it; the shipped minified bundle boots clean
(68 frames, no errors). Model tests green. **Manual**: Remove from Dock on the live desktop —
repeatedly, on a hovered dock, with an app running (REGRESSION_CHECKLIST).

**Work so far on symptom 1** (2026-11-16/17, commit `3b621f64`): the blur frame-budget governor
(`server/src/canvas.c|canvas.h`, `main.c render_frame`, `ui/paint.c`, `ui/js.c`) — the blur's
downsample steps up when the blur itself eats >35 % of the frame period, steps back down after a
light stretch, never under the performance profiles' floor. Lab-verified: blur 8.5 → 1.5 ms.
Deployed; the user confirmed the dock lag is gone. The governor's remaining trade-off: it softens
the blur's sharpness while it rides high — the floor (Settings → Energy → rendering quality) is
the lever if the softening bothers anyone.


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

## D. No way to uninstall installed apps — FIXED; the first deploy carried a REGRESSION, now fixed

**The regression (caught on the live desktop 2026-11-18 01:16, fixed same night)**: the uninstall
sheet's state (`uninst`) was declared BELOW the keyboard effect whose deps array names it — a deps
array is evaluated at call time, so every Launchpad render raised the temporal-dead-zone
ReferenceError (`M is not initialized` in the minified bundle), React unmounted the root, and
**opening the launcher or an app killed the shell with a black screen**. My lab verification had
never mounted the Launchpad, so it missed exactly this. Fix: the states are declared before the
effect (Launchpad.jsx), and the lab now mounts the launcher at boot (`benchLaunchpad` flag,
verified clean: 106 frames, zero errors) — the mount is part of the check from now on. Lesson
recorded: a UI change's verification must mount every component it touched, not just the flows it
intended to test.

**Requirement**: uninstall in the launcher context menu and/or Settings, integrated with the
existing package system; confirmation dialog; protection for system-critical apps; visible error
on failure; removal from the dock too; background run with progress so the UI never freezes.

**What existed already**: the plumbing — `packages.remove(id)` for `.lpk` (sdk/packages.js, closes
the app's windows, forgets permissions and share grants) and the Store's `pkg-remove` admin action
for Debian apps (server/src/pkg/pkg.c plan + apt/dpkg). The Store could remove, but the **launcher
had no uninstall** (its context menu was Open / Keep in Dock only), and neither flow had a
confirmation dialog.

**What changed**:
1. `sdk/packages.js`: `canUninstall(a)` — what the shell may offer ('package' for a `.lpk` not
   owned by a Debian package, 'linux' when a Debian package brings the app's `.desktop`, null for
   built-ins and everything else) and `uninstallApp(a, onProgress)` — resolves `{ ok, error }`,
   never blocks the caller, rides the helper's `progress <phase> <done> <total>` lines the same way
   the Store's job view does. Built-ins are never removable (docs/SIGNING.md "Verified system
   code"); a `.lpk` that arrived inside a Debian package is that package's business — the Store's
   own line, kept.
2. `themes/default/components/Launchpad.jsx`: the context menu gains **Uninstall** only when
   `canUninstall` says so; choosing it opens a confirmation sheet (icon, name, what stays — the
   app's data is never deleted) with Cancel / destructive Uninstall; while a Debian removal runs,
   a progress bar shows (phases → percent); failure shows the translated error
   (`uninstall.unsupported` and the helper's codes through `errorText`); success plays the gated
   `trash` feedback (Settings → Sound → Sound Effects governs it). The sheet owns the keyboard
   while open (Enter could otherwise launch the app behind it), Esc closes it, the launcher only
   closes when the sheet is not busy.
3. Dock removal is automatic: the entries derive from the app registry, which both paths refresh
   (`refreshPackages` / `refreshApps`).

**Verification**: `node tools/i18n-check.mjs` and `node tools/build-theme.mjs` exit 0 (the new
keys exist in en/es/fr/it/pt; the bundle builds). **Manual (REGRESSION_CHECKLIST)**: right-click a
`.lpk` app in the launcher → Uninstall → confirm → app gone from launcher and dock, windows
closed; same for a Linux app with the progress bar; a built-in (Settings, Files) shows no
Uninstall item; a running app's removal closes its windows.
**Remaining risk**: `uninstallApp` for `.lpk` is synchronous inside the promise (a very large
package could stall a frame or two); the Store keeps its own no-confirm remove buttons — left
untouched (their behavior is pre-existing; a confirm there is a separate decision).

## E. Settings layout and icons — FIXED (code), needs visual verification

**Requirement**: content uses the window width responsively (no ~700 px dead column), multi-column
cards where sensible, one consistent monochrome icon set for sidebar + in-page icons, consistent
spacing on any resolution; fixed through the shared layout, not per-page hacks.

**Root cause**: `apps/settings/index.jsx` rendered every page inside `maxWidth: 680` (one shared
line — a `980` exception existed for Cloud), and the sidebar/in-page icons were unicode glyphs
(`◐ ▣ ᛒ ♪ ◉ ⎙ ◔ ☺ …`) whose weight and size vary with the font, plus four ad-hoc drawn glyphs.

**What changed** (all through the shared layer, `apps/settings/ui.jsx` + `index.jsx`):
1. The shared page column widened: `maxWidth` 680 → **920** (Cloud keeps its tuned 980). No
   per-page width edits anywhere.
2. `Columns` (new shared primitive in ui.jsx): when the Settings **window** is at least 1080 px
   wide (maximized, big monitors), a page's sections flow in two balanced columns; under the
   threshold they stack exactly as before. The window width comes from the windows store, so it
   follows resizes. Used by General (machine + software cards side by side) and Sound (output +
   input groups) as the first two consumers — other pages opt in with one wrap, no per-page hacks.
3. `PaneGlyph` (new shared primitive in ui.jsx): one drawn, **monochrome** pictogram per section on
   a single 20×20 grid — same 2-unit stroke weight, rounded caps, one color, tinted by the
   sidebar's colored tile. 31 glyphs (all 27 sections + camera/mic/folder/usb/wifi/status-item for
   the pages). The engine has no vector paths (node types: VIEW/TEXT/IMAGE/RAW/TERM/SURFACE/MEDIA),
   so the icons are compositions of views — resolution-independent and theme-tintable, which PNG
   assets would not be.
4. Replaced everywhere: the sidebar (`SectionIcon` now draws by section id; GROUPS lost its glyph
   column), Power's no-battery header, Network's per-device icons (wifi arcs / globe), Privacy's
   twelve permission pictograms (its three ad-hoc drawn components are gone). DefaultApps' category
   `LOOK` glyphs are the one remaining unicode set — ledgered below.

**Verification**: `node tools/build-theme.mjs` exits 0 (bundles + i18n check green);
`tests/switcher_model_test.mjs` + `tests/hwkeys_test.mjs` exit 0. **Visual pass needs the live
desktop** (the lab renders headless with no viewer scripting for app windows): open Settings,
check the sidebar on both themes, maximize the window (General and Sound should go two-column),
resize below half-screen (they return to one column), and visit Privacy/Network/Power for the
in-page icons.
**Remaining risk**: drawn glyphs are hand-placed fractions — a glyph may need a nudge (they fall
back to the grid icon if an id is missing, so nothing breaks); the 1080 px two-column threshold is
a first value, tunable in one place (`Columns` `min` prop).

## F. Wallpaper page restructure — FIXED (code), needs manual verification

**Requirement** (top→bottom): category grids with full captions, then Live wallpaper, then
"Custom wallpaper" (image file) and "Custom live wallpaper" (video file or URL). Keep the
click-to-choose-destination dialog. Validate files, graceful bad-file handling, async loading.

**What changed**:
1. `apps/settings/Wallpaper.jsx` — page order is now exactly: category grids (nature/anime/cars,
   unchanged apply dialog on click) → Live wallpaper → **Custom wallpaper** (new: "Choose an
   image…" → FilePicker → the closed `wallpaper-image` action validates it and keeps the user's
   copy → the same apply-login/desktop dialog) → **Custom live wallpaper** (new section: the
   "Choose a video…" flow moved here from the Live section's small button, plus a **From a URL**
   row with progress) → Glass. Tile captions no longer truncate — the full name wraps.
2. `server/src/hw/wallpaper_admin.c` + `hw_admin.h` — new closed action **`wallpaper-url-get`**:
   https only, no user-info part, no spaces/control characters, one file capped at 512 MiB
   (`FetchItem.max`), stored under the hex of the URL's sha256 (the same URL is not fetched twice),
   root-owned 0644 in the wallpaper store so desktop and login can both read it. It does not judge
   the bytes: the shell probes them with the media helper and refuses what cannot play
   (`userVideoProblem`), exactly like a picked file. Progress rides the action's PROGRESS lines
   (the button shows the percent). `wallpaper.badUrl` string added to the five catalogs.
3. Bad files: images fail inside the validated `wallpaper-image` action (translated error); videos
   fail the probe with the page's unreadable/format notes; URL failures surface
   `wallpaper.badUrl` / `wallpaper.downloadFailed`. Everything async — no UI freeze.

**Verification**: `make build/insane-server` clean (no new warnings); `wallpaper-admin-test: 49 ok`
(the action table validates); `err-check` 581 codes, 0 problems; `build-theme.mjs` exit 0;
`wallpaper-find-test`/`media-wallpaper-test`/`canvas-test`/`bench-test` green;
`wallpaper-image-test` exits 1 on an **ASan leak that pre-exists this change** (proven: identical
155127-byte/9-allocation report with the change stashed and forced-rebuilt, and with it applied;
the stacks are the test's own buffers, tests/wallpaper_image_test.c:21,46 — ledgered below).
**Manual** (REGRESSION_CHECKLIST): pick a picture → dialog → applied to the chosen destination,
survives reboot; pick a bad image (a text file renamed .jpg) → visible error; pick a video → probe
→ dialog; URL download → progress → probe → dialog; a non-https URL → refused with the reason.
**Remaining risk**: the URL store keeps a copy per URL even if the probe later refuses it (a
failed-probe file is not auto-deleted — harmless, reused on retry); the 512 MiB cap is a constant.

## G. Raw translation keys in the UI — FIXED

**Symptom**: Settings → Energy shows raw keys (`prefs.power.quality.auto/.balanced/.performance/.low`).

**Root cause**: `apps/settings/Power.jsx` QualityRow calls `tr('prefs.power.quality.*')` directly
and those keys existed in **no** catalog (not even en); `t()` falls through to the raw key
(sdk/i18n.js:178). `tools/i18n-check.mjs` existed and would have flagged it — but nothing ran it,
and it could not see template-literal families (`tr(\`prefs.power.profile.${x}\`)`).

**What changed**:
1. Missing strings added to `assets/locales/` — en first, then es/fr/it/pt (non-partial languages
   must be complete): `prefs.power.quality{,Hint,.auto,.balanced,.performance,.low}`,
   `shell.widgets.edit`, `errors.battery.limit.unsupported`, `errors.dotdeb.{noCatalog,unknownApp,
   badPackage}` (the C-side codes err-check flagged), and the 15 `settings.sound.fx*` keys that
   commit `16e83572` had left English-only in es/fr/it/pt.
2. `tools/i18n-check.mjs`: also scans template-literal key families — `tr(\`ns.sub.${x}\`)` needs
   at least one `ns.sub.*` key in en, or the build fails.
3. The check now **runs in the build**: `tools/build-theme.mjs` runs it before bundling and exits
   with its status — a missing key can no longer reach the UI silently.
4. `tools/brand-check.mjs`: ALLOW entries for the shipped wallpaper artwork's own name
   ("Crystal Apple", the release-note catalog list) — the 4 pre-existing findings that kept the
   check permanently red and the tool unwired.

**Verification**: `node tools/i18n-check.mjs` exits 0 (all languages 11810/11810, 580 server error
codes covered, brands ok); `node tools/build-theme.mjs` exits 0 with the check running first and
`code-manifest.json: unchanged` (no artifact churn). The Energy segmented control now has its
labels on the live desktop — needs the manual look (REGRESSION_CHECKLIST, Settings section).
**Remaining risk**: translations are mine; a native speaker may refine wording later (en wording
matches the row's existing hint tone; the keys are correct in all five catalogs).

## H. Sound and feedback — FIXED (spinner landed; the sound layer pre-existed)

**Done earlier** (commit `16e83572`): the sound-effects layer — synthesized samples (shutter,
trash, plug/unplug, …), `insane.sound.play(name, vol)` (the central C API the task asked for —
`server/src/sound/snd.c`, non-blocking), `sdk/soundfx.js` gating everything behind Settings →
Sound → Sound Effects (master, volume, per-event, chatty opt-in); the shutter plays only after a
capture actually saved or copied; the charger note rides the AC watcher; notifications and the
startup chime honor their toggles.

**Added now**: the one shared progress pair in `sdk/components.jsx` —
- `Progress({ pct, width })`: the determinate bar (rounded track, accent fill, clamped);
- `Spinner({ size })`: the indeterminate three-dot indicator with one shared rAF loop (cancelled
  on unmount; Reduce Motion holds it static).

Consumers wired: the launcher's uninstall sheet (bar while the helper reports percent, dots while
it cannot — bug D's flow), and the wallpaper URL download (bug F's percent under the row). Both
previously hand-rolled bars or nothing.

**Audit of remaining gaps**: the Store's package jobs keep their richer phase-aware job view (an
app-local component on purpose — it names the phase); small actions shorter than ~300 ms stay
instant by design (toggles, settings writes — debounced, no freeze). No event names were added to
the C sound layer: uninstall plays the gated `trash` sample, which is the delete feedback the
sample set already has.
**Verification**: build-theme exit 0; visual pass rides bug D/F's manual steps (the sheet and the
URL row show their indicators).
**Remaining risk**: the Spinner re-renders once a frame while visible — one small node, off
Reduce-Motion; acceptable, but if it ever sits in a hot window it should become a C-side sprite.

## I. Other small issues — LEDGER (FOUND, NOT FIXED)

- `wallpaper-image-test` exits 1: ASan reports 155127 bytes leaked in 9 allocations — the test's
  own grow-only buffers (tests/wallpaper_image_test.c:21 `cb` realloc, :46 `with_exif` malloc),
  never freed by design of the harness. Proven pre-existing on 2026-11-17 (identical report with
  the wallpaper-url-get change stashed and rebuilt). Fixing the test's buffer hygiene is an
  unrelated cleanup; the test's checks themselves print `ok`.
- `apps/settings/DefaultApps.jsx` still draws its category icons from a unicode `LOOK` table — the
  one remaining un-migrated icon set after bug E (PaneGlyph covers the needed shapes; converting
  is a small follow-up).
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
