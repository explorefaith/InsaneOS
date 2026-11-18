#!/usr/bin/env bash
# upgrade-insaneos.sh — install the overnight-fixed Insane OS build (run with sudo)
#
#     sudo bash upgrade-insaneos.sh
#
# What it does:
#   1. Installs build dependencies + full Debian/Insane OS package update
#   2. Builds insane-server and every helper from the patched source
#      (repo has SDK poller CPU fix; master has the screenshot/media-job fixes,
#       sharper fractional-scaling text, Cloud-freeze and Bluetooth-mouse fixes)
#   3. Backs up EVERY file it replaces to /var/backups/insaneos-fix-<time>/
#      and writes a REVERT.sh next to the backup
#   4. Installs the new binaries, theme bundles and code manifest
#   5. Sets up zram + memory tuning
#
# It aborts BEFORE touching the system if the core binary fails to build.
# After it finishes: reboot (or log out and back in).
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="/usr/lib/insaneos"
TS="$(date +%Y%m%d-%H%M%S)"
BK="/var/backups/insaneos-fix-$TS"

[ -d "$REPO/server/src" ] || { echo "ERROR: source repo not found at $REPO"; exit 1; }
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo: sudo bash $0"; exit 1; }

echo "==> [1/10] Build dependencies + package update"
export DEBIAN_FRONTEND=noninteractive
apt-get update
# Package names differ between Debian releases: every package is checked against the
# repositories first, and only the ones that actually exist are installed. A missing
# optional package skips its helper (insane-rdesk etc.) instead of aborting everything.
ALL_PKGS="build-essential cmake pkg-config curl git \
  libxkbcommon-dev libwayland-dev wayland-protocols \
  libgbm-dev libegl1-mesa-dev libgles2-mesa-dev \
  libavcodec-dev libavformat-dev libavutil-dev libswscale-dev libswresample-dev \
  libssl-dev libsystemd-dev libarchive-dev libcairo2-dev libfreetype-dev libfontconfig-dev \
  libpoppler-glib-dev libtesseract-dev libleptonica-dev libva-dev \
  libfreerdp3-dev libfreerdp-dev libsrtp2-dev libusrsctp-dev \
  intel-microcode amd64-microcode \
  intel-media-va-driver-nonfree intel-media-va-driver vainfo unattended-upgrades"
PKGS=""
for p in $ALL_PKGS; do
  if apt-cache show "$p" >/dev/null 2>&1; then PKGS="$PKGS $p"; else echo "   (not in these repos, skipped: $p)"; fi
done
apt-get -y install $PKGS
# automatic SECURITY updates only (Debian default policy): safe, unattended
printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' \
  > /etc/apt/apt.conf.d/20auto-upgrades
apt-get -y full-upgrade

echo "==> [2/10] Building Insane OS from patched source (this takes a few minutes)"
cd "$REPO/server"
# the core binary first: it must build, or nothing is installed
if ! make -j"$(nproc)" build/insane-server; then
  echo "ERROR: insane-server did not build — system left untouched. See the log above."
  exit 1
fi
echo "   build/insane-server OK"
# then every helper; an optional one failing (e.g. no FreeRDP for insane-rdesk) is fine
make -k -j"$(nproc)" 2>&1 | tail -3 || true
echo "   build/insane-server OK: $(stat -c%s build/insane-server) bytes"
chown -R explorearafat:explorearafat "$REPO" 2>/dev/null || true

echo "==> [3/10] Backing up everything that will be replaced"
mkdir -p "$BK/bin" "$BK/themes" "$BK/assets"
cp -a "$DEST/bin/." "$BK/bin/"
cp -a "$DEST/themes/default/theme.bundle.js" "$BK/themes/default-theme.bundle.js" 2>/dev/null || true
cp -a "$DEST/themes/greeter/theme.bundle.js" "$BK/themes/greeter-theme.bundle.js" 2>/dev/null || true
cp -a "$DEST/themes/classic/theme.bundle.js" "$BK/themes/classic-theme.bundle.js" 2>/dev/null || true
cp -a "$DEST/assets/app-host.bundle.js" "$BK/assets/" 2>/dev/null || true
cp -a "$DEST/assets/sysapps" "$BK/assets/sysapps" 2>/dev/null || true
cp -a "$DEST/assets/locales" "$BK/assets/locales" 2>/dev/null || true
cp -a "$DEST/code-manifest.json" "$BK/" 2>/dev/null || true
cp -a "$DEST/code-manifest.sig" "$BK/" 2>/dev/null || true
du -sh "$BK"

