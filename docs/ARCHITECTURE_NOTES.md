# ARCHITECTURE_NOTES.md — the code map for the stabilization task

Companion to `docs/ARCHITECTURE.md` (the whole-OS map). This file covers only the areas the
stabilization task touches, at function level: the dock, the top bar, Settings, wallpaper, sound,
screenshot, app launcher/uninstall and the string table. Written at Phase 0 (2026-11-17).

Big picture: the C server (`server/src/`) is compositor/input/paint only. Window management, dock,
menu bar, work area and every app UI live in JavaScript (`sdk/` = logic and models,
`themes/default/` = the drawing, `apps/` = the apps). The shell is one QuickJS process; React runs
on a stock reconciler against our host config. Work area is computed **entirely in JS** and
registered to the C side via `configureWindows`.

## 1. The dock

| Role | Where |
|---|---|
| Drawing | `themes/default/components/Dock.jsx` (`Dock` :221) |
| Logic shared with the Classic taskbar | `sdk/dock.js` |
| Pure model (unit-tested, no React) | `sdk/dockmodel.js` |
| Settings page | `apps/settings/Dock.jsx` |
| Classic counterpart | `themes/classic/components/Taskbar.jsx`, `themes/classic/placement.js` |
| Docs | `docs/DOCK.md` |

**Key names.** `dockThickness(size)` (Dock.jsx:30) → work-area subtraction. `useAutohide(mode,
position, rectRef, keepOpen, areaRef, force, covered)` (Dock.jsx:85–151) — edge test within 2 px,
`setTimeout 120 ms` → show, rAF slide `SLIDE_MS = DUR.dockSlide = 180 ms`; pointer off bar →
`hideSoon(500)`; `'overlap'` mode watches `useDockCovered` → `hideSoon(COVER_MS=300)`. Magnification
coalesced with one rAF (`pendM/rafM`, Dock.jsx:230–232, 486–490); cosine sizes; `RANGE=BASE*3`.
`useGlide`/`Poof` (Dock.jsx:156–219) for reorder/remove puffs.

**SDK API** (`sdk/dock.js`): `dock.{pin,move,unpin,reset,isPinned,canRemove,canMove}` (:77–104),
`dockPrefs`/`DOCK_DEFAULTS` (:109–130), `useDockEntries` (:170–228), `dockActivate` (:244),
`launchDockItem` (:232), `dockMenu` (:302), `dockQuickActions` (:278), drag engine
`beginDockDrag` (:412, hold `REMOVE_HOLD=350 ms` past `NEAR=60 px` → unpin + `dockPoof`),
trash `trashState/useTrash/emptyTrash` (:360–388). Model: `parseDockId`, `LOCKED`
(`app:files`, `shell:launcher`, `app:settings` — dockmodel.js:25), `moveItem/pinItem/unpinItem`
(:84–104), `dockHideMode` (:157), `dockCovered` (:172).

**Remove from Dock flow** (the bug-A freeze suspect): context menu item (dock.js:325) →
`dock.unpin(e.id)` → `unpinItem` (dockmodel.js:100) → `save(list)` = `settings.set({ dockPinned })`
(dock.js:75). **Not a synchronous disk write**: subscribers notify now (React rebuilds the entry
list in `useDockEntries`), persistence is the 300 ms debounced writer (sdk/settings.js:118–122);
the only sync/durable path is `saveSettingsNow` (settings.js:126), not used here. Second flow:
drag out + hold → same unpin + poof animation.

**Timers (stacking audit, 2026-11-17)**: `useAutohide` keeps one timer + one rAF, `stop()` clears
both, `hideSoon` guards `if (!timer)`; magnify is one rAF per frame with guard; `useGlide`/`Poof`
cancel in cleanup. The launch-bounce effect (Dock.jsx:388–397) has **no deps array** — torn down
and re-armed on every Dock render (each magnify frame); only one runs at a time (cleanup cancels),
so it is churn, not stacking, but it is on the bug-A suspect list. Trash ticker: one
`setInterval 2000 ms` refcounted across subscribers. Settings writes coalesce (debounce).

**Event flow**: C input → `runtime/events.js` global `pointermove` registry (:10–18) →
`useAutohide` listener (Dock.jsx:135–145). Click → `dockActivate` (focus or launch). Right-click →
`dockMenu` → `Menu.jsx` in the `popover` layer. Drag → `beginDockDrag`. Escape cancels drag.

## 2. The top bar (menu bar / control panel)

