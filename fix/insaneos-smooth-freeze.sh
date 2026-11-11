#!/usr/bin/env bash
# insaneos-smooth-freeze.sh — pressure-based background app freezer for InsaneOS.
#
# When memory (or CPU) pressure gets high, stops (SIGSTOP) heavy background
# processes so the PC stays smooth; wakes them (SIGCONT) when pressure drops or
# they come back to the foreground. The desktop shell (insane-server) reports which
# pids are on screen to ~/.cache/insaneos/fgpids.json (sdk/windows.js + insane.wm.nodePid).
#
# Never touches: insane-server/sessiond/insane-* helpers, audio servers, the user
# systemd manager, terminals-in-use, ZCode, ssh/dbus, or anything with an open
# audio connection (video calls keep running).
#
#   run with no arguments  — watch loop (the systemd service)
#   run with "thaw"        — wake everything and exit
set -u
UID_N="$(id -u)"
CACHE="$HOME/.cache/insaneos/freeze"
FGFILE="$HOME/.cache/insaneos/fgpids.json"
LOG="$CACHE/log"
STATE="$CACHE/frozen.list"
mkdir -p "$CACHE"
touch "$STATE"

log() { printf '%s %s\n' "$(date '+%H:%M:%S')" "$*" >>"$LOG"; }
tail -c 200000 "$LOG" 2>/dev/null | head -c 100000 >"$LOG.tmp" && mv "$LOG.tmp" "$LOG" 2>/dev/null

thaw_all() {
  [ -s "$STATE" ] || return 0
  while read -r pid; do
    kill -CONT "$pid" 2>/dev/null && log "thaw $pid"
  done <"$STATE"
  : >"$STATE"
}
trap 'thaw_all; exit 0' INT TERM

# argument: thaw — wake everything and exit (used by the service's stop hook)
if [ "${1:-}" = "thaw" ]; then thaw_all; exit 0; fi

# ---- policy ----------------------------------------------------------------
FREEZE_MEM_AVG60=25      # % memory pressure (PSI, 60s avg) to start freezing
FREEZE_MEM_AVG10=40      # ... or a burst, if available RAM is also low
FREEZE_AVAIL_KB=400000   # "low RAM" line (~400 MB)
THAW_MEM_AVG60=8         # wake everything below this pressure...
THAW_AVAIL_KB=1200000    # ...and with this much available (~1.2 GB)
MIN_RSS_KB=150000        # only bother with processes holding >~150 MB
MAX_FREEZE_PER_PASS=5
PASS_EVERY=10            # seconds between freeze passes

frozen_count() { wc -l <"$STATE" 2>/dev/null || echo 0; }

fg_pids() {                # pids the shell says are on screen (never freeze these)
  [ -r "$FGFILE" ] || return 0
  python3 -I - "$FGFILE" <<'PY' 2>/dev/null
import json, sys
try:
    d = json.load(open(sys.argv[1]))
    if d.get("ts", 0) > 0:
        print("\n".join(str(p) for p in d.get("fg", []) if isinstance(p, int) and p > 1))
except Exception:
    pass
PY
}

