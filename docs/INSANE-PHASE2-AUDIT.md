# INSANE OS — Phase 2 audit (Theme Studio & the widget ecosystem)

The Phase-2 audit ledger. Three independent Explore agents walked the branch against the C that
serves its data, a UX geometry pass measured every surface against the engine's border-box
layout, and the findings below were fixed and re-verified in the lab. Statuses follow the
Phase-2 brief: DISCOVERED → FIXING → FIXED → VERIFIED.

## Round 1 — 2026-11-19, the subagent audits

Sources: the data-layer audit (theme/widget functionality, providers vs the C), the UX audit
(engine geometry: border-box width, flexShrink 0 default, style.c's real property table), the
performance audit (store/subscription/render flows). The interaction audit hit the session's
concurrency limit and is folded into round 2 (§2's button pass).

| ID | Sev | Module | Issue | Status |
|---|---|---|---|---|
| A1 | P0 | ThemeWidgets | `useStore(nightActive)` — nightActive is a selector fn, not a store; every generic widget crashed at mount (87/105 kinds); the crash persisted across boots | FIXED, VERIFIED |
| A2 | P0 | Themes | AddDialog: 172px tiles → 2/row, no ScrollView → ~21 of 105 kinds unreachable | FIXED, VERIFIED |
| A3 | P1 | ThemeWidgets | netHistory inflated rates ×1048576 (MB pushed, bytes formatted) — a fake number | FIXED, VERIFIED |
| A4 | P1 | ThemeWidgets | sunTimes read s.rise/s.set; the API returns {sunrise,sunset} — widget always '—' | FIXED, VERIFIED |
| A5 | P1 | ThemeWidgets | volume read sink.volume (a per-channel array); the scalar is sink.level — always 'No data' | FIXED, VERIFIED |
| A6 | P1 | ThemeWidgets | bluetooth read b.powered (lives at b.adapter.powered); the toggle could only turn BT ON | FIXED, VERIFIED |
| A7 | P1 | ThemeWidgets | calendarEvents.range/reminders.items are async; called in render → agenda/todo permanently empty; todoCount faked '0 open' | FIXED, VERIFIED (pimCache) |
| A8 | P1 | themestudio | gradient→picture theme switch never cleared wallpaperBg; Backdrop draws bg INSTEAD of the picture | FIXED, VERIFIED |
| A9 | P1 | ThemeWidgets | voltage/gpu/connections sources publish only while wanted (wantVoltage/wantGpu/want) — widgets quiet forever | FIXED (wantAndTake + last-good cache) |
| A10 | P1 | ThemeWidgets | timerLeft is ms; Pomodoro/Timer formatted as seconds — '25000:xx' | FIXED, VERIFIED |
| A11 | P1 | ThemeWidgets/Themes | numberOfLines/ellipsizeMode passed as JSX props are dropped by the engine (style.c reads them as style) — no text clamped anywhere | FIXED (all clamps in style) |
| A12 | P1 | Themes | the customize editor's fixed-width controls painted past their column at 1080–1214px windows | FIXED (rows wrap) |
| A13 | P2 | themestudio | savedAppearance not recovered when an older record had active but no snapshot — deactivate restored nothing | FIXED |
| A14 | P2 | ThemeWidgets | PSI's −1 'no sensor' sentinel rendered a fake '−1%' | FIXED (≥ 0 guard) |
| A15 | P3 | ThemeWidgets | gpu busy is 0..100; the p100 heuristic made 1% read 100% | FIXED (always /100) |
| A16 | P3 | ThemeWidgets | audioOutput read sink.port (doesn't exist; description is the friendly name) | FIXED |
| A17 | P2 | ThemeWidgets | Pomodoro/Timer/Stopwatch froze while running (the stores notify only on state transitions) | FIXED (1 s ticker) |
| A18 | P2 | ThemeWidgets | pushHist advanced once per RENDER — duplicate widgets doubled the history rate; push-store notifies injected samples | FIXED (one sample per 3 s window) |
| A19 | P2 | Themes | style/geometry sliders persisted at frame rate (full validate+planDiffers+16 subscribers ×60/s) | FIXED (400 ms debounce, snapshot carried; apply/deactivate/reset flush) |
| A20 | P2 | Themes | the gallery re-resolved 26 plans per render during edits | FIXED (memo per theme + catalog) |
| A21 | P2 | Themes | undo history grew one step per slider pixel | FIXED (coalesced per 800 ms burst) |
| A22 | P2 | ThemeWidgets | every generic widget subscribed 8 push stores — a playing track re-rendered the hostname card each second | FIXED (subscribe by src family) |
| A23 | P3 | ThemeWidgets | time/ambient kinds all rode the 1 s ticker (moon/year/week re-rendered for nothing) | FIXED (60 s tsSlow) |
| A24 | P2 | ThemeWidgets | RingW's ring + caption exceeded the card (face − 6 where 18 was needed) | FIXED |
| A25 | P1 | ThemeWidgets | ValueW long rates wrapped and clipped out of 148×110 cards | FIXED (nowrap+ellipsis, style) |
| A26 | P2 | UX | the miniature overhung its card by 4px (border-box) | FIXED (220/502) |
| A27 | P3 | UX | textDecoration unsupported — two links lost their affordance | FIXED (border-bottom wrappers) |
| A28 | P3 | UX | 9px text under the readable floor | FIXED (10) |
| A29 | P3 | themestudio | tsResetInstance no-oped after a resolution change (plan ids carry the size) | FIXED (kind-ordinal fallback) |
| A30 | P3 | ThemeWidgets | tsInit and the bridge shared one try block — a screen-probe failure skipped the bridge | FIXED (split) |

Verified-clean (no finding): resolvePlan id stability across hidden toggles; every theme kind
exists in the spec table; every theme wallpaper id exists in the catalog; mon.c/info/net/weather
field shapes match the providers; nextAlarm/battery/qualityProfile shapes match; the
DesktopWidgets suppression cannot loop; settings load precedes tsInit.

## Known limitations (open, ledgered)

- L1: tsInit runs once at boot — a resolution change mid-session re-clamps the saved widgets but
  does not re-resolve the plan's scaled positions. Same limitation as the classic widgets.
- L2: tsInit/`insane.screen` are primary-display-only; a second display shows the composition
  clamped to its own area but positions were designed for the primary's. The classic system has
  the same shape today.
- L3: rich text (per-segment styling inside a widget) is Phase 2 §5 — not built yet.
- L4: drag-on-desktop for TS widgets (the PlaceLayer pattern) — the editor does geometry
  numerically today.
- L5: the classic Widgets page keeps its M1b control set (+/gear/segments); the Set|Preview|
  Customize triple currently ships on the Themes gallery. Unifying is §3 of this phase.
- L6: apparent_temperature is not in weather_admin.c's field list (wind/humidity/min/max are).

## Verification after the fixes

- node tests: model 111, store 60, themes 1503, specs 1241, widgetmodel 9, autohide 689 — green.
- i18n-check 12084/12084 (es/fr/it/pt), err-check 0 problems, brands ok.
- build-theme exit 0 (3009 KB bundle).
- Headless lab: zero react errors, zero missing-renderer/provider assertions, testbench 47 fps,
  paint 9.6 ms on the full-frame headless driver.
