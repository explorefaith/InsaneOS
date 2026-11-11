#!/bin/sh
# make-auto-disk.sh — a small ISO labelled INSANEOSAUTO with insaneos-auto.conf in it, for the live ISO's
# unattended install (docs/UNATTENDED.md). Attach it to a virtual machine as a second CD drive.
#
#   tools/iso/make-auto-disk.sh insaneos-auto.conf insaneos-auto.iso
#
# Needs xorriso (or genisoimage). It checks nothing in the file: insane-autoinstall does, on the machine.
set -eu
CONF=${1:?usage: make-auto-disk.sh insaneos-auto.conf out.iso}
OUT=${2:?usage: make-auto-disk.sh insaneos-auto.conf out.iso}
[ -f "$CONF" ] || { echo "make-auto-disk.sh: no file $CONF" >&2; exit 1; }
[ "$(wc -c < "$CONF")" -le 16384 ] || { echo "make-auto-disk.sh: $CONF is over 16384 bytes" >&2; exit 1; }
D=$(mktemp -d)
trap 'rm -rf "$D"' EXIT
cp "$CONF" "$D/insaneos-auto.conf"
chmod 644 "$D/insaneos-auto.conf"
if command -v xorriso > /dev/null; then
    xorriso -as mkisofs -quiet -V INSANEOSAUTO -J -r -o "$OUT" "$D"
elif command -v genisoimage > /dev/null; then
    genisoimage -quiet -V INSANEOSAUTO -J -r -o "$OUT" "$D"
else
    echo "make-auto-disk.sh: needs xorriso or genisoimage" >&2; exit 1
fi
echo "$OUT"
