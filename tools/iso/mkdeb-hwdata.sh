#!/bin/sh
# mkdeb-hwdata.sh — builds insaneos-hwdata_<version>_all.deb: the signed tested-hardware snapshot for System
# Information's Compatibility panel (docs/BENCHMARK.md, "Newer snapshots between releases").
#
#   tools/iso/mkdeb-hwdata.sh <output folder>      (from the repository root; needs dpkg-deb)
#
# Prints only the path of the package on standard output. Contents, nothing else:
#   /usr/lib/insaneos/assets/hwreport/snapshot.json       assets/hwreport/snapshot.json (tools/hwreport/catalog.mjs)
#   /usr/lib/insaneos/assets/hwreport/snapshot.json.sig   its Ed25519 signature with the release key
#                                                       (tools/release/sign-hwsnapshot.sh, the maintainer's machine)
#   /usr/share/doc/insaneos-hwdata/                       copyright, changelog
#
# insane-server reads the two files on every insane.sysinfo.community() call and verifies the signature in C before
# parsing (server/src/sysreport/hwsnap.c), so the package is only a way to deliver them: the insaneos package
# Depends on it, and a newer one published alone in the signed APT repository reaches every system through the
# daily update check and Store → Updates, between Insane OS releases (docs/RELEASING.md, "A newer hardware snapshot").
#
# Version: the snapshot's "generated" date (its newest report) as YYYY.MM.DD, plus .N from HWDATA_SERIAL=N
# (1..99) for a second, different snapshot with the same date. The package is reproducible: the same snapshot
# and signature give the same bytes (file times, the changelog date and the archive times come from that date),
# so apt-repo.sh accepts it again unchanged and refuses a different one under the same version.
#
# REQUIRE_SIGNED_CODE=1 (a release) refuses a missing signature and checks it with openssl against
# tools/release/insaneos-release.pub.pem (CODE_PUB=<public.pem> for a throwaway test key).
#
# The format rule: while any supported insaneos reads format 1, this package carries format 1. The build refuses
# any other format until someone adds the matching Breaks: insaneos (<< first version that reads it) here.
set -eu
OUTDIR=${1:?usage: mkdeb-hwdata.sh <output folder>}
SNAP=assets/hwreport/snapshot.json
SIG=assets/hwreport/snapshot.json.sig
[ -f package.json ] && [ -d assets ] || { echo "mkdeb-hwdata.sh: run from the repository root" >&2; exit 1; }
[ -f "$SNAP" ] || { echo "missing $SNAP (node tools/hwreport/catalog.mjs, or tools/release/sign-hwsnapshot.sh)" >&2; exit 1; }
[ -d "$OUTDIR" ] || { echo "no such folder: $OUTDIR" >&2; exit 1; }
command -v dpkg-deb >/dev/null || { echo "missing dpkg-deb" >&2; exit 1; }

# the snapshot's own header, as catalog.mjs writes it (compact JSON, these keys first)
head=$(head -c 200 "$SNAP")
case "$head" in
    '{"format":"insaneos-hwsnapshot","version":1,"generated":"'*) ;;
    *) echo "$SNAP is not a insaneos-hwsnapshot of format 1: add Breaks for older insaneos versions first (see the header)" >&2; exit 1 ;;
esac
GEN=$(printf %s "$head" | sed -n 's/^{"format":"insaneos-hwsnapshot","version":1,"generated":"\([0-9]\{4\}-[0-9][0-9]-[0-9][0-9]\)".*/\1/p')
[ -n "$GEN" ] || { echo "$SNAP: no generated date (YYYY-MM-DD)" >&2; exit 1; }
VERSION=$(printf %s "$GEN" | tr - .)
case "${HWDATA_SERIAL:-}" in
    "") ;;
    [1-9]|[1-9][0-9]) VERSION="$VERSION.$HWDATA_SERIAL" ;;
    *) echo "HWDATA_SERIAL must be a number from 1 to 99" >&2; exit 1 ;;
esac

