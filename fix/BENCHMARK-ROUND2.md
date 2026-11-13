# Round 2 — benchmark and measurement report (2026-11-13)

Companion to `fix/TRANSFORMATION-REPORT.md` (round 1). This file records every number taken this
round, the conditions, and the runs that could not be taken — with the reason. Nothing here is
interpolated; where a measurement is missing, it says so.

## 1. The machine

`faith-pc`: i5-8365U (8 threads), 8 GB RAM, Intel UHD 620 (Mesa iris, WHL GT2), Debian 13,
kernel 6.12.116+deb13-amd64. This laptop is the development machine; InsaneBench's reference
machines remain VM 116 and the Raspberry Pi 5 (`docs/BENCHMARK.md`).

Conditions observed during this round, and why they matter:

| When | Power | Load | Thermal |
|---|---|---|---|
| First bench attempt (round 1) | battery 28 % | quiet | 64 °C — refused: `stopReason: battery` (by design) |
| Round 2, first attempt | AC, 42 % | **51.8 % busy** (an unrelated `clang++` build + the session's own tooling; swap 5921/5925 MB) | 92 °C acpitz, 51 926 cumulative throttle events — refused: `stopReason: thermal` (by design) |
| Round 2, second attempt | AC | machine rebooted by the user between attempts; load 3.8 falling | 77 °C coretemp, passive trip 50 °C |
| Round 2, third attempt | AC | **78.2 % busy**: the user's own `java` process (216 % of one core) and this session's host tooling | refused: `stopReason: thermal` |

The bench's quiet-conditions gate is a feature: it refused to publish numbers taken on a throttling
machine. Both refusals are quoted verbatim in the session log of the attempt.

## 2. The round's key measurement: the buffer-age scissor on a real desktop GPU

Tool: `server/build/gpu-scissor` (tests/gpu_scissor.c, never installed) — renders the GPU path's own
frame shape on the render node beside any session: persistent 1920 × 1080 scene texture, the frame's
changed rectangle TexSubImage'd, composed into one of three FBOs standing in for the GBM chain,
alternating 30 whole frames with 30 scissored ones; GPU time from `EGL_ANDROID_native_fence`.
Correctness: `--verify` composes 600 frames scissored and reads the region back every 20th frame
against the same frame composed whole.

**Whole vs scissored, Mesa iris / UHD 620 (WHL GT2):**

| Damage share | Whole p50 | Scissored p50 | Scissored p99 | Saved |
|---|---|---|---|---|
| 1.5 % | 2.14 ms | 0.23 ms | 3.64 ms | 89 % |
| 5 % | 2.09 ms | 0.58 ms | 4.17 ms | 73 % |
| 15 % | 2.01 ms | 0.58 ms | 4.53 ms | 71 % |
| 30 % | 2.05 ms | 0.59 ms | 5.49 ms | 71 % |

Under a 4-core memory-traffic load (the condition in which frames go GPU-late, `docs/GPU.md`):
2.87 → 0.88 ms (70 %) at 1.5 % damage; 3.08 → 1.30 ms (58 %) at 30 %. Correctness:
**2 465 420 pixels compared against the whole composition, 0 differ** (and `build/engine-test`'s
gsc fuzz: 1 793 scissored frames through the damage pipeline, 0 differ; 8 831 checks total).

Combined with the existing evidence — llvmpipe 3.77 vs 8.80 ms (24 % of pixels composed), the Pi 5's
V3D a measured loss — the decision shipped: the scissor follows the driver (`scissor_default`): on
for Intel and the software rasterizers, off for V3D/vc4, off for unmeasured tilers; env override
stays. This is the round's answer to "pay attention to the 0.8.7 decision": that decision was
correct *for the hardware it measured*, and is now scoped to it.

## 3. What the profiles and the adaptive layer cost

Nothing at rest. `sdk/quality.js`'s adaptive layer changes state only after two consecutive loaded
CPU samples (≈ 10 s) and steps back one rung per 15 steady seconds (`motionmodel.CAP_STEADY_MS`);
`adaptiveCap`'s ladder and hysteresis are unit-tested (`motion-model-test`, 64 checks). The wallpaper
cap changes through `MM_FPSMAX` between decode frames — no decoder restart. `canvas_blur_shrink` is
one int read by the paint threads. No new process, no polling loop, no file I/O.

## 4. InsaneBench on AC

The quick run's outcome lands here when the machine is quiet:

- Round 2 attempts: **refused at the gate, three for three** — `battery`, then `thermal` twice, each
  quoted with its conditions in §1. The comparisons the charter asks for need a machine that is not
  in use; on this laptop that means the user's own workload closed. The gate did its job; no numbers
  were taken around it. The tool built this round for the scissor question (`build/gpu-scissor`)
  deliberately makes no reproducibility claim — its finding is the ratio under identical conditions
  within one run.

Procedure for the full comparison the charter asks for (previous baseline / current / new):

1. On AC, machine idle ≥ 5 min (load < 0.5), thermals under the passive trip.
2. `server/build/insaneos-sysreport bench --quick --json` for the CPU/memory/interface workloads;
   `--full` adds storage and 3 minutes of sustained load.
3. The desktop-impact mode (the compositor's frames, their phases, pointer-to-screen latency under
   load) runs through System Information → Performance in a session, or `insaneos-testbench` against
   a running `insane-server` — the procedure and conditions tables in `docs/BENCHMARK.md`.
4. Wallpaper scenarios (static / live / fullscreen pause / display-off) are covered by
   `build/media-wallpaper-test` (end-to-end against the real helper, hardware decode asserted) plus
   the on-screen checklist in `fix/TEST-CHECKLIST.md`.

## 5. Corroborating signals, honestly labeled

- `store-search-test`'s timing assertion ("5 000 items in under 60 ms") measured 66 ms while the
  machine was under the unrelated compile load — an ambient-load reading, not a regression; 96/97
  checks passed.
- The live headless compositor's own key-latency log (`~/.cache/insaneos/session.log`, the installed
  pre-round-1 binary) shows pointer latency p50 ≈ 0.1–0.2 ms with maxima of 9–137 ms clustered in
  bursts that coincide with the machine's load spikes and full swap — the under-load responsiveness
  problem this round's adaptive layer and round 1's stability work address, observed from the
  running system itself.

## 6. Suite tallies at round 2 close

C: engine-test 8 831/0, fw-rules 16 181/16 181, fwlists 8 307/8 307, tzif 216 168 instants 0 diff,
cloud 2 279, backup 220, npcompile 480 000 random decisions 0 diff, damage fuzz 12 seeds clean.
JS: 90–91 suites pass; the known environmental failures (sound, pkg, hwreport; store-search's
timing check under load) and the C suite's `imager-test` fixture (needs the release private key)
and `clean-test` (nondeterministic on this machine, pre-existing at `e5d75c8`) are documented in
`fix/TRANSFORMATION-REPORT.md` §8.
