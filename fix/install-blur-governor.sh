#!/usr/bin/env bash
# install-blur-governor.sh — install the blur frame-budget governor build (run with sudo)
#
#     sudo bash fix/install-blur-governor.sh
#
# Swaps in server/build/insane-server (the verified build with the compositor's
# backdrop-blur governor: the blur's downsample rises when the blur itself eats
# more than a third of the frame budget, and steps back when frames are light).
# The old binary is backed up to /var/backups/insaneos-blurfix-<time>/ with a
# REVERT.sh next to it. Takes effect at the next login (the running session keeps
# its own image; nothing is disturbed while you are logged in).
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$REPO/server/build/insane-server"
DEST="/usr/lib/insaneos/bin/insane-server"
TS="$(date +%Y%m%d-%H%M%S)"
BK="/var/backups/insaneos-blurfix-$TS"

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo: sudo bash $0"; exit 1; }
[ -x "$SRC" ] || { echo "ERROR: $SRC not found — build it first (cd server && make build/insane-server)"; exit 1; }
# the build must carry the governor's entry point (grep -c, not -q: -q exits at the first match,
# nm then dies of SIGPIPE and, with pipefail on, the check fails even on a match)
SYMS="$(nm "$SRC" 2>/dev/null | grep -c blur_shrink_floor || true)"
[ "$SYMS" -ge 1 ] || { echo "ERROR: $SRC has no blur_shrink_floor — wrong build"; exit 1; }
# and it must be newer than the newest source it was built from (a stale build fails here)
[ "$SRC" -nt "$REPO/server/src/main.c" ] || { echo "ERROR: $SRC is older than the sources — rebuild first (cd server && make build/insane-server)"; exit 1; }

mkdir -p "$BK"
cp -a "$DEST" "$BK/insane-server"
cat > "$BK/REVERT.sh" <<EOF
#!/usr/bin/env bash
# Restores the pre-governor insane-server backed up beside this script.
set -euo pipefail
[ "\$(id -u)" -eq 0 ] || { echo "Run with sudo"; exit 1; }
install -o root -g root -m 755 "$BK/insane-server" "$DEST"
echo "reverted: \$DEST"
echo "log out and back in (or reboot) for it to take effect"
EOF
chmod +x "$BK/REVERT.sh"

install -o root -g root -m 755 "$SRC" "$DEST"

echo "installed: $DEST  ($(stat -c%s "$DEST") bytes)"
echo "backup:    $BK/insane-server"
echo "sha256 new: $(sha256sum "$DEST" | cut -d' ' -f1)"
echo "sha256 old: $(sha256sum "$BK/insane-server" | cut -d' ' -f1)"
echo
echo "Done. Log out and back in (or reboot) for the fix to take effect."
echo "To undo: sudo bash $BK/REVERT.sh"
