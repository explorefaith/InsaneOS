#!/bin/sh
# install-insaneos.sh — builds and installs the new "Insane OS" session (0.8.8.6 + rebrand +
# glass panels + NaN fix) BESIDE the previously installed desktop session on this computer.
#
# ── Nothing on this computer is deleted ──────────────────────────────────────────
#   • the previously installed desktop package and every one of its files stay installed
#     and intact; it is a different package name, and the new package has no Conflicts/Replaces.
#   • your data (the previous session's folders under ~/.config, ~/.local/share and
#     ~/.cache — settings, vault, mail, apps, wallpapers) is COPIED with `cp -a` to the
#     new names the new session reads. The originals are never moved, edited or removed.
#   • the only machine-state changes are three reversible ones:
#       - apt installs new packages (addition only),
#       - one dpkg diversion switch for /usr/bin/pkexec (documented rollback below),
#       - `systemctl enable`/`disable` symlinks (which greeter starts at boot).
#   Every step is safe to run again.
# ─────────────────────────────────────────────────────────────────────────────────
set -e
REPO="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO"
OUT="$HOME/insaneos-install"
J="-j$(nproc)"

echo "── 1/8 build dependencies (freerdp headers for Remote Desk, clang for netperm's BPF)"
# Debian trixie's freerdp3 dev package is "freerdp3-dev" (it carries the freerdp3,
# freerdp-client3 and winpr3 pkg-config files), not libfreerdp3-dev
sudo apt-get install -y --no-install-recommends freerdp3-dev libwinpr3-dev clang

echo "── 2/8 build the C binaries that are missing (Remote Desk helper)"
make -C server $J build/insane-rdesk

echo "── 3/8 build the themes (React bundles: glass sliders, NaN fix inside)"
npm run build

echo "── 4/8 build the packages (into $OUT)"
mkdir -p "$OUT"
# TTS is left out on purpose: this tree has no third_party/audiocpp source to build it from
# (the installed desktop has it; everything else is at parity). ALLOW_MISSING is mkdeb's own
# sanctioned switch for that. COEXIST=1 leaves out /etc/gtk-*/settings.ini, which the
# previously installed package owns — the session gives apps its own values through the
# settings portal.
COEXIST=1 ALLOW_MISSING="insane-tts" tools/iso/mkdeb.sh "$OUT/insaneos_0.8.8.6_amd64.deb"
tools/iso/mkdeb-hwdata.sh "$OUT" >/dev/null && echo "hwdata: ok"
if [ -f /tmp/insaneos-debs/insaneos-rclone_1.75.2-1_amd64.deb ]; then
    cp /tmp/insaneos-debs/insaneos-rclone_1.75.2-1_amd64.deb "$OUT/"
else
    tools/iso/mkdeb-rclone.sh "$OUT" amd64 >/dev/null && echo "rclone: ok"
fi

echo "── 5/8 free the /usr/bin/pkexec diversion so the new package can take it"
# the previously installed package's postinst diverted /usr/bin/pkexec; two packages cannot
# both divert it. This does NOT remove any file: it renames pkexec.distrib back to
# /usr/bin/pkexec and clears that package's runtime diversion. (Rollback is printed at the end.)
if dpkg-divert --list | grep -q "pkexec.*by lordos"; then
    # the old package left a wrapper SYMLINK at /usr/bin/pkexec (its own pkexec binary); the
    # divert's rename needs that name free. This one symlink is replaced — the new package's
    # postinst recreates it pointing at insane-pkexec (and the rollback below recreates the old
    # one). The binary it pointed to, inside the old package's lib directory, is never touched.
    sudo rm -f /usr/bin/pkexec
    sudo dpkg-divert --package lordos --rename --remove /usr/bin/pkexec
else
    echo "no previous diversion of pkexec — nothing to do"
fi

echo "── 6/8 install the four packages (addition only; the installed desktop stays)"
sudo apt-get install -y \
    "$OUT"/insaneos_0.8.8.6_amd64.deb \
    "$OUT"/insaneos-hwdata_*.deb \
    "$OUT"/insaneos-rclone_*.deb

echo "── 7/8 copy your settings, vault and mail to the new names (cp -a: the originals stay)"
[ -d "$HOME/.config/lordos" ]      && [ ! -e "$HOME/.config/insaneos" ]      && cp -a "$HOME/.config/lordos"      "$HOME/.config/insaneos"      && echo "config: copied"
[ -d "$HOME/.local/share/lordos" ] && [ ! -e "$HOME/.local/share/insaneos" ] && cp -a "$HOME/.local/share/lordos" "$HOME/.local/share/insaneos" && echo "data (vault, mail, apps): copied"
[ -d "$HOME/.cache/lordos" ]       && [ ! -e "$HOME/.cache/insaneos" ]       && cp -a "$HOME/.cache/lordos"       "$HOME/.cache/insaneos"       && echo "cache: copied"

echo "── 8/8 switch the boot greeter: the previous session's services off, Insane OS's on (reversible symlinks)"
# the old package ships three enabled services (its greeter, fan control and network
# permissions); the new ones take over, so the old ones are disabled — nothing is removed
for s in lordos.service lord-fand.service lord-netperm.service; do
    sudo systemctl disable "$s" 2>/dev/null || true
done
sudo systemctl enable insaneos.service
# the boot splash with the new apple mark (optional, skipped silently if absent)
if [ -f /usr/share/plymouth/themes/insaneos/insaneos.plymouth ]; then
    sudo update-alternatives --set default.plymouth /usr/share/plymouth/themes/insaneos/insaneos.plymouth || true
fi

echo
echo "✅ done. Reboot to see it:"
echo "     sudo reboot"
echo
echo "At the login screen you are on the new Insane OS session (apple mark, glass panels,"
echo "Settings → Wallpaper → Glass sliders, Memory widget fixed)."
echo
echo "── Rollback to the previously installed session (nothing needs reinstalling) ──"
echo "If anything is wrong: press Ctrl+Alt+F3, log in, then paste:"
echo "    sudo systemctl disable insaneos.service insane-fand.service insane-netperm.service"
echo "    sudo systemctl enable lordos.service lord-fand.service lord-netperm.service"
echo "    sudo dpkg-divert --package insaneos --rename --remove /usr/bin/pkexec"
echo "    sudo dpkg-divert --package lordos --rename --divert /usr/bin/pkexec.distrib --add /usr/bin/pkexec"
echo "    sudo ln -sfn ../lib/lordos/bin/lord-pkexec /usr/bin/pkexec"
echo "    sudo reboot"
echo
echo "Notes:"
echo "  • the boot greeter now offers ONE login screen — the new one. The previously"
echo "    installed session's files are all still on the disk; the rollback above puts it back on tty1."
echo "  • Voice/TTS is the one feature this build ships without (no audiocpp source in"
echo "    this tree). Everything else — Remote Desk, Media, Docs, OCR, passwords, mail —"
echo "    is built and packaged."
echo "  • System Information's Compatibility panel may say the hardware snapshot is"
echo "    'not verified': this dev build packages it unsigned."
