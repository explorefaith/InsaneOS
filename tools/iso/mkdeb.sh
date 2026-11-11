#!/bin/sh
# mkdeb.sh — builds insaneos_<version>_<arch>.deb from the already compiled tree.
# Usage: tools/iso/mkdeb.sh <output.deb>     (from the repository root; needs dpkg-deb)
#
# Contents:
#   /usr/lib/insaneos/bin/insane-sessiond     sessions, login screen and remote desktop (root)
#   /usr/lib/insaneos/bin/insane-netperm      per-app network permissions with cgroup BPF (root, own service)
#   /usr/lib/insaneos/bin/insane-netd         system networking (root; launched and watched by insane-sessiond)
#   /usr/lib/insaneos/bin/insane-fand         fan control by temperature (root, own service, enabled)
#   /usr/lib/insaneos/bin/insane-autoinstall  the live ISO's unattended install (root, insaneos-autoinstall.service; docs/UNATTENDED.md)
#   /usr/lib/insaneos/bin/insane-pkexec       /usr/bin/pkexec on Insane OS, no privilege (docs/PRIVACY.md); the real one
#                                         is diverted to /usr/bin/pkexec.distrib by postinst
#   /usr/lib/insaneos/bin/insane-server       each session's server (looks for ../themes and ../assets)
#   /usr/bin/insaneos-sysreport             System Information's report and InsaneBench as a command (user;
#                                         docs/BENCHMARK.md): a link to /usr/lib/insaneos/bin/insaneos-sysreport,
#                                         which starts the insane-bench and insane-media next to it
#   /usr/bin/insaneos-fetch                 the apple and a summary of the computer (a link to the same binary)
#   /usr/bin/insaneos-issue                 what a bug report needs, ready to paste (CONTRIBUTING.md)
#   /usr/bin/insaneos-testbench             the visual test bench (a Wayland client; docs/PAPER-VALIDATION.md), and
#   /usr/share/applications/insaneos-testbench.desktop   its launcher entry
#   /usr/lib/insaneos/themes/<theme>/       theme.json, theme.bundle.js and their resources (greeter: the
#                                         login screen)
#   /usr/lib/insaneos/assets/               fonts, texts (locales), icons, shell integration
#   /usr/lib/insaneos/code-manifest.json    SHA-256 of every bundle Insane OS runs as its own code, and
#   /usr/lib/insaneos/code-manifest.sig     its Ed25519 signature (release key; docs/SIGNING.md)
#   /usr/lib/insaneos/insaneos-live-prep      live preparation (grub language, folders)
#   /usr/lib/systemd/system/insaneos.service  insane-sessiond on tty1
#   /usr/lib/insaneos/insaneos-splash         boot splash hand-off (Plymouth → Insane OS, docs/SESSIONS.md)
#   /usr/share/backgrounds/insaneos/        the wallpapers (<category>/insaneos-<name>.jpg, thumbs/), linked
#                                         from /usr/lib/insaneos/assets/wallpapers
#   /usr/share/plymouth/themes/insaneos/    the boot splash theme (selected by the ISO, the Raspberry Pi
#                                         image or install.sh; the package never selects it)
#   /usr/share/grub/themes/insaneos/        the boot menu theme (the ISO's disk installer and install.sh; unused on a Pi)
#   /usr/share/doc/insaneos/                README, copyright, changelog, OFL-Noto.txt
#   /usr/share/glib-2.0/schemas/90_insaneos.gschema.override, /etc/gtk-{3,4}.0/settings.ini
#                                         GTK's window-button layout where the session can't give its own (#52)
#   (not here: /usr/lib/insaneos/assets/hwreport/, the signed tested-hardware snapshot, is the insaneos-hwdata
#   package from tools/iso/mkdeb-hwdata.sh, which this one Depends on; docs/BENCHMARK.md)
#   /usr/lib/insaneos/apt/insaneos.sources    the signed Insane OS repository on insaneos.org (updates from the
#                                         Store and apt; docs/UPDATES.md): postinst copies it to
#                                         /etc/apt/sources.list.d/ when missing, postrm removes it
#   /usr/share/keyrings/insaneos-archive-keyring.gpg   the key that signs that repository
#   /usr/lib/insaneos/migrate, migrations/  version-to-version system migrations, run by postinst
#   /etc/kernel/postinst.d/zz-insaneos-reboot-required  "restart required" after a kernel update
#   /usr/lib/modules-load.d/insaneos-drivetemp.conf    SATA disk temperatures (drivetemp) at boot
#   /usr/lib/systemd/system/smartmontools.service.d/insaneos.conf  Debian's smartd stays off
#   /usr/lib/systemd/user/gnome-keyring-daemon.service.d/insaneos.conf  gnome-keyring without the Secret Service
#   /usr/lib/systemd/logind.conf.d/insaneos-machines.conf  a shutdown waits up to 30 s for Machines to save running machines
#   /usr/share/chromium/extensions/insaneos-video/  Insane OS's own browser extension for smooth video without
#                                         hardware decoding (Debian's chromium loads every folder there;
#                                         docs/VIDEO.md). Its settings are written at login by the
#                                         admin action video-optimize, not shipped (postrm removes them)
set -eu
OUT=${1:?uso: mkdeb.sh salida.deb}
ROOT=$(pwd)
VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' package.json | head -1)
[ -x server/build/insane-server ] || { echo "missing server/build/insane-server (make -C server)" >&2; exit 1; }
[ -x server/build/insane-netperm ] || { echo "missing server/build/insane-netperm (make -C server; clang for BPF)" >&2; exit 1; }
[ -x server/build/insane-netd ] || { echo "missing server/build/insane-netd (make -C server)" >&2; exit 1; }
[ -x server/build/insane-fand ] || { echo "missing server/build/insane-fand (make -C server)" >&2; exit 1; }
[ -x server/build/insaneos-sysreport ] || { echo "missing server/build/insaneos-sysreport (make -C server)" >&2; exit 1; }
[ -x server/build/insane-sessiond ] || { echo "missing server/build/insane-sessiond (make -C server, with libssl-dev, libsrtp2-dev and libusrsctp-dev)" >&2; exit 1; }
# The helpers make builds only when their -dev packages are installed (docs/VM-SETUP.md). A package without one of
# them loses a feature with no error anywhere (0.8.8.6 shipped without insane-media: Screenshots saved and copied
# nothing), so each one is required here. ALLOW_MISSING="insane-tts …" leaves out the ones named, on purpose.
missing=""
for h in insane-media:"libavcodec-dev libavformat-dev libavutil-dev libswscale-dev libswresample-dev libva-dev" \
         insane-doc:"libpoppler-glib-dev libarchive-dev" insane-ocr:"libtesseract-dev" insane-tts:"tools/tts/fetch-audiocpp.sh" \
         insane-vmdisplay:"libsystemd-dev" insane-vault:"" insane-maild:"" insane-bench:"" insane-clean:"" insane-lan:"" insane-fetch:"" \
         insane-tls:"" insane-sql:"" insane-vm:"" insaneos-guest:""; do
    b=${h%%:*}; need=${h#*:}
    [ -x "server/build/$b" ] && continue
    case " ${ALLOW_MISSING:-} " in *" $b "*) echo "mkdeb: leaving out $b (ALLOW_MISSING)" >&2; continue ;; esac
    missing="$missing\n  server/build/$b${need:+  (needs $need)}"
