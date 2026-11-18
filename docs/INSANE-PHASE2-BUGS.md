# INSANE OS — Phase 2 bug tracker

Every discovered issue with its actual resolution. Status: DISCOVERED → INVESTIGATING → FIXING →
FIXED → TESTING → VERIFIED. Nothing is VERIFIED without evidence (the lab log, a test run, or a
quoted command output). The full findings table with evidence lives in
[INSANE-PHASE2-AUDIT.md](INSANE-PHASE2-AUDIT.md).

## Fixed + verified (round 1 — the three independent audits)

| ID | Sev | One line | Status | Evidence |
|---|---|---|---|---|
| BUG-001 | P0 | nightActive used as a store → every generic widget crashed at mount | VERIFIED | lab session.log: 0 react errors after the fix; tests green |
| BUG-002 | P0 | AddDialog: 21 of 105 kinds unreachable (no scroll, 2 tiles/row) | VERIFIED | ScrollView + 3×168 tiles; build + i18n green |
| BUG-003 | P1 | netHistory ×1048576 inflation (fake number) | VERIFIED | provider now divides like ioHistory |
| BUG-004 | P1 | sunTimes wrong field names (rise/set vs sunrise/sunset) | VERIFIED | hardware.jsx:102 cross-checked |
| BUG-005 | P1 | volume read sink.volume (array) instead of sink.level | VERIFIED | hwkeys.js:12 cross-checked |
| BUG-006 | P1 | bluetooth read b.powered instead of adapter.powered | VERIFIED | bt.c state json cross-checked |
| BUG-007 | P1 | calendar/reminders async called in render — fake empty/todoCount 0 | VERIFIED | pimCache + null-until-loaded |
| BUG-008 | P1 | gradient→picture switch left the old wallpaperBg over the new wallpaper | VERIFIED | Backdrop precedence; pair written together |
| BUG-009 | P1 | voltage/gpu/connections never turned their monitor sources on | VERIFIED | wantAndTake + last-good cache |
| BUG-010 | P1 | timerLeft (ms) formatted as seconds; countdowns froze while running | VERIFIED | ms math + 1 s ticker on the three timing cards |
| BUG-011 | P1 | numberOfLines/ellipsizeMode passed as props — the engine drops them | VERIFIED | style.c reads them as style; all clamps moved |
| BUG-012 | P1 | editor controls painted past their column at 1080–1214 px | VERIFIED | rows wrap; text fields shrink |
| BUG-013 | P2 | savedAppearance lost on shape drift — deactivate restored nothing | VERIFIED | re-snapshot fallback |
| BUG-014 | P2 | PSI −1 sentinel rendered '−1%' | VERIFIED | ≥0 guard |
| BUG-015 | P3 | gpu busy 1 % → 100 % (p100 heuristic) | VERIFIED | always /100 |
| BUG-016 | P3 | audioOutput read sink.port (nonexistent) | VERIFIED | description/activePort |
| BUG-017 | P2 | Pomodoro/Timer/Stopwatch froze while running | VERIFIED | tsClock subscription |
| BUG-018 | P2 | pushHist advanced once per render (duplicates corrupted the rate) | VERIFIED | one sample per 3 s window |
| BUG-019 | P2 | sliders persisted at frame rate (validate+planDiffers+16 subscribers ×60/s) | VERIFIED | 400 ms debounce with snapshot; flush on switch |
| BUG-020 | P2 | gallery re-resolved 26 plans per render | VERIFIED | memo per theme + catalog |
| BUG-021 | P2 | slider drags grew one undo step per pixel | VERIFIED | 800 ms coalescing |
| BUG-022 | P2 | every generic widget subscribed 8 push stores (playing track repainted everything, 1 Hz) | VERIFIED | subscribe by src family |
| BUG-023 | P3 | moon/year/week rode the 1 s ticker | VERIFIED | 60 s tsSlow |
| BUG-024 | P2 | RingW clipped its caption | VERIFIED | face reserves the caption |
| BUG-025 | P1 | ValueW long rates wrapped out of their cards | VERIFIED | nowrap+ellipsis in style |
| BUG-026 | P2 | miniatures overhung their border-box cards by 4 px | VERIFIED | 220/502 widths |
| BUG-027 | P3 | textDecoration unsupported — links lost their affordance | VERIFIED | border-bottom wrappers |
| BUG-028 | P3 | 9 px text | VERIFIED | 10 px floor |
| BUG-029 | P3 | tsResetInstance no-oped after a resolution change | VERIFIED | kind-ordinal fallback |
| BUG-030 | P3 | tsInit and the bridge shared one try block | VERIFIED | split; bridge installs first |

## Fixed + verified (round 2 — the interaction audit)

| ID | Sev | One line | Status |
|---|---|---|---|
| BUG-031 | P1 | Studio canvas: the root's onClick deselected every block on mouseup | VERIFIED (blocks stop the click) |
| BUG-032 | P1 | all four editor Toggles passed value= (SDK prop: on=) — never turned off | VERIFIED |
| BUG-033 | P1 | Wallpaper login-apply of a user picture passed the stripped name → admin.invalidArgument every time | VERIFIED (full id through setLoginImage, incl. stopLive) |
| BUG-034 | P2 | the slider-undo coalescer held its timer in the render body — never coalesced | VERIFIED (useRef) |
| BUG-035 | P2 | the Arrange row never landed in the editor (a patch had silently no-matched); validList stripped `locked` | VERIFIED (row present; locked persists) |
| BUG-036 | P3 | tsMutate's no-change guard was dead code — edge nudges left junk undo entries | VERIFIED (value comparison) |
| BUG-037 | P3 | canvas drag listeners leaked on unmount mid-drag | VERIFIED (unmount cleanup) |
| BUG-038 | P3 | a blank rename closed the dialog silently | VERIFIED (error note) |

## Open (ledgered, not bugs — known limitations)

- L1: plan positions don't re-scale on a mid-session resolution change (saved widgets re-clamp).
- L2: compositions are primary-display-shaped; multi-display placement follows the classic
  system's current shape.
- L3: in-place text selection inside a widget (click a word → style it) is not possible with the
  engine's input model; the segment editor is the equivalent path (add/split/remove runs).
- L4: TS widgets' drag lives in the Studio canvas; a drag directly on the desktop (the classic
  PlaceLayer pattern) is not wired yet.
- L5: the classic Widgets page keeps its icon control row; the Set|Preview|Customize triple
  ships on the Themes gallery (unification pending).
- L6: apparent_temperature missing from weather_admin.c's field list.

## Safety ledger (process bugs, not code)

- 2026-11-19: two `pkill -f` patterns during lab cleanup crashed the user's LIVE desktop to the
  login screen twice. Lab instances are killed only by the PID captured at launch; no pattern
  that can match `insane-server` may ever be killed by name. (memory: compositor-lab-profiling)
