# 0.8.1: per-app network permissions (insane-netperm) on wherever Insane OS starts at boot.
# The ISO, the Raspberry Pi image and install.sh enable insane-netperm.service, but the 0.8.0 package
# itself did not, so a system set up with apt alone had the firewall off. Runs once: if an
# administrator disables it afterwards, it stays disabled.
command -v systemctl >/dev/null 2>&1 || exit 0
[ "$(systemctl is-enabled insaneos.service 2>/dev/null || true)" = enabled ] || exit 0
systemctl enable insane-netperm.service >/dev/null 2>&1 || true
if [ -d /run/systemd/system ]; then systemctl start insane-netperm.service >/dev/null 2>&1 || true; fi