done
[ -z "$missing" ] || { printf "missing helpers, the package would ship without them:$missing\nmake -C server after installing what they need, or ALLOW_MISSING=\"name …\" to leave one out on purpose\n" >&2; exit 1; }
[ -f themes/greeter/theme.bundle.js ] || { echo "missing the login screen (npm run build)" >&2; exit 1; }
for t in themes/*/theme.bundle.js; do [ -f "$t" ] || { echo "built themes missing (npm run build)" >&2; exit 1; }; done

PKG=$(mktemp -d)
trap 'rm -rf "$PKG"' EXIT
L="$PKG/usr/lib/insaneos"
install -d "$L/bin" "$L/themes" "$L/assets" "$PKG/usr/lib/systemd/system" "$PKG/usr/share/doc/insaneos" "$PKG/DEBIAN"
install -m 755 server/build/insane-server "$L/bin/insane-server"
install -m 755 server/build/insane-sessiond "$L/bin/insane-sessiond"
install -m 755 server/build/insane-netd "$L/bin/insane-netd"
install -m 755 server/build/insane-netperm "$L/bin/insane-netperm"
install -m 755 server/build/insane-fand "$L/bin/insane-fand"
# /usr/bin/pkexec on Insane OS: postinst diverts the real one and links this (docs/PRIVACY.md, "Authentication for Linux apps")
install -m 755 server/build/insane-pkexec "$L/bin/insane-pkexec"
# the live ISO's unattended install (docs/UNATTENDED.md); its unit is enabled only on the ISO (tools/iso/build.sh)
install -m 755 server/build/insane-autoinstall "$L/bin/insane-autoinstall"
# strip for the package's architecture: the host's strip can't read another architecture's binaries
# (an aarch64 server/build packaged on x86-64 by tools/rpi/build-img.sh), and its errors are ignored below
STRIP=strip
if [ "${DEB_ARCH:-}" = arm64 ] && [ "$(dpkg --print-architecture)" != arm64 ]; then
    STRIP=aarch64-linux-gnu-strip
    command -v "$STRIP" > /dev/null || { echo "missing $STRIP (binutils-aarch64-linux-gnu)" >&2; exit 1; }
fi
# the Insane OS Imager's first-run file applier (Raspberry Pi image, rpi/firstboot; docs/IMAGER.md)
install -m 755 server/build/insaneos-firstrun "$L/bin/insaneos-firstrun"
# System Information's report and InsaneBench for a terminal, SSH or CI; insane-server never runs it. In the
# Insane OS folder because `bench` only starts the insane-bench next to its own binary (/proc/self/exe)
install -d "$PKG/usr/bin"
install -m 755 server/build/insaneos-sysreport "$L/bin/insaneos-sysreport"
"$STRIP" --strip-unneeded "$L/bin/insaneos-sysreport" 2>/dev/null || true
ln -s ../lib/insaneos/bin/insaneos-sysreport "$PKG/usr/bin/insaneos-sysreport"
ln -s ../lib/insaneos/bin/insaneos-sysreport "$PKG/usr/bin/insaneos-fetch"
install -m 755 packaging/bin/insaneos-issue "$PKG/usr/bin/insaneos-issue"
# the visual test bench: a plain Wayland client, launched like any Linux app
[ -x server/build/insaneos-testbench ] && {
    install -m 755 server/build/insaneos-testbench "$PKG/usr/bin/insaneos-testbench"
    "$STRIP" --strip-unneeded "$PKG/usr/bin/insaneos-testbench" 2>/dev/null || true
    install -d "$PKG/usr/share/applications"
    install -m 644 packaging/desktop/insaneos-testbench.desktop "$PKG/usr/share/applications/insaneos-testbench.desktop"
}
# isolated PDF and archive helper (optional: make skips it without libpoppler-glib-dev/libarchive-dev);
# insane-server only launches the insane-doc in its own folder
[ -x server/build/insane-doc ] && install -m 755 server/build/insane-doc "$L/bin/insane-doc"
# Claude Code's status line bridge for the Terminal's status bar (docs/TERMINAL.md); Claude Code runs it, not insane-server
install -m 755 server/build/insane-claude-status "$L/bin/insane-claude-status"
# text to speech (docs/VOICE.md): `say` (insane-say, no libraries) and its sandboxed engine insane-tts, the only one that
# links audio.cpp/ggml, with those libraries in lib/tts (ggml loads its CPU and Vulkan backends from there). Optional:
# make skips insane-tts without tools/tts/fetch-audiocpp.sh's source; no voice model is installed (Settings -> AI -> Voice)
install -m 755 server/build/insane-say "$L/bin/insane-say"
if [ -x server/build/insane-tts ]; then
    install -m 755 server/build/insane-tts "$L/bin/insane-tts"
    mkdir -p "$L/lib/tts"
    cp -P server/build/lib/tts/*.so* "$L/lib/tts/"
    for f in "$L"/lib/tts/*.so*; do [ -L "$f" ] || { chmod 644 "$f"; "$STRIP" --strip-unneeded "$f" 2>/dev/null || true; }; done
    # audio.cpp's description of Kyutai's HD model folders (server/mk/tts.mk; insane-tts reads it, docs/VOICE.md)
    install -m 644 server/build/lib/tts/pocket_tts_dir.json "$L/lib/tts/pocket_tts_dir.json"
fi
# isolated text recognition helper, Screenshots' "copy the text" (optional: make skips it without libtesseract-dev)
[ -x server/build/insane-ocr ] && install -m 755 server/build/insane-ocr "$L/bin/insane-ocr"
"$STRIP" --strip-unneeded "$L/bin/insane-server" "$L/bin/insane-sessiond" "$L/bin/insane-netd" "$L/bin/insane-netperm" "$L/bin/insane-fand" "$L/bin/insane-pkexec" "$L/bin/insane-autoinstall" "$L/bin/insaneos-firstrun" 2>/dev/null || true
[ -x "$L/bin/insane-doc" ] && { "$STRIP" --strip-unneeded "$L/bin/insane-doc" 2>/dev/null || true; }
[ -x "$L/bin/insane-ocr" ] && { "$STRIP" --strip-unneeded "$L/bin/insane-ocr" 2>/dev/null || true; }
"$STRIP" --strip-unneeded "$L/bin/insane-claude-status" "$L/bin/insane-say" 2>/dev/null || true
[ -x "$L/bin/insane-tts" ] && { "$STRIP" --strip-unneeded "$L/bin/insane-tts" 2>/dev/null || true; }
# insane-server only launches the insane-media in its own folder (media: video, photos, camera, recorder)
[ -x server/build/insane-media ] && install -m 755 server/build/insane-media "$L/bin/insane-media"
[ -x "$L/bin/insane-media" ] && { "$STRIP" --strip-unneeded "$L/bin/insane-media" 2>/dev/null || true; }
# insane-vault: Passwords and the system keyring (docs/PASSWORDS.md); insane-server only launches the one in its own folder
[ -x server/build/insane-vault ] && install -m 755 server/build/insane-vault "$L/bin/insane-vault"
[ -x "$L/bin/insane-vault" ] && { "$STRIP" --strip-unneeded "$L/bin/insane-vault" 2>/dev/null || true; }
# insane-maild: IMAP/SMTP/CalDAV/CardDAV with TLS for Mail (docs/MAIL.md); insane-server only launches the one in its own folder
[ -x server/build/insane-maild ] && install -m 755 server/build/insane-maild "$L/bin/insane-maild"
[ -x "$L/bin/insane-maild" ] && { "$STRIP" --strip-unneeded "$L/bin/insane-maild" 2>/dev/null || true; }
# insane-bench (0.8.6): InsaneBench's sandboxed workloads (docs/BENCHMARK.md); insane-server only launches the one in its own folder
[ -x server/build/insane-bench ] && install -m 755 server/build/insane-bench "$L/bin/insane-bench"
[ -x "$L/bin/insane-bench" ] && { "$STRIP" --strip-unneeded "$L/bin/insane-bench" 2>/dev/null || true; }
# insane-clean (0.8.7): Cleaner's sandboxed read-only scanner (docs/CLEANER-ARCHITECTURE.md); insane-server only launches the one in its own folder
[ -x server/build/insane-clean ] && install -m 755 server/build/insane-clean "$L/bin/insane-clean"
[ -x "$L/bin/insane-clean" ] && { "$STRIP" --strip-unneeded "$L/bin/insane-clean" 2>/dev/null || true; }
# insane-lan (0.8.7): reads what the local network answers for Files → Network, sandboxed (docs/FILES.md, "Network")
[ -x server/build/insane-lan ] && install -m 755 server/build/insane-lan "$L/bin/insane-lan"
[ -x "$L/bin/insane-lan" ] && { "$STRIP" --strip-unneeded "$L/bin/insane-lan" 2>/dev/null || true; }
# insane-rdesk (0.8.7): one RDP or VNC connection, sandboxed (docs/FILES.md, "Remote desktop")
install -m 755 server/build/insane-rdesk "$L/bin/insane-rdesk"
"$STRIP" --strip-unneeded "$L/bin/insane-rdesk" 2>/dev/null || true
# Machines (0.8.9, alpha internals): insane-vm supervises one machine, insane-vmdisplay carries its picture and input
# (docs/VIRTUALIZATION.md, "Phase 1 implementation"). QEMU and passt aren't dependencies: Machines asks for them.
for b in insane-vm insane-vmdisplay; do
    [ -x "server/build/$b" ] && install -m 755 "server/build/$b" "$L/bin/$b"
    [ -x "$L/bin/$b" ] && { "$STRIP" --strip-unneeded "$L/bin/$b" 2>/dev/null || true; }
done
# insaneos-guest (0.8.9 beta): the clipboard helper Machines copies into a guest of this architecture (Install Agent)
if [ -x server/build/insaneos-guest ]; then
    install -d "$L/guest"
    install -m 755 server/build/insaneos-guest "$L/guest/insaneos-guest-${DEB_ARCH:-$(dpkg --print-architecture)}"
    "$STRIP" --strip-unneeded "$L/guest/insaneos-guest-${DEB_ARCH:-$(dpkg --print-architecture)}" 2>/dev/null || true
fi
# insane-sql (0.8.8.7): the Databases app's MySQL / MariaDB client, sandboxed (docs/DATABASES.md)
[ -x server/build/insane-sql ] && install -m 755 server/build/insane-sql "$L/bin/insane-sql"
[ -x "$L/bin/insane-sql" ] && { "$STRIP" --strip-unneeded "$L/bin/insane-sql" 2>/dev/null || true; }
# insane-fetch (0.8.5): downloads the subscribed blocklists over HTTPS, sandboxed (docs/FIREWALL.md, "Blocklists")
[ -x server/build/insane-fetch ] && install -m 755 server/build/insane-fetch "$L/bin/insane-fetch"
[ -x "$L/bin/insane-fetch" ] && { "$STRIP" --strip-unneeded "$L/bin/insane-fetch" 2>/dev/null || true; }
# the app catalog (0.8.5, apt/): Store → Artificial Intelligence; pkg-source-add reads it as root
install -d "$L/apt/keys"
install -m 644 apt/catalog.json "$L/apt/catalog.json"
for k in apt/keys/*.asc; do install -m 644 "$k" "$L/apt/keys/"; done
# insane-tls (0.8.5): HTTPS for the package engine's downloads, sandboxed (docs/PACKAGES.md, "HTTPS")
[ -x server/build/insane-tls ] && install -m 755 server/build/insane-tls "$L/bin/insane-tls"
[ -x "$L/bin/insane-tls" ] && { "$STRIP" --strip-unneeded "$L/bin/insane-tls" 2>/dev/null || true; }
# FIDO2 security keys reachable by the session user (insane-sessiond sessions have no logind seat)
install -d "$PKG/usr/lib/udev/rules.d"
install -m 644 packaging/udev/71-insaneos-fido.rules "$PKG/usr/lib/udev/rules.d/71-insaneos-fido.rules"
for d in themes/*/; do
    n=$(basename "$d")
    [ -f "$d/theme.bundle.js" ] || continue
    install -d "$L/themes/$n"
    install -m 644 "$d/theme.json" "$d/theme.bundle.js" "$L/themes/$n/"
    [ -d "$d/assets" ] && cp -r "$d/assets" "$L/themes/$n/"