| Role | Where |
|---|---|
| Bar drawing | `themes/default/components/MenuBar.jsx` (`MenuBar` :100, one per display via `MenuBars` :205) |
| Menus | `themes/default/components/Menu.jsx` (popover layer) |
| Control center | `themes/default/components/ControlCenter.jsx` (:186), NotificationCenter.jsx |
| Model | `sdk/menubarmodel.js` (`MENUBAR_DEFAULTS` :27, `menuBarPrefs` :40, `hasBar` :97, `pinBar` :142, `inBar` :157) |
| Tray/status items | `sdk/statusitems.js` (`registerStatusItem` :22) + registrants: `sdk/netstatus.jsx:245`, `sdk/hardware.jsx:502` (battery, order 5), `sdk/index.js:271` (OSK), `themes/default/components/cleanerstatus.jsx:111` (the ex-crown spark), `sdk/cloudstatus.jsx:148`, `sdk/appstatus.jsx:56`, `sdk/alarms.js:220` (clock) |
| Battery | `sdk/hardware.jsx` (store :36, `BatteryGlyph` :329, low-battery notify :318) |
| Logo | `MenuBar.jsx:165` `InsaneGlyph` → `sdk/logo.js` |

**Item row** (MenuBar.jsx:165–194): logo → app menu → speech menus → Window → Help → keyboard
layout → `StatusItems` → privacy indicators → stats → camera → spotlight → control center → bell
→ clock. Menus anchor via `itemAt(ref)` using `insane.getLayout`; panels (`panelToggle`,
theme index.jsx:255) are mutually exclusive, live in the `popover` layer, close on outside
`pointerdown` with the `inBar` exemption (ControlCenter.jsx:204) and Escape.

**Timers**: clock `sharedTicker(1000)` and stats `sharedTicker(4000)` are module-level singletons
(sdk/ticker.js:22 — starts on first subscriber, clears on last). `useTween` (sdk/animation.js:57)
rides one shared rAF ramp, Reduce-Motion aware. No stacking found.

**Work area**: computed in the theme (`themes/default/index.jsx`: `workAreaFor` :95 subtracts
`MENU_H=28` per bar display and `dockThickness` unless auto-hide; registered through
`configureWindows({apps, workArea: areaFn, chrome:{w:2,h:43}})` :108, re-registered live on
`[dockPosition, dockSize, dockAutohide, every, mirror, screen]` :247). Consumers:
`sdk/windows.js` (placement/snap), `sdk/notify.js:167`, `sdk/widgetmodel.js:32`,
`sdk/windowmemory.js:40`, `sdk/sessionrestore.jsx:157`, `sdk/osk.js:81`.

**C-side involvement**: none for bar/dock logic (`server/src/main.c:160` notes the main display
hosts them). Xwayland state tracked in `server/src/wl/xwm.c`; window drag/resize via
`server/src/ui/js_wm.c` → grab.c.

## 3. The Settings app

| Role | Where |
|---|---|
| Window shell: 220 px sidebar + search + user card + page | `apps/settings/index.jsx` (`Settings` :745) |
| Sidebar sections | `GROUPS` (index.jsx:694–699) — `[id, component, color, glyph]` quadruples, `SECTIONS` = flat |
| Shared page primitives | `apps/settings/ui.jsx`: `Stack`, `Section`/`GroupBox`, `SettingRow`, `ValueRow`, `FieldRow`, `Actions`, `PageHeader`, `Badge`, `Note`, `Message`, `PopUp`(+`PopUpLayer` in the overlay layer), `TimeField`, `shade` |
| Pages | one file per page in `apps/settings/` (Power.jsx, Sound.jsx, Wallpaper.jsx, Displays.jsx, Network.jsx, …) — imported by index.jsx |
| Dock/menu-bar settings rows | `apps/settings/Dock.jsx` (`MenuBarSection` :89, `ControlCenterSection` :113) |
| Icons (sidebar) | `SectionIcon` (index.jsx:711) → `Badge` with **unicode glyphs** (`◐ ▣ ⇅ ♪ ⌨ …`) plus four drawn glyphs (`LockGlyph`, `BoltGlyph`, `FanGlyph`, `ChipGlyph`, index.jsx:644–691) |

**The narrow column (bug E)**: index.jsx:802–806 wraps every page in
`maxWidth: section === 'cloud' ? 980 : 680` inside a centered scroll container — the single shared
place to widen. `PopUp` menus render through the overlay layer so they are not clipped by the
page's ScrollView (`PopUpLayer`, ui.jsx:191).

**i18n in pages**: `useLocale().t` (`tr`) throws through to raw keys on missing strings; the safe
variant is `tOptional(key) || 'English fallback'` — used inconsistently (see bug G).

## 4. Wallpaper (static and live)

