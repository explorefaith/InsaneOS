# WIDGETS.md — the Widgets feature ledger (Phase 4, branch `feature/widgets`)

## Inventory (STEP 0, 2026-11-18) — a framework ALREADY exists; reuse before building

The Transformation rounds shipped a working widget system (commit `a64cbb59`, refined in
`404660e5`):

- **`sdk/widgetmodel.js`** — the pure layout model and the only writer of
  `settings.desktopWidgets`: a 4 px snap grid, `freeSpot` (scans for placement),
  `clampWidget` (never off-screen), `resizeWidget` (delta resize), `addWidget(type, area)` /
  `removeWidget(id)` / `moveWidget`, `loadWidgets(saved)`, `WIDGET_CATALOG` (six types:
  insane-clock 300×132, insane-calendar 300×316, insane-battery 300×96, insane-stats 300×158,
  insane-media 300×112, insane-visualizer 320×118), the `widgetLayout` store and the
  `widgetsEditing` store (arrange mode).
- **`themes/default/components/DesktopWidgets.jsx`** — the desktop layer (below windows, and
  above for pinned cards via `sdk/widgets.js` `DesktopWidgets({layer})`), the cards (clock,
  month calendar, battery with charge state, system stats, now playing from the `nowPlaying`
  store, audio visualizer), the edit mode (right-click the desktop → Edit Widgets: cards drag,
  a remove button on every card, the gallery panel adds cards), `nowPlaying` and `useBattery`
  already feed the cards.
- **`shell.widgets.edit`** ("Edit Widgets") — the translation key this task's Bug G round added.
- **The persistence** is `settings.desktopWidgets` through the existing settings mechanism
  (loaded once, debounced save — never written from outside the running shell).

**What was MISSING against the Phase 4 brief**: a Settings → Widgets page (sidebar entry, the
gallery as a page with add/remove/size/arrange), per-widget Small/Medium/Large sizes, the lab
mount flag, and everything of M5 (crypto) / M6 (extras) / the temperature depth of M3.

## Baseline (no new widget code on the live desktop)

- Live session slow-frame count at STEP 0: 425 lines in `~/.cache/insaneos/session.log`
  (paint-dominated — the video wallpaper + window content on UHD 620; layout ~0). The
  milestone comparisons below use the DELTA over equal lab windows, not this raw count.
- The user's live desktop: dock auto-hide + the bar auto-hide (Bug C) verified working.

## Deviation note (rule 1)

The auto-hide/shared-widget logic is shell JS/JSX (both surfaces are JS-drawn; the existing
widget framework is JS). C is used where the brief asks for it: the M5 crypto network action
(server side) and its tests, when that milestone starts.

## Milestones

### M1 — Framework completion: Settings → Widgets page + lab mount flag — **CHECKPOINT PASSED** (2026-11-18)

- **Gap closed**: `apps/settings/Widgets.jsx` — a new Settings page: the catalog with an Add
  button per widget type, the placed widgets with size (Small/Medium/Large scaling the catalog
  card, applied through the model's delta `resizeWidget` — the 4 px grid and clamp do the
  geometry) and Remove, and **Arrange on desktop** (the existing `widgetsEditing` edit mode).
  Sidebar entry `widgets` with the drawn `grid` PaneGlyph icon; the lab mounts it at boot via
  `settings.benchWidgets` (opens Settings on the section — the Bug D lesson: mount what you
  touched) with a seeded clock card on the desktop layer.
- **Files**: `apps/settings/Widgets.jsx` (new), `apps/settings/index.jsx` (import + GROUPS),
  `themes/default/index.jsx` (BenchWidgets lab mount), `sdk/index.js` (catalogOf/resizeWidget
  exported), `assets/locales/*/settings.json` (section.widgets, keywords.widgets,
  widgets.placed/placedHint/arrange/editing/none/remove/gallery/galleryHint,
  widgets.type.insane-* ×6, widgets.size.small/medium/large — five catalogs).
- **Checkpoint verification**: build-theme exit 0; i18n-check exit 0; autohide model test
  689/689 (untouched paths); **lab**: Settings mounted on the Widgets section at boot + a real
  clock card on the desktop layer + testbench window cycles — **1362 frames, layout 0.22 ms,
  zero react errors**; 8 slow frames at 31–34 ms during the testbench's own damage bursts with
  the blur governor engaged (shrink 8) — no widget-caused frame (the clock card repaints once a
  minute). **The M1 checkpoint passes; M2 may start next session.**
- **Still manual (live desktop)**: add/remove/resize from the page, the arrange drag feel, size
  presets' look, persistence across logout/login, Dark/Light + accent on glass.

### M2 — Time widgets: clock depth + Date and Day — **CHECKPOINT PASSED** (2026-11-18)

- **Clock depth** (`DesktopWidgets.jsx` ClockCard): per-widget cfg (`widget.cfg` in
  settings.desktopWidgets — the model's `setWidgetCfg`, compare-before-set, rides every move/resize
  and survives reload): **Digital/Analog** (the analog face drawn with views — ring, ticks, hour /
  minute / optional second hands rotating via wrapper views around the face centre), **24-hour /
  12-hour** (AM/PM), **seconds** (digital `:ss` / the thin second hand). The tick stays the shared
  1 s ticker — minute/second aligned, never per frame. 12 h is off by default: the card has always
  read 24 h, so the upgrade changes nothing until the user opts in.
- **New Date and Day card** (`insane-date`, 220×150): weekday, the big day number, month + year —
  `weekdayName`/`monthName` in the system locale; added to `WIDGET_CATALOG` and registered.
