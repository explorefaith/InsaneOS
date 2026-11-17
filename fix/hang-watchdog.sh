#!/usr/bin/env bash
# hang-watchdog.sh — catches the frozen compositor's backtrace by itself (run with sudo)
#
#     sudo bash fix/hang-watchdog.sh
#
# The Remove-from-Dock freeze hangs the compositor's main loop: the screen goes dark and the
# keyboard dies with it — the compositor itself handles Ctrl+Alt+Fn, so a frozen one can't even
# switch to a text console, and sessiond only takes the monitor back after a couple of minutes.
# Nobody can type anything in that window — so this script is armed BEFORE the reproduction and
# watches from outside: the session log goes quiet (a hung loop writes nothing) while the server
# is still alive; after 25 seconds of silence it attaches gdb to every insane-server process and
# writes the full backtraces — userspace and kernel — to /tmp/hang-bt.txt, then exits.
#
# gdb -batch attach is non-destructive: a healthy process is paused for a moment and released,
# so a false trigger costs nothing. To keep idle silence from counting as a freeze, the detector
# arms only after the log has been written once since this script started (hover the dock and
# the tp: lines arrive within a second — reproduce right after arming).
set -u
QUIET=25                        # seconds of log silence that count as frozen
OUT="/tmp/hang-bt.txt"
WLOG="/tmp/hang-watchdog.log"

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo: sudo bash $0"; exit 1; }
exec > >(tee "$WLOG") 2>&1      # the terminal is dead during the freeze; the file is not

command -v gdb >/dev/null || { echo "ERROR: no gdb — sudo apt install -y gdb first"; exit 1; }

# the session's user and home: the server's own command line carries --user <name>
U="$(pgrep -af 'insane-server' | grep -oP '(?<=--user )\S+' | head -1)"
[ -n "$U" ] || { echo "ERROR: no insane-server session running"; exit 1; }
UH="$(getent passwd "$U" | cut -d: -f6)"
LOG="$UH/.cache/insaneos/session.log"
echo "watching $LOG (quiet ${QUIET}s = frozen) — go reproduce now"

: > "$OUT"
ARM=$(stat -c %Y "$LOG" 2>/dev/null || echo 0)
SAW=0
while :; do
  sleep 2
  PIDS="$(pgrep -f "insane-server.*--user $U")"
  if [ -z "$PIDS" ]; then echo "session gone — no freeze caught, done"; exit 0; fi
  NOW=$(date +%s)
  M=$(stat -c %Y "$LOG" 2>/dev/null || echo 0)
  [ "$M" -gt "$ARM" ] && SAW=1                       # the log moved since arming: activity seen
  AGE=$((NOW - M))
  if [ "$SAW" -eq 1 ] && [ "$AGE" -ge "$QUIET" ]; then
    echo "[$(date '+%H:%M:%S')] log quiet ${AGE}s while alive — capturing all $(echo $PIDS | wc -w) process(es)"
    for p in $PIDS; do
      echo "===== pid $p userspace =====" >> "$OUT"
      timeout 90 gdb -p "$p" -batch -ex "thread apply all bt" >> "$OUT" 2>&1 || echo "gdb pid $p failed" >> "$OUT"
      echo "===== pid $p kernel =====" >> "$OUT"
      for t in /proc/$p/task/*/stack; do echo "-- $t" >> "$OUT"; cat "$t" >> "$OUT" 2>/dev/null; done
    done
    echo "CAPTURED -> $OUT"
    echo "wait for sessiond to take the monitor back (a couple of minutes) or reboot, then log in again"
    exit 0
  fi
done