protected() {              # name-based never-freeze list
  case "$1" in
    *insane-server*|*insane-sessiond*|*insane-*|*insaneos-*|*sessiond*) return 0 ;;
    *pipewire*|*wireplumber*|*pulseaudio*|*pipewire-pulse*) return 0 ;;
    *systemd*|*dbus*|*gnome-keyring*|*sshd*|*polkit*|*pkexec*) return 0 ;;
    *zcode*|*/opt/ZCode/*|*node*) return 0 ;;      # ZCode session must never stop
    *Xwayland*|*xwayland*) return 0 ;;
    *insaneos-smooth-freeze*) return 0 ;;
    *) return 1 ;;
  esac
}

has_audio() {              # process holds the audio server socket: a call or music
  for fd in /proc/"$1"/fd/*; do
    [ -L "$fd" ] || continue
    t="$(readlink "$fd")"
    case "$t" in *pipewire*|*pulse*|*snd*) return 0 ;; esac
  done 2>/dev/null
  return 1
}

mem_pressure() {           # PSI some avg60 (percent)
  awk '/^some/ {for (i = 1; i <= NF; i++) if ($i ~ /^avg60=/) { sub("avg60=", "", $i); print ($i + 0); exit } }' /proc/pressure/memory 2>/dev/null
}
mem_pressure10() {
  awk '/^some/ {for (i = 1; i <= NF; i++) if ($i ~ /^avg10=/) { sub("avg10=", "", $i); print ($i + 0); exit } }' /proc/pressure/memory 2>/dev/null
}
mem_avail_kb() { awk '/^MemAvailable:/ {print $2}' /proc/meminfo 2>/dev/null; }
load1() { awk '{print int($1)}' /proc/loadavg 2>/dev/null; }
ncpu() { nproc 2>/dev/null || echo 4; }

thaw_if_foreground() {     # a frozen app the user brought back: wake it at once
  [ -s "$STATE" ] || return 0
  local fg
  fg="$(fg_pids)"
  [ -n "$fg" ] || return 0
  local woke=0
  : >"$STATE.new"
  while read -r pid; do
    case ",$fg," in *",$pid,"*)
      kill -CONT "$pid" 2>/dev/null && { log "thaw $pid (foreground)"; woke=1; }
    ;; *)
      echo "$pid" >>"$STATE.new"
    ;; esac
  done <"$STATE"
  mv "$STATE.new" "$STATE"
}

freeze_pass() {
  local n_frozen
  n_frozen="$(frozen_count)"
  local fg; fg="$(fg_pids)"; fg=",$fg,"
  local count=0 pid rss cmd
  # heaviest first: RSS desc, own user only, with a real cmdline
  for pid in $(ls /proc 2>/dev/null | grep -E '^[0-9]+$'); do
    [ "$count" -ge "$MAX_FREEZE_PER_PASS" ] && break
    [ "$pid" = "$$" ] && continue
    grep -qxF "$pid" "$STATE" 2>/dev/null && continue
    [ -r "/proc/$pid/status" ] || continue
    grep -q "^Uid:\s*$UID_N\b" "/proc/$pid/status" 2>/dev/null || continue
    rss="$(awk '/^VmRSS:/ {print $2}' "/proc/$pid/status" 2>/dev/null)"
    [ -n "$rss" ] && [ "$rss" -ge "$MIN_RSS_KB" ] || continue
    cmd="$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null)"
    [ -n "$cmd" ] || continue                     # kernel thread
    protected "$cmd" && continue
    case ",$fg," in *",$pid,"*) continue ;; esac   # on screen: never freeze
    has_audio "$pid" && continue                  # call/music keeps playing
    if kill -STOP "$pid" 2>/dev/null; then
      echo "$pid" >>"$STATE"
      log "freeze $pid rss=${rss}kB cmd=${cmd:0:80}"
      count=$((count + 1))
    fi
  done
  [ "$count" -gt 0 ] && log "frozen $count (total $(frozen_count))"
}

log "watcher started (pid $$)"
LAST_PASS=0
while :; do
  p60="$(mem_pressure)"; p10="$(mem_pressure10)"; avail="$(mem_avail_kb)"
  p60="${p60:-0}"; p10="${p10:-0}"; avail="${avail:-999999999}"

  thaw_if_foreground

  should_freeze=0
  if awk "BEGIN{exit !($p60 >= $FREEZE_MEM_AVG60)}" 2>/dev/null; then should_freeze=1; fi
  if awk "BEGIN{exit !($p10 >= $FREEZE_MEM_AVG10 && $avail < $FREEZE_AVAIL_KB)}" 2>/dev/null; then should_freeze=1; fi
  # CPU crunch: sustained overload and something heavy in the background
  if [ "$should_freeze" = 0 ] && [ "$(load1)" -ge $(( $(ncpu) * 3 / 2 )) ] && [ "$(frozen_count)" -eq 0 ]; then
    c60="$(awk '/^some/ {for (i = 1; i <= NF; i++) if ($i ~ /^avg60=/) { sub("avg60=", "", $i); print ($i + 0); exit } }' /proc/pressure/cpu 2>/dev/null)"
    [ -n "$c60" ] && awk "BEGIN{exit !($c60 >= 45)}" 2>/dev/null && should_freeze=1
  fi

  now="$(date +%s)"
  if [ "$should_freeze" = 1 ] && [ $((now - LAST_PASS)) -ge "$PASS_EVERY" ]; then
    LAST_PASS="$now"
    freeze_pass
  elif [ "$should_freeze" = 0 ]; then
    if awk "BEGIN{exit !($p60 <= $THAW_MEM_AVG60 && $avail >= $THAW_AVAIL_KB)}" 2>/dev/null && [ -s "$STATE" ]; then
      log "pressure recovered: thawing all"
      thaw_all
    fi
  fi
  sleep 1
done