| Role | Where |
|---|---|
| Settings page | `apps/settings/Wallpaper.jsx` (`WallpaperSettings` :155) |
| Picture catalog | `/usr/share/backgrounds/insaneos/web.json` (`readCatalog` :29), categories `nature/anime/cars` (:171) |
| Live/motion model | `sdk/motionmodel.js` (`variantFor`, codecs), `sdk/motion.jsx` (`motionDisabled`), catalog tiles (`motionItems`, `MOTION_SECTIONS`, `motionThumb`, `motionDownloads` store) |
| Apply paths | desktop: `settings.set({ wallpaper, motion, wallpaperBg })` (:175–181, :195–200, :251–257); login: `setLoginImage/setLoginVideo/setLoginMotion` (SDK, closed admin actions) |
| Live preview player | `LivePreview` (:134) — `media.play('settings', path, { loop, audio: 0, hwOnly: 1, fpsMax: 30 })`, `MediaView`, pause/play via `media.control`; never re-decodes on toggle |
| Custom video validation | `pickOwnVideo` (:212) — `media.probe` → `userVideoProblem` (unreadable/format) → `heavyVideoWarning` (big/fps) |
| Pause switches | `motionPause` settings (:266–267, 328–351): `desktopCovered` (default on), `locked`, `fullscreen`, `covered`, `idle`, `busy`, `battery` |
| Desktop-side live layer | theme `Layer` usage + `sdk/motion.jsx`; the still picture stays drawn underneath |
| Glass section | `GlassSection` (:401) — `glassBlur/glassTransparency/glassSaturate` sliders |

**Verified downloads**: catalog pictures go through the closed admin action `wallpaper-web-get`
(hash-checked against the shipped catalog); videos land in `/var/lib/insaneos/wallpapers`
keyed by sha256 (`storedPathOf` :42).

## 5. Sound

| Role | Where |
|---|---|
| Effect layer | `sdk/soundfx.js` — names (shutter, trash, plug/unplug, …), per-event gating |
| Host binding | `insane.sound.play(name, vol)` — C host function in `server/src/ui/` (js_sys.c/js_media.c); PipeWire shared-memory path (docs/MEDIA.md) |
| Synthesized samples | generated (committed `16e83572` describes synthesized samples; exact generator file to be confirmed) |
| Settings | Settings → Sound (`apps/settings/Sound.jsx`): Sound Effects master, volume, per-event, chatty opt-in |

Rules for new work: never block the UI on play (the host call is async by design — verify when
touching it), respect the system volume/mute, only synthesized or license-clear sources.

## 6. Screenshot

Capture rides the shortcut system (`sdk/shortcuts.js` `capture.full` is referenced by the camera
item in MenuBar.jsx:188; the full key table lives there). The C side captures (server media
path) and the shutter effect fires from `sdk/soundfx.js` **only after the capture actually saved
or copied** (commit `16e83572`'s contract). Exact call chain to be confirmed when bug H is worked.

## 7. App launcher / uninstall / package system

- Apps are packages: `apps/<id>/manifest.json` + `index.jsx`; `.lpk` isolated apps run as
  processes (`insane-server --app`, `server/src/app/`, `server/src/sec/` Landlock+seccomp,
  `tools/lpk.mjs` builds/signs them — docs/PRIVACY.md, docs/SIGNING.md).
- The launcher is the dock's `shell:launcher` entry (LOCKED in dockmodel.js:25) opening the apps
  index; the app grid/context menu and its actions are built in the theme's launcher component
  (confirm exact file when bug D starts).
- **No uninstall path exists today** (bug D) — the store installs, nothing removes. Critical-app
  protection precedent: dock `LOCKED` list; Settings/Files/launcher-equivalent are the set to
  protect.
- `server/src/apps.c`/`apps.h` enumerate apps for the C side (`code: … 10 files listed` in the
  session log).

## 8. String / translation table

- Engine: `sdk/i18n.js` — catalogs under `assets/locales/`; resolution order: the preferred
  languages list (Settings → Language & Region, `PreferredLanguages` in apps/settings/index.jsx),
  then English. `t(key)` returns the raw key when nothing matches (the bug-G surface);
  `tOptional(key)` returns undefined so callers can fall back.
- Catalogs are namespaces (settings.*, prefs.*, shell.*, …) — per-file JSON; language packs install
  through `insane.locale.installPack` (apps/settings/index.jsx:474 PackImport, built by
  `tools/i18n-pack.mjs`).
- **Check**: `tools/i18n-check.mjs` exists (build tooling) — its coverage and the plan to make it
  catch every missing key are part of bug G.
- Plural/format rules: docs/LANGUAGES.md.

## Shared code the bugs must not break

- `sdk/settings.js` — the one settings store (loaded once, debounced 300 ms save; do not edit the
  JSON under a live session).
- `sdk/windows.js` — placement/keep-in-work-area; any auto-hide change (bug C) must re-run
  `configureWindows` exactly like the existing keys do.
- `sdk/animation.js` `DUR` + `useTween` — the one animation timing table (dock slide 180 ms, panel
  160 ms, …); bug C's shared auto-hide should reuse it.
- `sdk/layers.js` — layer names and hit-test order (dock=10, menubar=20, popover=50): both the
  dock and the top bar live in named layers; a shared auto-hide component must keep those names.