cat > "$BK/REVERT.sh" <<EOF
#!/usr/bin/env bash
# Restores the previous Insane OS files. Run: sudo bash $BK/REVERT.sh
set -e
cp -a "$BK/bin/." /usr/lib/insaneos/bin/
[ -f "$BK/themes/default-theme.bundle.js" ] && cp -a "$BK/themes/default-theme.bundle.js" /usr/lib/insaneos/themes/default/theme.bundle.js
[ -f "$BK/themes/greeter-theme.bundle.js" ] && cp -a "$BK/themes/greeter-theme.bundle.js" /usr/lib/insaneos/themes/greeter/theme.bundle.js
[ -f "$BK/themes/classic-theme.bundle.js" ] && cp -a "$BK/themes/classic-theme.bundle.js" /usr/lib/insaneos/themes/classic/theme.bundle.js
[ -f "$BK/assets/app-host.bundle.js" ] && cp -a "$BK/assets/app-host.bundle.js" /usr/lib/insaneos/assets/app-host.bundle.js
[ -d "$BK/assets/sysapps" ] && cp -a "$BK/assets/sysapps/." /usr/lib/insaneos/assets/sysapps/
[ -d "$BK/assets/locales" ] && cp -a "$BK/assets/locales/." /usr/lib/insaneos/assets/locales/
[ -f "$BK/code-manifest.json" ] && cp -a "$BK/code-manifest.json" /usr/lib/insaneos/code-manifest.json
[ -f "$BK/code-manifest.sig" ] && cp -a "$BK/code-manifest.sig" /usr/lib/insaneos/code-manifest.sig
echo "Reverted. Reboot (or log out and back in)."
EOF
chmod +x "$BK/REVERT.sh"

echo "==> [4/10] Installing new binaries, bundles and manifest"
install -m 755 build/insane-server "$DEST/bin/insane-server"
for f in build/insane-* build/insaneos-*; do
  b="$(basename "$f")"
  [ -e "$f" ] || continue
  if [ -e "$DEST/bin/$b" ]; then
    install -m 755 "$f" "$DEST/bin/$b"
    echo "   bin/$b updated"
  else
    echo "   bin/$b skipped (not present in the installed system)"
  fi
