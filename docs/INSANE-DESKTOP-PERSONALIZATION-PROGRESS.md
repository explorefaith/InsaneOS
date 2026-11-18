# INSANE OS — Desktop Personalization & Theme Studio progress

Branch `feature/theme-studio`. The ledger for the Wallpaper / Widgets / Themes mission and the
Phase-2 audit that follows it. Everything here reflects what actually ran: node model tests, the
i18n/err/brand checks, `tools/build-theme.mjs`, and the headless compositor lab
(`INSANE_HEADLESS_RENDER=1` + testbench — the recipe in memory `compositor-lab-profiling`).

## Architecture findings (STEP 0, verified from the source)

- **A theme is the whole desktop in React** (themes/THEMES-GUIDE.md): `insane-server` (C, the
  compositor) evaluates the bundle with QuickJS; a reconciler turns the tree into native nodes.
  No DOM, no CSS engine — a CSS subset as style objects. Scale transforms over children render
  blank (the M1c ledger lesson), so everything drawn must be natively sized.
- **Appearance keys**: `settings.wallpaper` (`image:<name>` for user copies, catalog ids for the
  shipped ones), `wallpaperBg` (solid/gradient instead of a picture), `wallpaperFit`, `motion`,
  `mode`, `accent` (named accents or — since this branch — a raw hex, tone-mapped per mode).
- **The desktop widget framework**: `sdk/widgetmodel.js` (layout, settings.desktopWidgets, the
  one-writer rule), `sdk/widgets.js` (`registerWidgetType`/`setWidgets`/`DesktopWidgets({layer})`,
  pinned split above/below the windows), card components in
  `themes/default/components/DesktopWidgets.jsx`. Settings runs in-process, so module stores are
  shared between Settings and the shell.