- **Settings page**: each placed clock grows Style / Hour format / Show-seconds rows
  (`setWidgetCfg` through the Settings page's own pop-ups and toggle).
- **Files**: `sdk/widgetmodel.js` (catalog entry + `setWidgetCfg`), `sdk/index.js` (export),
  `themes/default/components/DesktopWidgets.jsx` (ClockCard depth + DateCard),
  `apps/settings/Widgets.jsx` (the cfg rows), `assets/locales/*/settings.json` (eight new keys ×5).
- **Verification**: build-theme + i18n-check exit 0; the lab mounted the **analog clock with the
  seconds hand and the Date card** through testbench window cycles — 1115 frames, layout 0.21 ms,
  paint 21.0 ms average, **zero react errors**, 8 slow frames = the testbench's own bursts (the
  same count as the pre-M2 run — no widget-caused frame). **Still manual**: the analog face's look
  on glass in Light/Dark, the 12 h labels' placement, the cfg pop-ups' feel on the real desktop.
### M3 — System widgets — **COMPLETE** (temperature color + Storage + Network cards; 2026-11-18)

- **M3 part 2** (`DesktopWidgets.jsx`): **NetCard** (`insane-net`, 300×118 — ↓/↑ rates from the
  monitor's own per-sample `net.rx/tx`, formatted B/KB/MB per second, the lifetime totals via
  `formatBytes`) and **StorageCard** (`insane-storage`, 300×96 — the system disk's
  used/total/free from `insane.disks.list()`'s statvfs fields, read defensively, no API → the
  card hides). Both follow the StatsCard's ref-per-tick pattern: the shared 3 s ticker drives the
  redraws, **no store write and no state set in render** (the React #185 lesson), and the
  sampling pauses with the cards (the sharedTicker refcount). Catalog entries + type names in
  five catalogs.
- **Verification**: build-theme + i18n-check exit 0; the lab mounted BOTH cards through testbench
  window cycles — 1172 frames, layout 0.19 ms, **zero react errors**, 6 slow frames = the
  testbench's own bursts. **Manual**: real throughput under load, a multi-disk machine, a machine
  without the disks API.

- **Temperature adaptive color** (`sdk/widgetmodel.js` `tempColor`/`tempWord`/`TEMP_THRESHOLDS` +
  the StatsCard): the accent dot, the CPU bar and the temperature bar shift **interpolated**
  teal → amber → red across configurable thresholds (`settings.widgetsTempThresholds` overrides
  the sane defaults cool 45 / warm 65 / hot 80); the label carries the translated state word
  (Cool/Warm/Hot — color is never the only signal); no sensor → the row disappears and the ink
  accent stays (graceful). The sampling stays the shared 3 s ticker (paused when no stats widget
  is mounted — the sharedTicker refcount) and never writes a store without a real change.
- **Files**: `sdk/widgetmodel.js` (the ramp + `setWidgetCfg` from M2), `sdk/index.js` (exports),
  `themes/default/components/DesktopWidgets.jsx` (StatsCard), `assets/locales/*/settings.json`
  (widgets.temp.cool/warm/hot ×5).
- **Verification**: `tests/widgetmodel_test.mjs` (9/9: the ramp's endpoints, interpolation,
  monotonic red channel, the state words, no-sensor default; `setWidgetCfg` merge/compare/ride);
  build + i18n exit 0; the lab mounted the stats card through testbench cycles — 1174 frames,
  layout 0.19 ms, zero react errors. **Manual**: the color shift under real CPU load, the word
  updating, a machine without a sensor.
- **Remaining in M3**: Storage and Network-throughput cards (providers: insane.monitor's disk/net
  samples — read defensively like the memory fix).
### M4 — Now Playing depth — **CHECKPOINT PASSED** (2026-11-18)

- **Reuse, not rebuild**: the Control Center's own **`NowPlayingTile`** (sdk/media.js — title,
  artist, cover art, the progress bar, ⏮ ⏸/▶ ⏭) is now the playing card's body — the same
  component the CC uses, so the Flutter player / browsers / anything the CC reads works in the
  widget by construction. The card keeps its NOW PLAYING label.
- **Idle per the brief**: nothing playing → the card **hides** (the default) or shows a quiet
  idle card ("Nothing playing"), per the widget's cfg (`idle: 'hide' | 'idle'`) through
  `setWidgetCfg`; the Settings page grows the "When nothing plays" pop-up.
- **Files**: `themes/default/components/DesktopWidgets.jsx` (MediaCard + the Tile import),
  `apps/settings/Widgets.jsx` (the idle row), `assets/locales/*/settings.json` (cfgIdle /
  cfgIdleHide / cfgIdleCard / mediaIdle ×5).
- **Verification**: build-theme + i18n-check exit 0; widgetmodel 9/9; the lab mounted the media
  widget with `idle: 'idle'` (nothing plays in the lab — the idle branch rendered) — 1039 frames,
  layout 0.22 ms, **zero react errors**. The playing path is the CC's own live-verified tile.
  **Manual**: a real player (the Flutter player, a browser) driving the tile in the widget,
  the transport buttons, cover art.
### M5 — Crypto (Binance) — NOT STARTED (the closed C action, the parser test, the model test,
the sparkline cards; lab mock server for the offline lab)
### M6 — Stopwatch/Timer, Quick Note — NOT STARTED

## Found, not fixed

- (empty — anything noticed goes here)

## Ideas (not built)

- Weather (out of scope by the brief: needs a data-source decision).