done
cp -r assets/fonts assets/locales assets/shell assets/icons assets/mascot assets/monitor assets/help assets/fw assets/cleaner assets/machines "$L/assets/"
# the makers' keys Machines' download catalog pins (assets/machines/systems.json "keys"; docs/VIRTUALIZATION.md 3.9):
# the admin helper checks each checksum list's signature with them before it trusts a hash
install -d "$L/assets/machines/keys"
install -m 644 packaging/keys/machines/*.asc "$L/assets/machines/keys/"
# the wallpaper collection (assets/wallpapers/README.md): once, in the standard place for desktop
# backgrounds; insane-server reaches it as asset:wallpapers/… through the link. Only the JPEGs, the
# thumbnails and the README (index.json is bundled into the SDK at build time); motion.json and the built-in
# moving wallpaper (docs/WALLPAPERS.md).
install -d "$PKG/usr/share/backgrounds/insaneos"
( cd assets/wallpapers && find . -name '*.jpg' -o -name README.md -o -name motion.json -o -name '*.mp4' ) | while read -r f; do
    install -D -m 644 "assets/wallpapers/$f" "$PKG/usr/share/backgrounds/insaneos/$f"
done
ln -s /usr/share/backgrounds/insaneos "$L/assets/wallpapers"
# each isolated app's process (insane-server --app) loads its runtime from here
[ -f assets/app-host.bundle.js ] || { echo "missing assets/app-host.bundle.js (npm run build)" >&2; exit 1; }
install -m 644 assets/app-host.bundle.js "$L/assets/app-host.bundle.js"
# system apps that run as their own sandboxed process (manifest "process": "isolated"; e.g. Passwords)
[ -d assets/sysapps ] && cp -r assets/sysapps "$L/assets/"
# verified system code (docs/SIGNING.md): the manifest of every bundle above and, for a release, its
# signature made on the maintainer's machine (tools/release/sign-code.sh). insane-server checks the
# staged tree exactly as a session will; a release build (RELEASE=1) needs the signature.
[ -f code-manifest.json ] || { echo "missing code-manifest.json (npm run build writes it)" >&2; exit 1; }
install -m 644 code-manifest.json "$L/code-manifest.json"
[ -f code-manifest.sig ] && install -m 644 code-manifest.sig "$L/code-manifest.sig"
if [ "${REQUIRE_SIGNED_CODE:-0}" = 1 ] && [ ! -f "$L/code-manifest.sig" ]; then
    echo "missing code-manifest.sig: sign the manifest on the maintainer's machine (tools/release/sign-code.sh)" >&2; exit 1
fi
# (0.8.7) the tested-hardware snapshot for System Information's Compatibility panel is not in this package: it
# is insaneos-hwdata (tools/iso/mkdeb-hwdata.sh, Depends below), so a newer one can be published between releases
# the check is the same on any architecture: building another architecture's package on this host
# (tools/rpi/build-img.sh on x86-64 with an aarch64 server/build), CODE_CHECK_SERVER names a
# insane-server built for this host from the same tree
"${CODE_CHECK_SERVER:-server/build/insane-server}" --check-code "$L" > "$PKG/code-check.log" 2>&1 || {
    tail -20 "$PKG/code-check.log" >&2; echo "the staged system code does not match code-manifest.json" >&2; exit 1; }
tail -1 "$PKG/code-check.log"; rm -f "$PKG/code-check.log"
install -m 755 tools/iso/rootfs/usr/lib/insaneos/insaneos-live-prep "$L/insaneos-live-prep"
# updates in place (docs/UPDATES.md): the repository, its key, the migrations and the restart notice
install -D -m 644 packaging/apt/insaneos.sources "$L/apt/insaneos.sources"
install -D -m 644 packaging/keys/insaneos-archive-keyring.gpg "$PKG/usr/share/keyrings/insaneos-archive-keyring.gpg"
install -m 755 packaging/migrations/migrate "$L/migrate"
install -d "$L/migrations"
install -m 644 packaging/migrations/[0-9][0-9][0-9]-*.sh "$L/migrations/"
install -D -m 755 packaging/kernel/zz-insaneos-reboot-required "$PKG/etc/kernel/postinst.d/zz-insaneos-reboot-required"
install -D -m 644 tools/iso/rootfs/etc/wireplumber/wireplumber.conf.d/insaneos-bluez.conf "$PKG/etc/wireplumber/wireplumber.conf.d/insaneos-bluez.conf"
install -D -m 644 tools/iso/rootfs/etc/wireplumber/wireplumber.conf.d/insaneos-volume.conf "$PKG/etc/wireplumber/wireplumber.conf.d/insaneos-volume.conf"
install -D -m 644 tools/iso/rootfs/etc/pipewire/pipewire-pulse.conf.d/insaneos-no-modules.conf "$PKG/etc/pipewire/pipewire-pulse.conf.d/insaneos-no-modules.conf"
# in a virtual machine only: more headroom for emulated sound cards (docs/SOUND.md, "Virtual machines")
install -D -m 644 tools/iso/rootfs/etc/wireplumber/wireplumber.conf.d/insaneos-vm-audio.conf "$PKG/etc/wireplumber/wireplumber.conf.d/insaneos-vm-audio.conf"
# vmwgfx only on VMware itself; elsewhere it removes the firmware framebuffer and fails (docs/ISO.md)
install -D -m 644 tools/iso/rootfs/etc/modprobe.d/insaneos-vmwgfx.conf "$PKG/etc/modprobe.d/insaneos-vmwgfx.conf"
# SATA disk temperatures for Monitor → Disks: the drivetemp module at boot (docs/MONITOR.md)
install -D -m 644 tools/iso/rootfs/etc/modules-load.d/insaneos-drivetemp.conf "$PKG/usr/lib/modules-load.d/insaneos-drivetemp.conf"
# Debian's smartd stays off: Disks and the Monitor read SMART on demand (docs/SYSTEM.md, "smartd")
install -D -m 644 packaging/systemd/smartmontools-insaneos.conf "$PKG/usr/lib/systemd/system/smartmontools.service.d/insaneos.conf"
# gnome-keyring, if an app pulls it in, without its Secret Service: Insane OS keeps that name (docs/PASSWORDS.md)
install -D -m 644 packaging/systemd/gnome-keyring-insaneos.conf "$PKG/usr/lib/systemd/user/gnome-keyring-daemon.service.d/insaneos.conf"
# Machines: a shutdown or restart waits up to 30 s for running machines to be saved (docs/VIRTUALIZATION.md 6.1)
install -D -m 644 packaging/systemd/logind-insaneos-machines.conf "$PKG/usr/lib/systemd/logind.conf.d/insaneos-machines.conf"
# remote login (SSH) defaults, read only once openssh-server is installed (docs/REMOTE.md)
install -D -m 644 tools/iso/rootfs/etc/ssh/sshd_config.d/10-insaneos.conf "$PKG/etc/ssh/sshd_config.d/10-insaneos.conf"
# a process may only trace its own descendants: a restricted Linux app must not take over an
# unrestricted process of the same user (insane-server, PipeWire, another app) and act through it
install -d "$PKG/usr/lib/sysctl.d"
printf '%s\n' '# Insane OS: ptrace only of descendants (docs/FIREWALL.md, "Linux apps")' 'kernel.yama.ptrace_scope = 1' > "$PKG/usr/lib/sysctl.d/50-insaneos-ptrace.conf"
chmod 644 "$PKG/usr/lib/sysctl.d/50-insaneos-ptrace.conf"
install -m 644 tools/iso/rootfs/etc/systemd/system/insaneos.service "$PKG/usr/lib/systemd/system/insaneos.service"
# smooth video in Chromium without hardware decoding (docs/VIDEO.md); the Firefox manifest stays out
X="$PKG/usr/share/chromium/extensions/insaneos-video"
install -d "$X"
(cd assets/browser/video && find . -type f ! -name manifest.firefox.json ! -name '.*' -print) | while read -r f; do
    install -D -m 644 "assets/browser/video/$f" "$X/$f"
done
find "$PKG/usr/share/chromium" -type d -exec chmod 755 {} +
# boot splash (docs/brand/README.md, "Boot splash"): the Plymouth theme and the hand-off to Insane OS
install -m 755 tools/boot/insaneos-splash "$L/insaneos-splash"
install -m 644 tools/boot/systemd/insaneos-splash-quit.service "$PKG/usr/lib/systemd/system/insaneos-splash-quit.service"
install -D -m 644 tools/boot/systemd/plymouth-quit.service.d/insaneos.conf "$PKG/usr/lib/systemd/system/plymouth-quit.service.d/insaneos.conf"
install -d "$PKG/usr/share/plymouth/themes/insaneos"
install -m 644 tools/boot/plymouth/insaneos/insaneos.plymouth tools/boot/plymouth/insaneos/insaneos.script \
    tools/boot/plymouth/insaneos/*.png "$PKG/usr/share/plymouth/themes/insaneos/"
# boot menu theme: both architectures, the arm64 ISO and Debian on arm64 boot with GRUB (the same arm64
# package goes on the Raspberry Pi, which boots without GRUB and doesn't use it)
install -d "$PKG/usr/share/grub/themes/insaneos"
install -m 644 tools/iso/grub/insaneos/theme.txt tools/iso/grub/insaneos/*.png tools/iso/grub/insaneos/*.pf2 \
    "$PKG/usr/share/grub/themes/insaneos/"
# Insane OS GTK3 themes (the settings portal picks them by light/dark)
install -d "$PKG/usr/share/themes"
cp -r assets/gtk/InsaneOS assets/gtk/InsaneOS-dark "$PKG/usr/share/themes/"
find "$PKG/usr/share/themes" -type d -exec chmod 755 {} +; find "$PKG/usr/share/themes" -type f -exec chmod 644 {} +
# GTK's defaults where the session can't give its own: the window buttons of apps that draw their
# title bar (#52; docs/WAYLAND.md). GLib's dpkg trigger compiles the schema override.
install -D -m 644 assets/gtk/90_insaneos.gschema.override "$PKG/usr/share/glib-2.0/schemas/90_insaneos.gschema.override"
# COEXIST=1: installing beside an older desktop package that owns /etc/gtk-*/settings.ini.
# The paths would clash and dpkg would refuse to unpack; the session gives apps its own values
# through the settings portal, so leaving the old file in place costs nothing.
if [ "${COEXIST:-0}" != 1 ]; then
    install -D -m 644 assets/gtk/settings.ini "$PKG/etc/gtk-3.0/settings.ini"
    install -D -m 644 assets/gtk/settings.ini "$PKG/etc/gtk-4.0/settings.ini"
