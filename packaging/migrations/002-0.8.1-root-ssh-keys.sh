# 0.8.1: Insane OS's SSH defaults (/etc/ssh/sshd_config.d/10-insaneos.conf, new in 0.8.1) say
# "PermitRootLogin no". A server upgraded from 0.8.0 that is administered as root with an SSH key
# (a VPS, for example) would be locked out at the next sshd restart. On such an upgrade only, root
# keeps logging in with keys, never with a password (Debian's own default), through a drop-in that
# sshd reads before Insane OS's. Delete /etc/ssh/sshd_config.d/09-insaneos-root-keys.conf to apply
# Insane OS's default; a new install never gets it.
[ -n "${INSANEOS_OLD_VERSION:-}" ] || exit 0
dpkg --compare-versions "$INSANEOS_OLD_VERSION" lt 0.8.1~ || exit 0
[ -x /usr/sbin/sshd ] || exit 0
[ -s /root/.ssh/authorized_keys ] || exit 0
f=/etc/ssh/sshd_config.d/09-insaneos-root-keys.conf
[ -e "$f" ] && exit 0
mkdir -p /etc/ssh/sshd_config.d
cat > "$f" <<'CONF'
# Written by the insaneos package when upgrading from 0.8.0 (docs/UPDATES.md, "Migrations"): this
# server had root SSH keys, so root keeps logging in with keys only. Insane OS's default, in
# 10-insaneos.conf, is no root login at all: delete this file and restart ssh to apply it.
PermitRootLogin prohibit-password
CONF
chmod 644 "$f"
