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

### M5 — Crypto (Binance) — NOT STARTED; the full implementation plan (2026-11-18)

**Discovered for the build** (use these, they are verified): `sec/json.h` has `json_parse(buf, n,
&JDoc, NULL, 0)`, `json_get(JVal, key)`, `json_num(JVal, key, def)` (doubles ✓), `JVal->kid`/`len`
for array walks; `pkg/http.h` `fetch_batch(FetchItem*, n, progress, ud)` writes to `dest.part` →
`dest` (so fetch to a /tmp file, read, parse, unlink); the Makefile hw sources are Makefile line
~59 (`SRC := src/hw/wallpaper_admin.c …` — add `src/hw/crypto_admin.c`), and
`build/wallpaper-admin-test` (Makefile ~951) is the recipe template for the new C test (copy its
exact prerequisites/compile line; check whether pkg/http.c needs adding for the fetch symbols).

**New file `server/src/hw/crypto_admin.c`** (~140 lines):
- `static int symbol_ok(s, n)`: only A–Z 0–9, length 2–20.
- `static int fetch_url(host, path, dest, max)`: FetchItem (it.max = 1 MiB), fetch_batch, 200 && size > 0.
- `crypto-ticker "<SYMBOL>"`: validate → try `https://api.binance.com/api/v3/ticker/24hr?symbol=X`,
  on failure `https://data-api.binance.vision/...` (the allowlist's second host) → fetch to
  `/tmp/crypto-t.json` (root, 0644) → read + `json_parse` → rebuild a TRUSTED small answer
  `{"symbol":"X","price":N,"change":N,"changePct":N,"high":N,"low":N,"volume":N}` via
  `json_num` (the shell never sees Binance's raw bytes) → unlink → `admin_say("OK", "%s", out)`.
- `crypto-klines "<SYMBOL>"`: `…/api/v3/klines?symbol=X&interval=15m&limit=96` → parse the root
  array, emit `{"closes":[[ms,close],…]}` from kid[0] (ms) and kid[4] (close) → OK passthrough.
- No user-info in URLs, no redirects handling beyond fetch_batch's own, `admin_err` with codes:
  `crypto.badSymbol`, `crypto.noData`, `crypto.badAnswer` (errors.json ×5).
- `hw_admin.h`: two declarations + `HW_ADMIN_ACTIONS` entries `A_FORK | A_ANYONE`.

**`tests/crypto_test.c`** (recipe = the wallpaper-admin-test copy): symbol_ok's accept/reject
table (length, charset, lowercase rejected); ticker extraction from a real-shaped sample JSON,
malformed JSON, an object missing fields, an empty body → the error paths; the klines walk on a
two-row sample. No network in the test — the fetch paths are exercised by the lab mock.

**The lab mock server** (offline): a tiny node script under tools/ (node:3001) serving the two
endpoint shapes on api.binance.com paths; the lab instance reaches it via `--host-allowlist`…
NO — the allowlist is compiled. For the mock: run the mock and point the lab's /etc/hosts? NO
(root write). Honest alternative: the C test covers the parsing; the REAL endpoint needs the
live pass (state it in the manual list).

**Shell side (after the C lands)**: sdk/crypto.js — a small store: cfg list of pairs, refresh
15 s (min 10 s), one fetch shared per pair, stale marking, backoff on 429/418; the CryptoCard
(small/medium/large per the brief, the sparkline from the closes, green/red + sign, locale
numbers, "Data: Binance"); the Settings page crypto rows; i18n ×5. Node model test for
formatting/staleness/backoff.

## CORRECTION ROUND (M1b) — the user rejected the first cut of Settings → Widgets (2026-11-18)

**The user's verdict**: the "Add a widget" gallery was plain text tiles (a name and "300 × 132") —
no one can tell what a widget looks like before adding it. A design failure, not polish.

**The brief (binding), parts A–G**:
- **A. Preview cards**: every gallery entry renders the REAL widget component at its true size
  (scaled down only if the column is narrow, never cropped), in preview mode with clearly marked
  sample data where offline (crypto, idle now-playing) and a small "Sample" tag; the gallery never
  starts network calls; S/M/L switches update the preview immediately (the depth becomes visible);
  previews ride ONE shared 1 s tick and exist only while the page is visible; **no backdrop blur
  inside previews** (nested blur = the Bug A lag, fights the governor) — a flat translucent fill
  imitating glass; Light/Dark + accent followed.
- **B. Controls under each preview**: drawn icon buttons (the PaneGlyph grid/stroke), translated
  tooltips and labels — a three-segment S/M/L, Add (+ adds another instance, an "On desktop: N"
  badge, trash appears when N > 0), Configure (a gear popover with that widget's options), and
  Move (live placement, part C). **Never show raw pixel sizes as text.**
- **C. Place on desktop**: Move (or Add straight into Move) fades the Settings window away, dims
  the desktop, shows a faint snap grid, and the chosen widget drags live at its real size
  (clamped below the top bar, clear of the dock, lift shadow while dragging, click-and-hold); a
  floating glass toolbar offers live S/M/L resize, snap on/off, Remove, Cancel, Done (Esc cancels,
  Enter saves); Done saves through the settings path (the debounced rewrite — never from outside
  the shell) and Settings returns; Cancel restores position, size and existence exactly; the other
  widgets stay visible but dimmed in this mode; the existing "Arrange all" keeps every card
  draggable. Dragging never lags: transform-only, one update per frame, no sibling re-layout, the
  store committed ONCE at drag end — never a synchronous external-store set() inside an effect.
- **D. "On your desktop" list**: one mini preview per placed widget with the same icon controls;
  the empty state is a drawn illustration plus "Pick a widget below"; **fix the header** —
  "Arrange on desktop" and "Reset layout" sit in a proper header row (the screenshot showed them
  squeezed inside a card with a divider through the text).
- **E. Single source of truth**: the screenshot's bug — the desktop showed a Clock and a System
  card plus a blurred empty glass card with a dashed line bottom-left, while Settings said
  "No widgets yet".
  **Root cause (diagnosed 2026-11-18)**: THREE defaults rendered straight through
  `setWidgets('insane-clock'/'insane-stats'/'insane-visualizer', …)` at DesktopWidgets.jsx module
  level, bypassing `widgetLayout` entirely — the Settings page, the edit mode and the persistence
  all read `widgetLayout` (empty: `settings.desktopWidgets` unset), so the page and the desktop
  disagreed, and the bottom-left "empty glass card with a dashed line" is the **Visualizer default
  being silent** (flat minimum bands are its idle drawing — not broken, just unmanaged).
  **Fix applied this round**: the defaults now BECOME the layout (`loadWidgets(…)` when
  `settings.desktopWidgets` is unset) and a bridge maps every `widgetLayout` change onto the
  rendered cards (`layoutToRender()` groups by type → `setWidgets`; subscribed + fired once) —
  one instance list that Settings, the badges, the "On your desktop" list and the desktop all
  read. **Model test next session**: the defaults appear as instances, add/remove/move/cancel keep
  the list and the render in step.
- **F. Sidebar icon regression**: Widgets, Displays, Network, Bluetooth, Notifications, Printers &
  Scanners and Sharing all show the same four-square fallback — find why those ids fall back
  (PaneGlyph id mismatch against the GROUPS ids), add/fix the glyphs on the same grid and stroke,
  add a node test that FAILS if any sidebar section id has no glyph.
- **G. Gallery organization**: category headings — Time (Clock, Date and Day, Calendar), System
  (System, Battery, Storage, Network), Media (Now Playing, Visualizer); Crypto under Finance only
  when M5 exists; the grid uses the Columns primitive responsively (2–4 per row by width).

**Status**: **E — DONE** (the bridge, verified 1573 frames), **A + B — DONE** (commit `f901695e`):
the gallery shows the REAL widget components as previews (the registered card component at the
chosen S/M/L size; the media preview draws its sample song, tagged Sample; no network calls, no
nested blur — previews mounted only while the page is), with the drawn icon controls under each
preview (S/M/L segments, +, the gear applying the clock's style/format/seconds and the media's
idle mode to every placed instance of the type, the remove cross when instances exist, the
On desktop: N badge) — no pixel sizes anywhere.
**Verified**: build + i18n exit 0; autohide 689/689 + widgetmodel 9/9; the lab mounted the page
with every preview through testbench cycles — 1187 frames, layout 0.44 ms, zero react errors.
**Manual**: compare each preview with the real widget at all three sizes (Light and Dark).
**C, D, F, G — NOT STARTED** (next: D, then C, then F, then G per the correction order).
