#!/usr/bin/env bash
# hang-watchdog.sh — catches the frozen display's full state by itself (run with sudo)
#
#     sudo bash fix/hang-watchdog.sh
#
# The Remove-from-Dock freeze: the screen goes dark and the keyboard dies with it, but the
# compositor's main loop stays healthy (the first capture caught it idling in poll) — so the
# question is what turned the DISPLAY off, not what wedged the loop. This script is armed
# BEFORE the reproduction and watches from outside: the session log goes quiet (a hung or
# dark loop with no input writes nothing) while the server is still alive; after 25 seconds
# of silence it captures everything the moment knows — the DRM connectors' dpms/status, gdb
# backtraces WITH locals of every insane-server process, the kernel stacks, the last lines
# of the session log (what preceded the silence) and sessiond's journal tail — then keeps
# watching and captures a second stage at 70 s (has anything changed?), then exits.
#
# gdb -batch attach is non-destructive; a false trigger (an idle desktop's quiet log — the
# detector needs one log write after arming first) costs a moment's pause and nothing else.
set -u
OUT="/tmp/hang-bt.txt"
WLOG="/tmp/hang-watchdog.log"

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo: sudo bash $0"; exit 1; }
exec > >(tee "$WLOG") 2>&1      # the terminal is dead during the freeze; the file is not
command -v gdb >/dev/null || { echo "ERROR: no gdb — sudo apt install -y gdb first"; exit 1; }

U="$(pgrep -af 'insane-server' | grep -oP '(?<=--user )\S+' | head -1)"
[ -n "$U" ] || { echo "ERROR: no insane-server session running"; exit 1; }
UH="$(getent passwd "$U" | cut -d: -f6)"
LOG="$UH/.cache/insaneos/session.log"
echo "watching $LOG — go reproduce now (arm → hover the dock → Remove from Dock)"

: > "$OUT"
ARM=$(stat -c %Y "$LOG" 2>/dev/null || echo 0)
SAW=0
STAGES=(25 70)
DONE=0
while :; do
  sleep 2
  PIDS="$(pgrep -f "insane-server.*--user $U")"
  if [ -z "$PIDS" ]; then echo "session gone — done"; exit 0; fi
  NOW=$(date +%s)
  M=$(stat -c %Y "$LOG" 2>/dev/null || echo 0)
  [ "$M" -gt "$ARM" ] && SAW=1                     # the log moved since arming: activity seen
  AGE=$((NOW - M))
  if [ "$SAW" -eq 1 ] && [ "$AGE" -ge "${STAGES[$DONE]}" ]; then
    DONE=$((DONE + 1))
    echo "[$(date '+%H:%M:%S')] silence ${AGE}s — capture stage $DONE"
    {
      echo "########## stage $DONE at $(date '+%H:%M:%S') (silence ${AGE}s) ##########"
      echo "---- DRM connectors ----"
      for c in /sys/class/drm/card[0-9]-*/; do
        echo "$(basename "$c"): dpms=$(cat "$c/dpms" 2>/dev/null) status=$(cat "$c/status" 2>/dev/null) enabled=$(cat "$c/enabled" 2>/dev/null)"
      done
      echo "---- session.log last 15 lines (what preceded the silence) ----"
      tail -15 "$LOG"
      echo "---- sessiond journal tail ----"
      journalctl -b --no-pager 2>/dev/null | grep -iE "sessiond|monitor|greeter|session" | tail -25
      for p in $PIDS; do
        echo "---- pid $p gdb (full) ----"
        timeout 120 gdb -p "$p" -batch -ex "set pagination off" -ex "thread apply all bt full" >> "$OUT" 2>&1 || echo "gdb pid $p failed"
        echo "---- pid $p kernel stacks ----"
        for t in /proc/$p/task/*/stack; do echo "-- $t" >> "$OUT"; cat "$t" >> "$OUT" 2>/dev/null; done
      done
      echo "########## stage $DONE done ##########"
    } >> "$OUT" 2>&1
    [ "$DONE" -lt "${#STAGES[@]}" ] || { echo "CAPTURED -> $OUT"; echo "wait for sessiond (a couple of minutes) or reboot, then log in again"; exit 0; }
    echo "stage $DONE written; watching for stage 2 at ${STAGES[$DONE]}s"
  fi
done
