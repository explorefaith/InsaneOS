# Round 3 — real-world responsiveness & interaction engineering (2026-11-14)

Third round of the transformation charter (`fix.md`). Companions: `fix/TRANSFORMATION-REPORT.md`
(round 1: stability, wallpaper recovery, caches), `fix/BENCHMARK-ROUND2.md` (round 2: the scissor
measurement, adaptive quality, honest bench refusals). Everything below is in this tree, built and
tested; nothing was measured that the tools could not measure, and every gap says so.

## 1. Where the pointer latency actually accumulates (the audit)

The observed spikes (p50 0.1–0.2 ms, maxima 9–137 ms, correlated with load and swap) decompose
into four stages, now each measured by its own instrument:

1. **evdev → read.** The compositor is deliberately single-threaded (`main.c` main loop): when a
   frame's work (JS timers, layout, paint, upload) runs long, device reads wait behind it. The
   `tp:` lines in the session log measure exactly this for touchpads: 0.08–0.26 ms typical,
   bursts to 45.7 ms. **Two hidden amplifiers found this round:** a burst of due JS timers runs up
   to 64 `js_tick` rounds back-to-back before the next device read, and — on real hardware —
2. **read → dispatch.** Pointer motion is coalesced once per frame, *behind the main display's
   page flip* (`fpipe.h` without the pipeline: `fpipe_blocked` = "while its flip is pending"). A
   flip that misses its vblank (the GPU busy under load — round 2's measured GPU-late frames)
   stretches this gate to the frame's lateness. Buttons and wheels already bypassed it.
3. **dispatch → present.** JS work, paint, GPU submission, vblank. Paced by design; bounded by the
   refresh period plus the frame's own cost.
4. **the machine.** Under memory-pressure storms the stalls are page-waits, and **no scheduler
   knob buys them back** (measured below: C2).

## 2. What was changed

**Input (`server/src/main.c`, `input.c`, new `plag.c`)**
- `motion_due`: pointer motion dispatches once the queued flip is more than one refresh period
  old (1.25 periods — it missed its vblank), instead of waiting for the flip. Dispatching early
  cannot present anything (render stays flip-gated); it only runs the JS side and the clients,
  and the once-per-frame coalescing still holds. InsaneBench's scripted step keeps the strict
  wait (its steps must map to presented frames).
- The JS timer burst yields after 8 ms wall clock (previously up to 64 rounds): the rest runs next
  loop iteration, and device reads happen between the waves.
- **`plag` — a pointer latency trace like `keylag`:** with `INSANE_INPUT_DEBUG=1`, three stages
  (evdev→read, read→dispatch, dispatch→flip) recorded per motion batch, percentile lines
  (p50/p95/p99/max, µs) every 5 s to `$XDG_RUNTIME_DIR/insaneos-pointerlag.log` (0600, timestamps
  only, line cap, same privacy rules as keylag). Pointer devices now stamp `CLOCK_MONOTONIC`
  (`EVIOCSCLOCKID`, as touchpads already did) so the kernel timestamp is read directly.

**Foreground priority (`sec/cgroup.c`, new `sec/fgprio.c`, `wl/wl.c`, `media/`)**
- The focused app's cgroup scope weighs **400** against **100** for every other scope
  (`CG_FG_CPU_WEIGHT`); the previously focused one goes back down. Plain CFS weights inside the
  session subtree — no real-time, nothing starves, the background keeps its share whenever the
  foreground sleeps. The compositor follows the keyboard focus (`wl_set_focus`) and asks root via
  a new `weight <scope> <1..10000>` verb on the existing `/run/insaneos/cgroup.sock` service
  (peer must still be in its session's `server` leaf; scope must exist; both verbs behind the same
  trust checks). The wire format stays backward/forward compatible (an older sessiond's `sscanf`
  ignores the new trailing weight; a newer sessiond accepts the old four-field form).
- Not eligible by design: the compositor's own leaf, Xwayland's (its windows' processes live
  elsewhere — attribution cannot follow the X focus), helpers, anything outside the session
  subtree. Without insane-sessiond the feature quietly does nothing.
- **The wallpaper's decode yields:** an ambient player (wallpaper, login screen) enters its scope
  at weight **50** (`CG_WALLPAPER_CPU_WEIGHT`, `ambient=1` in the play params) — between the
  adaptive cap's steps it loses contention to any app. Content the user plays keeps the default.

**Live wallpaper under real workload (`js_sys.c`, `sdk/motionmodel.js`, `sdk/motion.jsx`)**
- `insane.system.pressure()`: PSI memory "some" (avg10/avg60) + MemAvailable, two small reads.
- `motionmodel.memoryPressure`: the wallpaper is the **first decoder to stop** under real memory
  pressure (some60 ≥ 25 %, or a burst avg10 ≥ 40 % with < 400 MB free — the background freezer's
  own signals) and the **last to restart** (some60 < 15 % and 800 MB free). A new non-optional
  `pressure` pause reason, like `screenOff`. A pause costs nothing (the still image is already
  drawn underneath) and no helper is restarted — `MM_PAUSE`, not a teardown. Existing crash
  recovery and static fallback untouched.

**Interaction (`themes/default`, `sdk`)**
- **Dock magnification** recomputes once per frame now (rAF coalescing of the latest pointer
  position) instead of once per pointermove event — a full Dock re-layout at the dispatch rate ran
  exactly when the machine is busiest; a 1000 Hz mouse now costs the Dock one layout per display
  refresh.
- **Window restore** got the genie: the same engine warp the minimize effect uses
  (`canvas_genie_blit`), driven 1→0 so the strips fly back out of the Dock icon. Reduce Motion
  keeps the plain appearance; fullscreen/pip windows (no icon) skip it. The window is interactive
  while it settles — the warp only changes how it is painted.
- **Control Center and Launchpad** got the panel entrance their design tokens already define
  (`DUR.panel` 160 ms rise+fade through `useTween`, Reduce Motion honored); closing stays instant
  — a panel that lingers behind its click would feel slow.
- The close/open window ramps still run on their own timers (pre-existing; the shared `useTween`
  migration is noted as future work, no behavior change was made for its own sake).

**Docs:** `docs/WALLPAPERS.md` (the pressure pause), `docs/SESSIONS.md` (the weights),
`docs/TROUBLESHOOTING.md` (the pointerlag trace), `fix/TEST-CHECKLIST.md` §10 (the on-screen
round-3 checks), `fix/REALWORLD-TESTS.md` (the suite).

## 3. Measurements (this round's own numbers)

**The real-world suite** (`fix/realworld-suite.sh`, `fix/rwload.c`; full conditions tables and the
honest gaps in `fix/REALWORLD-TESTS.md`), against the live session, 2026-11-14 00:58–01:02:

| Scenario | fps | frame p50 | frame p99 | frame max | missed budget | vblank skips | in-to-screen |
|---|---|---|---|---|---|---|---|
| A ambient | 49.8 | 16.7 | 34.6 | 59.0 | 3 | 83 | n=0 (headless) |
| C1 all-core nice-0 | 41.2 | 17.0 | 52.0 | 79.2 | 41 | 197 | n=0 (headless) |
| C2 CPU + memory traffic | 18.8 | 32.8 | **639.3** | **706.3** | 157 | 460 | **338 ms** |

The finding that shaped the round: **CPU load costs budget frames; memory traffic costs
everything.** C1 keeps 41 fps; C2 (PSI memory some10 25–50 %, swap filling) collapses the frame
p99 to 639 ms and the input-to-screen to 338 ms. The compositor's 10× CPU weight cannot buy back a
page-wait — hence the pressure pause, the yielding wallpaper decode, and the freezer staying on.

**InsaneBench: refused at the gate, fourth honest refusal in three rounds** — `stopReason:
"thermal"` (machine 99 % busy with this round's own test run, passive trip 50 °C vs 64 °C, battery
63 %, quiet gate waited 30 s), quoted verbatim from `--quick --json`. Procedure when the machine
is free: `fix/BENCHMARK-ROUND2.md` §4.

**C3 (memory-pressure balloon) was deliberately not run** against this session: it crosses the
freezer's freeze line and would SIGSTOP the user's real applications. Command documented in
`fix/REALWORLD-TESTS.md` with the expected observations.

## 4. Validation

- C suite: `make test` stops at the documented pre-existing `imager-test` fixture (the release
  signature does not verify against the repo's public key — needs the maintainer's private key,
  unchanged since round 1); `make -k test` continues past it. Tallies at the round's close:
  engine-test (damage fuzz + drag goldens, includes this round's dispatch-gate change),
  fpipe-test, **cgweight-test 18/18 (new)**, fw-rules 16181/16181, tzif, npcompile, timer-order,
  cloud, backup… — see `fix/INSANE-OS-PROGRESS.md` session 7 for the exact tallies.
- JS suites: **90 passed, 4 failed** — the same documented environmental set as rounds 1–2
  (sound, pkg, hwreport; store-search's timing check under ambient load). `motion-model-test`
  carries the round's 10 new pressure checks (78 ok).
- The version note that bounds every comparison: the running session's compositor predates round 1
  (`fix/REALWORLD-TESTS.md`). This round's C changes reach a session through
  `fix/upgrade-insaneos.sh` + re-login; the suite should be re-run then — that before/after is
  the comparison the charter asks for, and it is recorded as pending, not claimed.

## 5. Remaining limitations (carried honestly)

- X11 apps do not get the foreground weight (attribution cannot follow the X focus through
  Xwayland's scope); Wayland-native apps — the browsers, the terminals, the .lpk apps — do.
- The `weight` verb needs the round's `insane-sessiond` installed; until then it answers
  `err request` and the compositor stops asking for the session's lifetime.
- No semantic focus tree yet (round 1's note stands): mouse-driven controls still have no
  focus-visible rings; keyboard-first surfaces (Launchpad, menus, Spotlight, text fields) are
  unchanged and covered.
- The pressure pause reacts on the shell's 5 s tick; a memory storm's first seconds are covered by
  the freezer (which acts on its own 10 s loop) and by the kernel's reclaim, not by the wallpaper.
- `imager-test`'s 2-check fixture, `clean-test`'s nondeterminism on this machine, and the sound/
  pkg/hwreport/store-search environmental failures remain as documented in rounds 1–2.

## 6. Install

```sh
cd fix && sudo bash upgrade-insaneos.sh && sudo reboot
```

Then `fix/TEST-CHECKLIST.md` §10 (dock feel, restore genie, CC/Launchpad entrances, pointer under
build load, the focused scope's weight, the pressure pause) and
`bash fix/realworld-suite.sh all 12` before/after comparison.
