#!/usr/bin/env bash
# install-asan-debug.sh — install the AddressSanitizer/UBSan debugging build (run with sudo)
#
#     sudo bash fix/install-asan-debug.sh
#
# Installs server/build/insane-server-asan — the same server compiled with
# -g -O1 -fsanitize=address,undefined -fno-sanitize-recover=all. A memory bug that silently
# kills the normal build (a crash on, say, Remove from Dock) then writes its full report —
# the exact file:line and a backtrace — to the session log (stderr) before dying, and the
# session log survives the restart (session.log.prev, main.c's rotation).
# The report is the bug's address: the next crash names it.
#
# This build is 2–5x slower and uses more memory: a debugging session's tool, not a daily build.
# Going back is the usual REVERT.sh this script writes next to its backup.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$REPO/server/build/insane-server-asan"
DEST="/usr/lib/insaneos/bin/insane-server"
TS="$(date +%Y%m%d-%H%M%S)"
BK="/var/backups/insaneos-asan-$TS"

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo: sudo bash $0"; exit 1; }
[ -x "$SRC" ] || { echo "ERROR: $SRC not found — build it first:"; echo "  cd server && find build/obj -name '*.o' -delete && \\"
  echo "    make CFLAGS='-O1 -g -fno-omit-frame-pointer -fsanitize=address,undefined -fno-sanitize-recover=all' LDFLAGS='-fsanitize=address,undefined' build/insane-server && \\"
  echo "    mv build/insane-server build/insane-server-asan && make build/insane-server"; exit 1; }
# the build must carry the sanitizer runtime (grep -c, not -q: -q exits at the first match, nm then
# dies of SIGPIPE and, with pipefail on, the check fails even on a match)
SYMS="$(nm "$SRC" 2>/dev/null | grep -c asan_report || true)"
[ "$SYMS" -ge 1 ] || { echo "ERROR: $SRC has no sanitizer runtime — wrong build"; exit 1; }

mkdir -p "$BK"
cp -a "$DEST" "$BK/insane-server"
cat > "$BK/REVERT.sh" <<EOF
#!/usr/bin/env bash
# Restores the pre-ASan insane-server backed up beside this script.
set -euo pipefail
[ "\$(id -u)" -eq 0 ] || { echo "Run with sudo"; exit 1; }
install -o root -g root -m 755 "$BK/insane-server" "$DEST"
echo "reverted: \$DEST"
echo "log out and back in for it to take effect"
EOF
chmod +x "$BK/REVERT.sh"

install -o root -g root -m 755 "$SRC" "$DEST"

echo "installed: $DEST  ($(stat -c%s "$DEST") bytes, sanitizer build)"
echo "backup:    $BK/insane-server"
echo
echo "Done. Log out and back in, then reproduce the crash once (Remove from Dock)."
echo "The report lands in ~/.cache/insaneos/session.log — send that file's tail back."
echo "To undo: sudo bash $BK/REVERT.sh"
