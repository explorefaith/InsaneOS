# INSANE OS — Phase 3 performance findings

## The measured baselines (headless lab, this branch)

| Run | Configuration | Result |
|---|---|---|
| L2 (Phase 2) | Themes page + Acid Press composition | 1461 frames, 55.8 fps |
| L4 (Phase 2 audit) | after the 30 fixes | paint 9.6–12.6 ms per full-frame headless render |
| L-final | after Phase 2 + 3 shell/WM/session rounds | zero react errors, paint ≈ 10 ms, bench 47–56 fps |

The headless driver damages the whole frame itself, so these are upper bounds, not the live
desktop's cost (the compositor-lab memory's rule).

## The design decisions that keep the desktop light (verified)

- **One shared timer per changing value** (sdk/ticker.js): a timer runs only while someone
  subscribes and stops with the last one — three clocks on three displays read one interval. The
  Phase-3 audit re-verified no module-level bare setInterval in the widget paths; the slow kinds
  (moon, year, week, countdown) ride a 60 s ticker, the measured kinds a 3 s one, clocks 1 s.
- **The monitor publishes only while wanted**: mon.c's thread sleeps when nobody reads it
  (`mon_want*` valves; the widgets' voltage/gpu/connections sources ask through the same flags),
  and the session's own CPU weight loses contention to apps (cgroup weights).
- **Store writes that never fire without a real change** (the React #185 rule): the Phase-2 audit
  added the value-compare to tsMutate, the per-src-family subscriptions (a playing track no
  longer repaints the hostname card), and the 400 ms persist debounce with a snapshot.
- **No per-frame layout writes**: drags commit once (beginDrag/endDrag), the studio canvas moves
  live but persists debounced, sliders coalesce history pushes.
- **The wallpaper yields first**: the ambient player runs at half the apps' CPU weight, presents
  at most 30 fps, pauses on PSI pressure, fullscreen, idle and low battery (docs/WALLPAPERS.md —
  the measured 639 ms p99 case is in fix/REALWORLD-TESTS.md).

## The Phase-3 fixes that removed real costs

- W1: the compositor's drag-end job drain now runs behind the 3 s interrupt budget — a runaway
  chain freezes nothing (it throws into the log like every other JS error).
- S-4/W5: the JS drag paths clamp in wm.move — no keep-windows-in-workareas rescues needed after
  a drag-out.
- BUG-022 (Phase 2): per-family push-store subscriptions — the biggest recurring render cost the
  audits found.

## Open observations (measured, not guessed)

- The two F-key grabs (W10) are a behavior question, not a performance one.
- Startup: main.c's init order was inspected by the session audit (theme → first frame; the boot
  time test restarts bounded by boots, cancelled by a login). A profiled boot-time pass on real
  hardware stays in the manual list.
