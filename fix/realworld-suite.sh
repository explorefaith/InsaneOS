#!/usr/bin/env bash
# realworld-suite.sh — the real-world responsiveness scenarios (fix/REALWORLD-TESTS.md), run against
# a running Insane OS session (a headless one counts: the input path and the frame pacing are the
# same code; only what needs eyes is left to fix/TEST-CHECKLIST.md).
#
# Usage:  bash fix/realworld-suite.sh [A|C1|C2|all] [seconds]
#
# Scenarios:
#   A    idle/ambient: the session as the user left it — fps, frame-time percentiles, dropped
#        frames, vblank skips, PSI, memory, swap
#   C1   heavy CPU: an all-core burn at nice 0 (like the user's own builds) while measuring
#   C2   heavy CPU + memory traffic (the condition under which frames went GPU-late, docs/GPU.md)
#   C3   memory pressure: a balloon pushed to the freezer's freeze line (DANGEROUS-ISH: the
#        pressure freezer will SIGSTOP real apps; run it when the machine is free, never on a
#        session the user is working in)
#
# Everything lands in fix/results-realworld-<date>/ : one JSON per scenario, a SUMMARY.txt, and the
# compositor's own log lines (drag stats, touchpad latency) that accumulated during the run.
set -u
cd "$(dirname "$0")/.."
OUT="fix/results-realworld-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
SECS="${2:-12}"
SCEN="${1:-all}"
TB="server/build/insaneos-testbench"
RW="fix/build/rwload"
CC="cc -O2 -o $RW fix/rwload.c -lpthread"

log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$OUT/SUMMARY.txt"; }
snap() {  # a one-line conditions sample: PSI memory/cpu, MemAvailable, swap used, load
  { cat /proc/pressure/memory 2>/dev/null | head -2 | tr '\n' ' ';
    cat /proc/pressure/cpu 2>/dev/null | head -1 | tr '\n' ' ';
    printf 'load=%s ' "$(cut -d' ' -f1 /proc/loadavg)";
    awk '/MemAvailable/{printf "avail=%dMB ", $2/1024} /SwapTotal/{t=$2} /SwapFree/{printf "swapused=%dMB", (t-$2)/1024}' /proc/meminfo; } \
    >> "$OUT/SUMMARY.txt" 2>/dev/null
}
tb() {  # $1 label; runs the testbench and pulls the headline numbers into the summary
  local label="$1"
  local json="$OUT/$label.json"
  snap
  timeout $(( SECS + 30 )) "$TB" --auto "$SECS" > "$json" 2>> "$OUT/SUMMARY.txt"
  snap
  python3 - "$json" "$label" >> "$OUT/SUMMARY.txt" <<'EOF'
import json, sys
d = json.load(open(sys.argv[1]))
l = sys.argv[2]
print("%s: fps=%.1f frameMs p50=%.2f p99=%.2f max=%.2f missedBudget=%d vblankSkips=%d presented=%d/%d in-to-screen=%s"
      % (l, d.get("fps", 0), d.get("frameMsP50", 0), d.get("frameMsP99", 0), d.get("frameMsMax", 0),
         d.get("missedBudget", 0), d.get("vblankSkips", 0), d.get("presented", 0), d.get("frames", 0),
         ("n=%d avg=%.2fms" % (d["latency"]["n"], d["latency"]["avgMs"])) if d.get("latency") else "n/a"))
EOF
}
[ -x "$TB" ] || { echo "testbench missing: make -C server build/insaneos-testbench" >&2; exit 1; }
mkdir -p fix/build
[ -x "$RW" ] || $CC || { echo "rwload build failed" >&2; exit 1; }
log "== real-world suite $(date -Is), session: $(pgrep -u "$USER" -x insane-server | head -1 || echo none), conditions follow each scenario =="
case "$SCEN" in
  A|all)
    log "-- A: idle/ambient (no generated load) --"
    tb A ;;
esac
case "$SCEN" in
  C1|all)

    log "-- C1: all-core CPU at nice 0, ${SECS}s --"
    "$RW" cpu "$(nproc)" "$SECS" & RW1=$!
    sleep 1; tb C1; wait $RW1 ;;
esac
case "$SCEN" in
  C2|all)

    log "-- C2: all-core CPU + memory traffic (half of RAM), ${SECS}s --"
    "$RW" churn "$(( $(awk '/MemTotal/{print int($2/2048)}' /proc/meminfo) ))" "$(nproc)" "$SECS" & RW2=$!
    sleep 1; tb C2; wait $RW2 ;;
esac
case "$SCEN" in
  C3)

    log "-- C3: memory pressure balloon — the freezer will stop real apps; Ctrl+C to abort in 10s --"
    sleep 10
    "$RW" mem "$(( $(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo) - 600 ))" "$SECS" 1 & RW3=$!
    sleep 1; tb C3; wait $RW3 ;;
esac
log "-- compositor log lines from this run (drag stats, touchpad latency, gpu) --"
grep -E "drag|tp:|gpu:|kms:" ~/.cache/insaneos/session.log 2>/dev/null | tail -40 >> "$OUT/SUMMARY.txt"
log "== done: $OUT =="