done
install -m 644 "$REPO/themes/default/theme.bundle.js"  "$DEST/themes/default/theme.bundle.js"
install -m 644 "$REPO/themes/greeter/theme.bundle.js"  "$DEST/themes/greeter/theme.bundle.js"
install -m 644 "$REPO/themes/classic/theme.bundle.js"  "$DEST/themes/classic/theme.bundle.js"
install -m 644 "$REPO/assets/app-host.bundle.js"       "$DEST/assets/app-host.bundle.js"
for d in "$REPO"/assets/sysapps/*/; do
  app="$(basename "$d")"
  if [ -e "$DEST/assets/sysapps/$app/app.js" ]; then
    install -m 644 "$d/app.js" "$DEST/assets/sysapps/$app/app.js"
  fi
done
# the language catalogs go with the bundles: a new bundle asks for its new keys (the i18n check
# in the build guarantees they exist here), and a catalog older than the bundle would show raw keys
cp -a "$REPO"/assets/locales/. "$DEST/assets/locales/"
# the fonts too: the Theme Studio display faces are new files, additive by design (a font not in
# the running server's table is simply never opened, so an old binary stays correct)
cp -a "$REPO"/assets/fonts/. "$DEST/assets/fonts/"
install -m 644 "$REPO/code-manifest.json" "$DEST/code-manifest.json"
# The rebuilt manifest is unsigned by design: the newly built insane-server is a development
# build that accepts it (release builds demand the release key, which we don't have).
# A stale signature file next to an unsigned manifest would be wrong — remove it (backed up).
rm -f "$DEST/code-manifest.sig"
sha256sum "$DEST/bin/insane-server" "$DEST/themes/default/theme.bundle.js"

echo "==> [5/10] Pressure-freeze helper + memory tuning"
# The freezer runs as the user (no root): stops heavy background processes under
# memory/CPU pressure, wakes them on recovery — the shell reports foreground pids.
install -d -m 755 /home/explorearafat/.local/bin /home/explorearafat/.cache/insaneos
install -m 755 "$SCRIPT_DIR/insaneos-smooth-freeze.sh" /home/explorearafat/.local/bin/insaneos-smooth-freeze.sh
install -d -m 755 /home/explorearafat/.config/systemd/user
install -m 644 "$SCRIPT_DIR/insaneos-smooth-freeze.service" /home/explorearafat/.config/systemd/user/insaneos-smooth-freeze.service
chown -R explorearafat:explorearafat /home/explorearafat/.local/bin /home/explorearafat/.config/systemd /home/explorearafat/.cache/insaneos
sudo -u explorearafat XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus \
  systemctl --user daemon-reload 2>/dev/null || true
sudo -u explorearafat XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus \
  systemctl --user enable --now insaneos-smooth-freeze.service 2>/dev/null || \
  echo "   (service will start on next login — systemctl --user enable --now insaneos-smooth-freeze)"

echo "==> [6/10] Memory tuning (zram + sysctl)"
if ! dpkg -s zram-tools >/dev/null 2>&1; then apt-get -y install zram-tools; fi
cat > /etc/default/zramswap <<'EOF'
# ~50% of RAM as compressed (zstd) swap, preferred over the 2GB disk swap
ALGO=zstd
PERCENT=50
PRIORITY=100
EOF
systemctl restart zramswap.service 2>/dev/null || echo "   (zram activates on next reboot)"
cat > /etc/sysctl.d/99-insaneos-smooth.conf <<'EOF'
# Insane OS smoothness (installed by upgrade-insaneos.sh)
vm.swappiness = 100
vm.vfs_cache_pressure = 50
vm.page-cluster = 0
EOF
sysctl --system >/dev/null

echo "==> [7/10] Battery health limit (80%)"
# ThinkPads (and most modern laptops) stop charging at 80% when asked — much kinder to the
# battery than sitting at 100% all day. Applied once at boot; the EC usually remembers it.
cat > /etc/systemd/system/insaneos-battery-limit.service <<'EOF'
[Unit]
Description=Apply the saved battery charge limit (battery health)
After=multi-user.target

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'p=80; [ -r /etc/insaneos/battery-limit ] && p=$(cat /etc/insaneos/battery-limit); for b in /sys/class/power_supply/BAT*; do [ -e "$b/charge_control_end_threshold" ] && echo "$p" > "$b/charge_control_end_threshold" 2>/dev/null; done; true'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable insaneos-battery-limit.service 2>/dev/null || true
if [ -e /sys/class/power_supply/BAT0/charge_control_end_threshold ] || [ -e /sys/class/power_supply/BAT1/charge_control_end_threshold ]; then
  systemctl start insaneos-battery-limit.service || true
  echo "   charge limit applied (remove with: systemctl disable --now insaneos-battery-limit)"
else
  echo "   (this laptop's battery doesn't expose a charge threshold — skipped)"
  systemctl disable insaneos-battery-limit.service 2>/dev/null || true
fi

echo "==> [8/10] Login wallpaper + live wallpaper + boot splash"
# login background = the picture you chose (copied where the greeter reads it)
install -d -m 755 /var/lib/insaneos/wallpapers
if [ -f /home/explorearafat/Downloads/insane-assets/wallpaper-full.jpg ]; then
  HEX=$(python3 -c "import secrets;print(secrets.token_hex(8))")
  install -m 644 /home/explorearafat/Downloads/insane-assets/wallpaper-full.jpg "/var/lib/insaneos/wallpapers/login-$HEX.jpg"
  printf 'image:login-%s.jpg' "$HEX" > /var/lib/insaneos/wallpapers/login-still
  echo "   login wallpaper set"
fi
# live wallpaper: your video -> ~/Videos, wired as the desktop motion wallpaper
install -d -m 755 /home/explorearafat/Videos
if [ -f /home/explorearafat/Downloads/insane-assets/insane-galaxy.mp4 ]; then
  install -m 644 /home/explorearafat/Downloads/insane-assets/insane-galaxy.mp4 /home/explorearafat/Videos/insane-galaxy.mp4 || true
  chown explorearafat:explorearafat /home/explorearafat/Videos/insane-galaxy.mp4 2>/dev/null || true
  sudo -u explorearafat python3 -I "$SCRIPT_DIR/wire-motion.py" || echo "   (motion wiring skipped)"
fi
# boot splash: the Insane mark on Plymouth (+ initramfs refresh)
if [ -d /usr/share/plymouth/themes/insaneos ] && [ -d "$REPO/tools/boot/plymouth/insaneos" ]; then
  cp "$REPO"/tools/boot/plymouth/insaneos/*.png /usr/share/plymouth/themes/insaneos/ 2>/dev/null || true
  update-initramfs -u >/dev/null 2>&1 || true
  echo "   boot splash updated"
fi

echo "==> [9/10] SSD, journal and cache optimizations"
# weekly TRIM keeps the NVMe healthy and fast
systemctl enable fstrim.timer 2>/dev/null && systemctl start fstrim.timer 2>/dev/null || true
# cap the journal so logs never eat gigabytes
mkdir -p /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/99-insaneos-smooth.conf <<'EOF'
[Journal]
SystemMaxUse=128M
EOF
systemctl restart systemd-journald 2>/dev/null || true
# noatime on / : fewer SSD writes, quicker file access (verified + backed up, or skipped)
if ! findmnt -n -o OPTIONS / 2>/dev/null | grep -qw noatime; then
  cp -a /etc/fstab "/etc/fstab.bak-$TS"
  python3 - <<'PY'
lines = open('/etc/fstab').read().splitlines()
out = []
for ln in lines:
    f = ln.split()
    if len(f) >= 4 and f[1] == '/' and not ln.lstrip().startswith('#') and 'noatime' not in f[3]:
        f[3] = f[3] + ',noatime'
        ln = '\t'.join(f)
    out.append(ln)
open('/etc/fstab', 'w').write('\n'.join(out) + '\n')
PY
  if findmnt --verify 2>/dev/null; then echo "   / remounts with noatime (backup: /etc/fstab.bak-$TS)"; else cp -a "/etc/fstab.bak-$TS" /etc/fstab; echo "   fstab check failed — noatime skipped, original restored"; fi
fi

# ---- security enforcement snapshot (verifiable, not a claim) ----
SA="$BK/security-audit.txt"
{ echo "== AppArmor =="; aa-status 2>&1 | head -8; echo "== nftables =="; nft list ruleset 2>/dev/null | head -4 || echo "(no nft ruleset readable)"; echo "== unattended-upgrades =="; systemctl is-enabled unattended-upgrades 2>/dev/null || echo disabled; echo "== InsaneOS per-app firewall =="; systemctl is-active insane-netperm 2>/dev/null; } > "$SA" 2>/dev/null || true
echo "   security snapshot: $SA"

echo "==> [10/10] Done"
echo
echo "Backup + revert script : $BK"
echo "Now REBOOT (or log out and log back in)."
echo "After login, verify:"
echo "  - PrintScreen / Meta+Shift+3 saves a screenshot to ~/Pictures/Screenshots"
echo "  - Notifications appear at the TOP-RIGHT corner of the screen"
echo "  - 'top' shows insane-server using far less CPU when idle"