if [ "${REQUIRE_SIGNED_CODE:-0}" = 1 ]; then
    [ -f "$SIG" ] || { echo "missing $SIG: sign it on the maintainer's machine (tools/release/sign-hwsnapshot.sh)" >&2; exit 1; }
    command -v openssl >/dev/null || { echo "openssl is needed to check $SIG" >&2; exit 1; }
    pub=${CODE_PUB:-tools/release/insaneos-release.pub.pem}
    t=$(mktemp)
    base64 -d < "$SIG" > "$t" 2>/dev/null || { rm -f "$t"; echo "$SIG is not base64" >&2; exit 1; }
    openssl pkeyutl -verify -pubin -inkey "$pub" -rawin -in "$SNAP" -sigfile "$t" >/dev/null 2>&1 || {
        rm -f "$t"; echo "$SIG does not verify $SNAP with $pub: sign the snapshot again after rebuilding it" >&2; exit 1; }
    rm -f "$t"
elif [ ! -f "$SIG" ]; then
    echo "warning: $SIG missing: System Information will say the snapshot is not verified" >&2
fi

# GNU date (Debian) or BSD date
EPOCH=$(date -u -d "$GEN" +%s 2>/dev/null || date -u -j -f %Y-%m-%d "$GEN" +%s)
STAMP=$(printf %s "$GEN" | tr -d -)0000
RFC=$(LC_ALL=C date -u -R -d "@$EPOCH" 2>/dev/null || LC_ALL=C date -u -j -r "$EPOCH" '+%a, %d %b %Y %H:%M:%S +0000')

PKG=$(mktemp -d)
trap 'rm -rf "$PKG"' EXIT
H="$PKG/usr/lib/insaneos/assets/hwreport"
D="$PKG/usr/share/doc/insaneos-hwdata"
install -d "$H" "$D" "$PKG/DEBIAN"
install -m 644 "$SNAP" "$H/snapshot.json"
[ -f "$SIG" ] && install -m 644 "$SIG" "$H/snapshot.json.sig"
cat > "$D/copyright" <<'C'
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: Insane OS
Source: https://github.com/insaneos/Insane OS

Files: *
Copyright: 2026 iPERFEX and the Insane OS contributors
License: Expat
 The snapshot is built by tools/hwreport/catalog.mjs from the hardware reports
 accepted in the Insane OS repository (web/content/hardware/reports); it holds
 device keys, Insane OS versions and counts, no personal data.
 .
 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:
 .
 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.
 .
 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.
C
printf 'insaneos-hwdata (%s) trixie; urgency=medium\n\n  * The tested-hardware snapshot of %s, built by tools/iso/mkdeb-hwdata.sh.\n\n -- Insane OS <insane.basex@gmail.com>  %s\n' \
    "$VERSION" "$GEN" "$RFC" | gzip -9n > "$D/changelog.gz"
chmod 644 "$D/copyright" "$D/changelog.gz"
(cd "$PKG" && find usr -type f | LC_ALL=C sort | xargs md5sum) > "$PKG/DEBIAN/md5sums"
SIZE=$(du -sk "$PKG/usr" | awk '{print $1}')
cat > "$PKG/DEBIAN/control" <<C
Package: insaneos-hwdata
Version: $VERSION
Architecture: all
Multi-Arch: foreign
Maintainer: Insane OS <insane.basex@gmail.com>
Installed-Size: $SIZE
Section: misc
Priority: optional
Homepage: https://github.com/insaneos/Insane OS
Description: tested-hardware snapshot for Insane OS System Information
 The signed snapshot of the hardware reports accepted for Insane OS: for each
 device and Insane OS version, how many reports say it works, works with limits
 or doesn't work. System Information's Compatibility panel shows it only after
 checking its Ed25519 signature with the Insane OS release key. Updated between
 Insane OS releases through the Insane OS repository.
C
chmod 644 "$PKG/DEBIAN/control" "$PKG/DEBIAN/md5sums"
find "$PKG" -type d -exec chmod 755 {} +
# every time from the snapshot's date, the archive's own times too (dpkg-deb reads SOURCE_DATE_EPOCH)
find "$PKG" -exec env TZ=UTC touch -h -t "$STAMP" {} +
OUT="$OUTDIR/insaneos-hwdata_${VERSION}_all.deb"
SOURCE_DATE_EPOCH=$EPOCH dpkg-deb --root-owner-group -Zxz --build "$PKG" "$OUT" >/dev/null
echo "$OUT"
