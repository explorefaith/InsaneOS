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

### M2 — Time widgets (clock analog option, date/day, calendar depth) — NOT STARTED
### M3 — System widgets (temperature depth with the adaptive color) — NOT STARTED
### M4 — Now Playing depth (progress + transport controls) — NOT STARTED (the `nowPlaying`
store and a media card already exist; the depth pass is the work)
### M5 — Crypto (Binance) — NOT STARTED (the closed C action, the parser test, the model test,
the sparkline cards; lab mock server for the offline lab)
### M6 — Stopwatch/Timer, Quick Note — NOT STARTED

## Found, not fixed

- (empty — anything noticed goes here)

## Ideas (not built)

- Weather (out of scope by the brief: needs a data-source decision).