- **Real data sources** (all verified): `insane.monitor` (cpu/temp/mem/net samples),
  `insane.disks.list()`, `useBattery`, `nowPlaying` (playing app publishes title/artist/cover/
  pos/duration/toggle/next/prev), `sdk/calendar.js` (`calendarEvents.range`, `reminders.items`,
  `usePim`), `sdk/weather.js` (consent-gated open-meteo, `weatherGroup`),
  `sdk/alarms.js` (`clockTimer`, timerStart/Pause/Resume/Reset — the Clock app's own timer).
- **The engine carries 8 font families** (commit `6e8180c3`): sans-serif, monospace, brand,
  serif, display, narrow, compact, book — with italics and letterSpacing on the fast path.
- **Wallpapers**: 11 shipped (signature/lumo/cosmos) + this branch adds the user's collection.
  tools/gen-wallpapers.mjs builds index.json; cjpeg is absent on this machine, so the tool
  encodes through ffmpeg (yuvj444p, q:v ≈ cjpeg 90/85) and MERGES with the existing index (the
  originals of the shipped set are not on this machine).

## What landed (Phase 1 — the Theme Studio foundation)

- **`sdk/themestudio-model.js`** — the pure model: instances, z-order, overlap policy, alignment
  guides, theme plan resolution (design space per theme, positions scale, sizes stay), undo/redo
  (push-before contract), style merge (theme baseline ← kind defaults ← instance patch; null
  deletes), color parse/withAlpha, the persistence guard (`planDiffers`).
  `tests/theme_studio_model_test.mjs`: **111 checks**. Found and fixed a real bug: after
  front/back left gaps in z, forward/backward swapped with z±1 exactly and froze forever — now
  the neighbour is found by rank (byZ), not z±1.
- **`sdk/themestudio.js`** — the one-writer store over `settings.themeStudio`
  (`{active, savedAppearance, overrides, customs}`): apply/deactivate (the pre-theme look is
  snapshotted once; switching keeps the original; deactivating restores), per-theme overrides
  ride switches, custom presets (save/rename/delete; a custom's appearance follows live changes
  with compare-before-write), malformed-data guards (a broken record degrades to no theme, never
  a crash). `tests/theme_studio_store_test.mjs`: **60 checks** against the real settings store.
- **`sdk/themestudio-themes.js`** — the built-in catalog: **26 themes**, each `{id, name, desc,
  colors, appearance, style, sw:1280, sh:720, widgets}`. The two poles are the user's reference
  boards (Acid Press: newsprint cream/ink/acid-lime/cobalt, Liberation Sans Narrow, opaque paper
  hairline cards; Deep Forest: serif olive/cream, Noto Serif Display, soft cream glass). 20
  wallpapers anchor at most two themes each (a second reading must be a genuinely different
  identity); 3 themes stand on `wallpaperBg` gradients (one, Neon Koi, deliberately: the
  collection's anime-2 source is 168×299 — far under what a desktop picture needs; it stays in
  Settings → Wallpaper for the user to pick).
  `tests/theme_studio_themes_test.mjs`: **1503 checks** — every plan in-bounds, NO self-overlaps,
  every wallpaper id exists, every font/kind/accent real, ≥25 themes, ≥6 light modes, unique ids.
- **Hex accents**: `sdk/theme.js` grows `toneHex` (keep the hue, pull s/l into a legible band per
  mode) and `resolveAccent`; both `themes/default/tokens.js` and `themes/classic/tokens.js`
  accept a raw hex `settings.accent` now (named accents and 'auto' unchanged). This is what lets
  a theme carry its own accent colour (Acid Press's lime, Event Horizon's gold).
- **The renderer**: `themes/default/components/ThemeWidgets.jsx` — every TS kind draws through ONE
  registered type (`ts-widget`) so the composition's z-order is the paint order and the pinned
  split rides the existing `DesktopWidgets({layer})`. The style schema drives the surface (paper/
  alpha/blur/radius/border/pad/shadow) and the type (font/size/weight/italic/tracking/color/
  align). Kinds: clock-digital/analog/world, calendar, agenda (Calendar events), weather
  (consent-gated; the consent ask is tappable), stats, battery, media (playing app; idle card or
  hide), notes (the widget's own text), todo (Reminders, toggleable), quote, pomodoro (the Clock's
  real timer), network, storage, label, headline, gauge. Real data only; a kind without its data
  draws its quiet state. Boot: `tsInit(workArea)` + the store→layer bridge at module level; while
  a TS theme is active the classic cards stand down (`layoutToRender` guard, also subscribed to
  `tsLive`) — one composition on the desktop at a time, both kept underneath.
- **Settings → Themes** (`apps/settings/Themes.jsx`): the gallery of miniatures (real wallpaper
  thumb + real palette + real plan geometry, drawn natively — no scale transforms), preview
  dialog, Apply/Reapply/Use-no-theme, the customize editor (layer list with hide/z/duplicate/
  remove, per-widget typeface/size/weight/italic/ink/surface-alpha/corners/glass/align/shadow,
  clock/media/notes/quote/headline cfg rows, S/M/L, position nudge), undo/redo
  (tsCreateHistory), Reset layout, Save/Rename/Delete preset.
- **Wallpaper section** (brief §2): the picture gallery now shows ONLY the user's collection —
  Anime / Wallpapers / Soft Anime from the system catalog (no downloads) — plus Your pictures;
  chosen ring, apply dialog (desktop / login), missing thumbs degrade to a quiet plate. The web
  catalog gallery (nature/anime/cars downloads) is retired. Live/Custom/Custom-live/Glass stay.
- **Settings layout (brief §6)**: `WIDE_SECTIONS` (themes, wallpaper, widgets) drop the 920 px
  reading column — the grid is the content.
- **i18n**: 61 settings keys + 14 shell keys ×6 locales (en/es/fr/it/pt full, lt partial as it
  already was). `i18n-check` clean (11972/11972 for the four, err-check 0 problems, brands ok).
- **Wallpapers**: the user's 9 collection images ship in `assets/wallpapers/{anime,wallpaper,
  sanime}/` at their true sizes (no upscaling), thumbs regenerated, index.json merged (21
  entries). The gen tool gained ffmpeg-only encoding + the merge mode + jpg sources.

## Lab verification (headless, no pointer)

- Scratch instance (`~/.cache/insane-lab`), preseeded `benchSection: 'themes'` +
  `themeStudio.active: 'acid-press'`: theme bundle loads, the Themes page mounts, **zero react
  errors**, testbench 1461 frames @ 55.8 fps, paint ≈ 30–60 ms on the headless full-frame
  driver (control comparison pending — the headless driver damages the whole frame itself, so
  the absolute number is an upper bound, not the live desktop's cost).
- The lab mount flag generalised: `settings.benchSection` opens Settings on any section at boot.
- **Safety rule learned the hard way**: `pkill -f` patterns that can match `insane-server` or the
  tool's own command line must never be used — twice this crashed the user's live desktop to the
  login screen. Lab instances are killed only by the PID captured at launch.

## Known gaps / next (Phase 2)

- Widget kind catalog: 18 kinds now — the brief wants a large ecosystem (the user asked for
  100+ unique widgets). Plan: a spec-driven widget factory (`WIDGET_SPECS` — kind = data
  provider + renderer variant + defaults), real sources only, node-testable spec table.
- The classic Widgets page's gallery should carry the Set | Preview | Customize triple too.
- Live placement (drag on the real desktop) for TS widgets: the classic system's PlaceLayer
  pattern, adapted; today the editor does geometry numerically.
- Rich text: per-segment styling inside a widget (the Phase-2 brief §5) — needs a text-run model.
- Control Center (Phase-2 brief §7): new top slide-down panel with real NM/BT/audio/brightness.
- Live-desktop manual pass (the lab cannot): apply each theme, watch the desktop, reboot
  persistence — upgrade-insaneos.sh then a real session.