fi
install -m 644 tools/iso/rootfs/etc/systemd/system/insane-netperm.service "$PKG/usr/lib/systemd/system/insane-netperm.service"
# fans by temperature from the first boot (docs/FANS.md): enabled by postinst, also in a chroot
install -m 644 tools/iso/rootfs/etc/systemd/system/insane-fand.service "$PKG/usr/lib/systemd/system/insane-fand.service"
install -m 644 tools/iso/rootfs/etc/systemd/system/insaneos-autoinstall.service "$PKG/usr/lib/systemd/system/insaneos-autoinstall.service"
find "$L" -type d -exec chmod 755 {} +
find "$L/themes" "$L/assets" "$L/migrations" "$L/apt" -type f -exec chmod 644 {} +

D="$PKG/usr/share/doc/insaneos"
install -m 644 README.md "$D/README.md"
cat > "$D/copyright" <<'C'
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: Insane OS
Source: https://github.com/insaneos/Insane OS

Files: *
Copyright: 2026 iPERFEX and the Insane OS contributors
License: Expat
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

Files: usr/share/backgrounds/insaneos/*
Copyright: 2026 iPERFEX
License: Expat
Comment: Created by iPERFEX with an AI image generator; part of the Insane OS brand
 assets. The Insane OS name, the apple and Lumo shown in them are also covered by the
 Insane OS trademark and brand policy (insaneos.org).

Files: usr/lib/insaneos/assets/fonts/*
License: OFL-1.1
 Inter, JetBrains Mono and Plus Jakarta Sans: SIL Open Font License 1.1 (each
 font's license text ships next to it, *-LICENSE.txt).
 On Debian: /usr/share/common-licenses does not include it; see https://openfontlicense.org

Files: usr/lib/insaneos/bin/insane-bench
License: OFL-1.1
 Built into insane-bench for InsaneBench's shaping workload: subsets of Noto Sans Arabic,
 Devanagari, Thai and CJK SC. SIL Open Font License 1.1, full text and copyright
 notices in usr/share/doc/insaneos/OFL-Noto.txt.

Files: usr/lib/insaneos/assets/monitor/geoip-country.mmdb.xz
Copyright: db-ip.com
License: CC-BY-4.0
 DB-IP Lite Country (https://db-ip.com), converted by tools/gen-monitor-data.py.
 https://creativecommons.org/licenses/by/4.0/

Files: usr/lib/insaneos/assets/monitor/land.bin usr/lib/insaneos/assets/locales/*/countries.json
License: public-domain
 Natural Earth (https://www.naturalearthdata.com).

Files: third_party/quickjs/* third_party/stb/*
License: MIT and public-domain
 QuickJS (MIT) and stb (public domain / MIT), compiled into insane-server.
C
chmod 644 "$D/copyright"
install -m 644 server/src/bench/fonts/OFL.txt "$D/OFL-Noto.txt"
printf 'insaneos (%s) trixie; urgency=medium\n\n  * Package built by tools/iso/mkdeb.sh.\n\n -- Insane OS <insane.basex@gmail.com>  %s\n' \
    "$VERSION" "$(date -R)" | gzip -9n > "$D/changelog.gz"
chmod 644 "$D/changelog.gz"

# with the GPU path (make GPU=1), the Mesa libraries are dependencies too
GPUDEPS=""
# readelf (not ldd): also works when building for another architecture (tools/rpi)
if readelf -d "$L/bin/insane-server" 2>/dev/null | grep -q "NEEDED.*libgbm"; then GPUDEPS=", libgbm1, libegl1, libgles2"; fi
# the test bench's 3D view draws through wayland-egl (built only when Mesa's EGL was there)
if readelf -d "$PKG/usr/bin/insaneos-testbench" 2>/dev/null | grep -q "NEEDED.*libwayland-egl"; then
    case "$GPUDEPS" in *libegl1*) ;; *) GPUDEPS="$GPUDEPS, libegl1, libgles2" ;; esac
    GPUDEPS="$GPUDEPS, libwayland-egl1"
fi
DOCDEPS=""
if [ -x "$L/bin/insane-doc" ]; then DOCDEPS=", libpoppler-glib8t64, libarchive13t64, libcairo2, libfreetype6, libfontconfig1, poppler-data"; fi
# insane-ocr: the library and English (libtesseract5 brings no language data); the interface's other languages
# (the "fast" data, ~2 MB each) are Recommends
OCRDEPS=""; OCRRECS=""
if [ -x "$L/bin/insane-ocr" ]; then OCRDEPS=", libtesseract5, tesseract-ocr-eng"; OCRRECS=", tesseract-ocr-spa, tesseract-ocr-por, tesseract-ocr-fra, tesseract-ocr-ita"; fi
# insane-tts: Vulkan's loader (the GPU is optional, the CPU always works), OpenMP and the C++ runtime
TTSDEPS=""
if [ -x "$L/bin/insane-tts" ]; then TTSDEPS=", libvulkan1, libgomp1, libstdc++6"; fi
MEDIADEPS=""
if [ -x "$L/bin/insane-media" ]; then MEDIADEPS=", libavcodec61, libavformat61, libavutil59, libswscale8, libswresample5, libva2, libva-drm2"; fi
# the remote desktop is WebRTC only (docs/REMOTE.md, "Video (WebRTC)"): insane-sessiond always links libsrtp2 and usrsctp
RTCDEPS=", libsrtp2-1, libusrsctp2"
# the CPU's microcode updates on amd64 (non-free-firmware, in every Insane OS install's sources): a Depends, so the
# update to 0.8.8.6 brings them to installs that never had them (they load on the next boot)
MICROCODEDEPS=""
[ "${DEB_ARCH:-$(dpkg --print-architecture)}" = amd64 ] && MICROCODEDEPS=", intel-microcode, amd64-microcode"
if ! objdump -p "$L/bin/insane-sessiond" 2>/dev/null | grep -q "libsrtp2"; then echo "insane-sessiond is not linked with libsrtp2: rebuild it (make -C server)" >&2; exit 1; fi
# the signed tested-hardware snapshot, its own package (tools/iso/mkdeb-hwdata.sh): any version of format 1,
# the first being the snapshot of 2026-10-27 (a format 2 is a Breaks in insaneos-hwdata, not a change here)
HWDATADEPS=", insaneos-hwdata (>= 2026.10.27)"
# rclone for Cloud and Connect to Server, rclone's signed release binary at /usr/lib/insaneos/rclone (tools/iso/mkdeb-rclone.sh, docs/CLOUD.md 3.1);
# Debian's rclone (1.60) is too old for Cloud, and nothing runs /usr/bin/rclone any more
RCLONEDEPS=", insaneos-rclone (>= 1.75.2)"
SIZE=$(du -sk "$PKG/usr" | awk '{s += $1} END {print s}')
cat > "$PKG/DEBIAN/control" <<C
Package: insaneos
Version: $VERSION
Architecture: ${DEB_ARCH:-$(dpkg --print-architecture)}
Maintainer: Insane OS <insane.basex@gmail.com>
Installed-Size: $SIZE
Depends: libc6 (>= 2.38), libwayland-server0 (>= 1.22), libwayland-client0 (>= 1.22), libxkbcommon0 (>= 1.5), libcrypt1, libssl3t64 | libssl3, ca-certificates, passwd, procps, xkb-data, libfreerdp3-3, libfreerdp-client3-3, libwinpr3-3, fuse3, openssh-client, openssl, polkitd, pkexec$HWDATADEPS$RCLONEDEPS$GPUDEPS$DOCDEPS$OCRDEPS$TTSDEPS$MEDIADEPS$RTCDEPS$MICROCODEDEPS
Recommends: pipewire-pulse, wireplumber, wpasupplicant, openvpn, fonts-noto-core, fonts-noto-color-emoji, fonts-dejavu-core, locales, tzdata, sudo, cups, cups-client, avahi-daemon, libnss-mdns, mesa-va-drivers, bluez, libspa-0.2-bluetooth, power-profiles-daemon, systemd-timesyncd, shared-mime-info, gsettings-desktop-schemas, xwayland, pci.ids, usb.ids, curl, wget, rsync, screen, htop, vim, mc, tcpdump, net-tools, fdisk, rfkill, jq$OCRRECS
Section: x11
Priority: optional
Protected: yes
Homepage: https://github.com/insaneos/Insane OS
Description: desktop environment for Debian GNU/Linux, built from scratch
 Insane OS is a desktop environment for Debian GNU/Linux with its own display
 server and Wayland compositor written in C (DRM/KMS, evdev) and the
 interface in React on its own engine.
 It includes the native apps, the themes, the login screen and the
 insaneos.service service (insane-sessiond) that starts it on tty1. Remote desktop
 (browser, port 5673) ships turned off.
C
# insaneos.service is enabled by hand (the ISO does it; on an installed system the user decides).
# insane-fand.service is always enabled (and started on a running system): fans need no choice.
cat > "$PKG/DEBIAN/postinst" <<'C'
#!/bin/sh
set -e
if [ "$1" = configure ] && command -v systemctl >/dev/null 2>&1; then
    systemctl daemon-reload >/dev/null 2>&1 || true
    systemctl enable insane-fand.service >/dev/null 2>&1 || true
    if [ -d /run/systemd/system ]; then systemctl restart systemd-sysctl.service >/dev/null 2>&1 || true; fi
    if [ -d /run/systemd/system ]; then systemctl restart insane-fand.service >/dev/null 2>&1 || true; fi
fi
# the Insane OS repository: added when missing, so an administrator's edit (Enabled: no) is kept; not a
# conffile, so removing the package also removes it and apt keeps working (docs/UPDATES.md)
if [ "$1" = configure ] && [ ! -e /etc/apt/sources.list.d/insaneos.sources ] && [ -d /etc/apt/sources.list.d ]; then
    install -m 644 /usr/lib/insaneos/apt/insaneos.sources /etc/apt/sources.list.d/insaneos.sources
fi
# pkexec reaches the session's authentication agent through insane-pkexec (docs/PRIVACY.md, "Authentication
# for Linux apps"); the real one keeps its setuid bit under another name, and its updates land there
if [ "$1" = configure ]; then
    dpkg-divert --package insaneos --quiet --rename --divert /usr/bin/pkexec.distrib --add /usr/bin/pkexec
    ln -sfn ../lib/insaneos/bin/insane-pkexec /usr/bin/pkexec
fi
# `say` is Insane OS's text to speech (docs/VOICE.md); an alternative, so another package's say can sit beside it
if [ "$1" = configure ] && [ -x /usr/lib/insaneos/bin/insane-say ]; then
    update-alternatives --quiet --install /usr/bin/say say /usr/lib/insaneos/bin/insane-say 50
fi
# version-to-version system changes, each applied once (docs/UPDATES.md, "Migrations")
if [ "$1" = configure ] && [ -x /usr/lib/insaneos/migrate ]; then
    /usr/lib/insaneos/migrate "${2:-}"
fi
# an upgrade replaced the desktop under the running sessions: Store → Updates offers a restart
# (the Debian convention /run/reboot-required; never on a new install or in an image build)
if [ "$1" = configure ] && [ -n "${2:-}" ] && [ -d /run/systemd/system ] &&
   [ "$2" != "$(dpkg-query -W -f '${Version}' insaneos 2>/dev/null || true)" ]; then
    touch /run/reboot-required 2>/dev/null && echo insaneos >> /run/reboot-required.pkgs 2>/dev/null || true
fi
# the boot splash lives in the initramfs: when it is the selected theme, rebuild it with the new images
# (initramfs-tools' trigger; the theme is selected by the ISO, the Pi image or install.sh, never here)
if [ "$1" = configure ] && [ -x /usr/sbin/plymouth-set-default-theme ] &&
   [ "$(/usr/sbin/plymouth-set-default-theme 2>/dev/null)" = insaneos ] && command -v update-initramfs >/dev/null 2>&1; then
    dpkg-trigger --no-await update-initramfs 2>/dev/null || true
fi
C
chmod 755 "$PKG/DEBIAN/postinst"
# removing the package gives the fans back first (ExecStopPost restores the kernel's control)
cat > "$PKG/DEBIAN/prerm" <<'C'
#!/bin/sh
set -e
if [ "$1" = remove ] && command -v systemctl >/dev/null 2>&1; then
    if [ -d /run/systemd/system ]; then systemctl stop insane-fand.service >/dev/null 2>&1 || true; fi
    systemctl disable insane-fand.service >/dev/null 2>&1 || true
fi
if [ "$1" = remove ]; then update-alternatives --quiet --remove say /usr/lib/insaneos/bin/insane-say 2>/dev/null || true; fi
# the boot splash theme goes away with the package: Plymouth back to its default theme first
if [ "$1" = remove ] && [ -x /usr/sbin/plymouth-set-default-theme ] &&
   [ "$(/usr/sbin/plymouth-set-default-theme 2>/dev/null)" = insaneos ]; then
    /usr/sbin/plymouth-set-default-theme --reset >/dev/null 2>&1 || true
    command -v update-initramfs >/dev/null 2>&1 && { dpkg-trigger --no-await update-initramfs 2>/dev/null || true; }
fi
C
chmod 755 "$PKG/DEBIAN/prerm"
# without the package its key is gone: take the repository out of apt's sources too
cat > "$PKG/DEBIAN/postrm" <<'C'
#!/bin/sh
set -e
if [ "$1" = remove ] || [ "$1" = purge ]; then rm -f /etc/apt/sources.list.d/insaneos.sources; fi
# the browsers' video settings written by Settings (video-optimize, docs/VIDEO.md)
if [ "$1" = remove ] || [ "$1" = purge ]; then rm -f /etc/chromium/policies/managed/insaneos-video.json /etc/firefox-esr/insaneos-video.js /etc/chromium/policies/recommended/insaneos-session.json /etc/firefox-esr/insaneos-session.js; fi
if [ "$1" = purge ]; then rm -rf /var/lib/insaneos/migrations; fi
# the real pkexec back in its place
if [ "$1" = remove ] || [ "$1" = purge ]; then
    if [ -L /usr/bin/pkexec ]; then rm -f /usr/bin/pkexec; fi
    dpkg-divert --package insaneos --quiet --rename --remove /usr/bin/pkexec || true
fi
C
chmod 755 "$PKG/DEBIAN/postrm"
# files under /etc are conffiles (lintian: file-in-etc-not-marked-as-conffile)
( cd "$PKG" && find etc -type f | sed 's|^|/|' ) > "$PKG/DEBIAN/conffiles"
chmod 644 "$PKG/DEBIAN/conffiles"
dpkg-deb --root-owner-group --build "$PKG" "$OUT" >/dev/null
echo "$OUT ($(du -h "$OUT" | cut -f1))"
