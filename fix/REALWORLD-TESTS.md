# Real-world responsiveness suite (round 3)

Reproducible scenarios for the "use the desktop under real workloads" question. Companion to
`fix/BENCHMARK-ROUND2.md` (the quiet-conditions InsaneBench procedure) and `fix/TEST-CHECKLIST.md`
(the parts that need eyes). Nothing here interpolates: every number below was taken by the suite on
the date shown, with its conditions.

## How to run

```sh
make -C server build/insaneos-testbench          # the measurer (a plain Wayland client)
bash fix/realworld-suite.sh A 12                 # A: idle/ambient
bash fix/realworld-suite.sh C1 12                # C1: all-core CPU at nice 0
bash fix/realworld-suite.sh C2 12                # C2: all-core CPU + memory traffic (half of RAM)
bash fix/realworld-suite.sh C3 12                # C3: memory-pressure balloon — see the warning
```

Results land in `fix/results-realworld-<date>/`: one testbench JSON per scenario and a
`SUMMARY.txt` with the conditions sample taken immediately before and after each measurement
(PSI memory/cpu, load, MemAvailable, swap), plus the compositor's own log lines from the window.
The load generator is `fix/rwload.c` (built by the script): CPU burn at the nice level of a real
build (0), a page-touched memory balloon with optional churn, and a memory-bandwidth churn — the
condition under which frames went GPU-late (`docs/GPU.md`).

What each scenario automates vs what needs eyes:

| Scenario | Automated here | Needs eyes (`fix/TEST-CHECKLIST.md`) |
|---|---|---|
| A idle | fps, frame-time p50/p99/max, dropped frames, vblank skips, PSI/mem/swap | — |
| B normal multitasking | — (the *ambient* load of the machine plays this role in every run; the conditions line records it) | opening/switching/dragging with the real apps |
| C1 CPU load | all of A under an all-core nice-0 burn | pointer feel during a build |
| C2 memory traffic | all of A under memory-bandwidth churn (the GPU-late condition) | — |
| C3 memory pressure | all of A near the freezer's freeze line | the wallpaper's pressure pause, the freezer's freeze/thaw |
| D visual | — | live wallpaper + dock hover + window resize + workspace switches |
| E recovery | — | wallpaper crash → try-again, display power transition, pressure recovery |

The testbench's own input-to-screen number needs the pointer over its window, so on a headless
session it reports `n=0`; its moving-card and frame stats do not need it.

## Version note (read before comparing)

The numbers below were taken against the **installed** session — a compositor binary from before
round 1 (`ps` start time and the round-2 report agree). The round-3 changes (pointer dispatch no
longer queued behind a late flip, the js_tick burst cap, the foreground cgroup weight, the
wallpaper's pressure pause, the dock's rAF coalescing) are **in the tree, not in these numbers**:
they reach a session through `fix/upgrade-insaneos.sh` and a re-login. Re-run this suite after
installing; that comparison is the one the charter asks for.

## Results — 2026-11-14, 00:58–01:02 (faith-pc, AC, kernel 6.12)

Machine state during the window: the user's ambient workload falling (load 5.3 → 3.2 → 6.2 → 8.3
under the generated loads), swap mostly reclaimed (0–876 MB across the runs), package temperature
unrecorded (not sampled by the suite; the thermal gate belongs to InsaneBench, not this suite).

| Scenario | Conditions (before → after) | fps | frame p50 | frame p99 | frame max | missed budget | vblank skips | presented | in-to-screen |
|---|---|---|---|---|---|---|---|---|---|
| A ambient | load 5.3→5.5, avail 2.5 GB, swap 2.4 GB | 49.8 | 16.7 | 34.6 | 59.0 | 3 | 83 | 497/499 | n=0 (headless) |
| C1 all-core nice-0 | load 3.2→6.2, PSI cpu some10 44 % | 41.2 | 17.0 | 52.0 | 79.2 | 41 | 197 | 494/496 | n=0 (headless) |
| C2 CPU + memory traffic | load 6.0→8.3, PSI mem some10 25–50 %, swap 0→876 MB | 18.8 | 32.8 | **639.3** | **706.3** | 157 | 460 | 224/226 | **338 ms** (n=3) |

The compositor's own touchpad lines in the same window (installed binary, ambient + the suite's
loads): typical sequence averages 0.09–0.3 ms read→dispatch, with bursts reaching 15.7–45.7 ms —
the loop was busy or preempted before the device could be read, and (on real hardware, not this
headless session) the queued flip adds its share behind that.

## What the numbers say, and what round 3 changes because of it

1. **CPU load costs budget frames; memory traffic costs everything.** C1 (pure CPU contention)
   keeps 41 fps with a p99 of 52 ms. C2 (memory-bandwidth churn driving PSI memory stalls and
   swap) collapses the frame p99 to 639 ms and the testbench's in-to-screen to 338 ms. A CFS
   weight — even the compositor's 10× — cannot buy back a page-wait stall; only not creating the
   pressure does. This is the direct evidence for round 3's wallpaper `pressure` pause (the first
   decoder to stop, thresholds aligned with the background freezer) and for keeping the freezer
   service enabled.
2. **The pointer must not queue behind the GPU.** The flip gate (dispatch waited for the main
   display's page flip to complete, `fpipe.h` without the pipeline) stretches with exactly these
   GPU-late frames. Round 3 dispatches pointer motion once the queued flip misses its vblank
   (1.25 periods), and bounds a burst of due JS timers at 8 ms so events are read between waves.
   Prediction for the re-run after install: the C2 dispatch percentiles (the `tp:` lines and, with
   `INSANE_INPUT_DEBUG=1`, the new `insaneos-pointerlag.log` percentiles) should stop tracking the
   frame-time tail.
3. **The foreground has a lever now.** The focused app's scope weighs 400 against 100 (and the
   wallpaper's decoder 50) — C1-class loads take from the background first. These numbers were
   taken without it (installed binary).

## C3 — the memory-pressure scenario: warning

`C3` balloons to ~600 MB short of MemTotal, which crosses the background freezer's freeze line
(PSI some avg10 ≥ 40 % with < 400 MB available): **real applications on the session will be
SIGSTOPped** (up to five per pass, never the protected list, never audio holders). It was *not*
run against this session — the user's own work was open. Run it when the machine is free; the
expected observations are in the checklist: the wallpaper pauses with reason `pressure` (hysteresis
`motionmodel.PRESSURE`), the freezer logs freezes in `~/.cache/insaneos/freeze/log`, and input
stays dispatchable because nothing in the freeze path touches the compositor.
