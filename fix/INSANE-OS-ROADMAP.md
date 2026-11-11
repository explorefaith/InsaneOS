# INSANE OS — Engineering Roadmap

OS: Debian 13.7 (trixie) • kernel 6.12.116+deb13 • compositor: lord-server (Wayland + XWayland, C)
Machine: faith-pc • i5-8365U (8T) • 8GB RAM • NVMe 234GB • Intel UHD 620 (i915 + VA-API iHD)

Phases: ✅ done & verified • 🟨 done, needs on-screen test • ⬜ pending • 🚫 blocked/deferred

## Phase 1 — System audit ✅
Full audit in INSANE-OS-TEST-REPORT.md §1. Key facts: Wayland session (wayland-0 + XWayland :0),
custom C compositor (not GNOME/KDE/XFCE), AppArmor 4.1 kernel-enabled (Y, 105 profiles on disk),
lean 28 enabled services, ~5 s userspace boot, VA-API h264/hevc/vp9 hardware decode active.

## Phase 2 — Desktop experience ✅ (built on the native compositor)
Traffic lights (CSD overlay + native frames) ✅ • menu bar ✅ (native) • dock + magnify ✅ (native)
Launchpad ✅ • Overview/Mission Control ✅ • virtual desktops + swipe ✅ • snapping ✅
hot corners ✅ (added) • fullscreen ✅ • shortcuts ✅ • Quick Settings ✅ (native Control Center)
Notification Center ✅ • clipboard history ✅ • smooth app switch ✅ (native AppSwitcher)

## Phase 3 — Signature animation system 🟨
- Boot splash v2: particle field (48 sprites, 3 depth layers, drift/sway/twinkle), breathing glow,
  eased progress bar, boot timer — Plymouth script rewrite ✅ (needs reboot to see)
- Window open: fade + 12px rise, ~200 ms, reduceMotion-aware ✅ (this pass)
- Minimize: native Dock-genie ✅ • workspace switch: native slide+fade ✅
- Desktop widgets fade-in ✅ • notification entrance ✅ (native)
- ⬜ window close animation (engine work), ⬜ lock-screen transition, ⬜ theme cross-fade

## Phase 4 — System applications ✅ (all native, all present before + branded)
Settings ✅ Files ✅ Store ✅ Terminal ✅ Monitor ✅ Security Center (Privacy+Firewall) ✅
Update Manager ✅ Backup ✅ Cleaner ✅ Welcome/tour ✅ — rebranded "Insane OS" (981 files).

## Phase 5 — Performance ✅
poller CPU fix ✅ zram(3.8GB zstd) ✅ swappiness/vfs pressure ✅ noatime ✅ fstrim.timer ✅
journal 128M cap ✅ VA-API decode ✅ microcode ✅ pressure-freezer ✅ auto power profile ✅
auto security updates ✅ (this pass) • boot 23 s → userspace ~5 s ✅
⬜ per-service startup trimming (documented only — nothing disabled without testing)

## Phase 6 — Security & privacy 🟨
AppArmor ✅ enabled (kernel Y, 105 profiles; enforcement snapshot in security-audit.txt)
Firewall ✅ LordOS per-app (lord-netperm active; nftables libs present)
Auto security updates ✅ (unattended-upgrades, security origin only — OS updates stay with the Store)
PAM + lock ✅ (native) • Privacy dashboard ✅ (native permisos) • package verification ✅ (signed repo + codesig)
Backup/recovery ✅ (native Backup + REVERT.sh) • ⬜ LUKS (installer-time only) • ⬜ secure DNS toggle

## Phase 7 — Productivity ✅
Spotlight (❖Space) ✅ Quick Look ✅ Screenshots/OCR/recording ✅ archive (libarchive) ✅
PDF ✅ diagnostics (sysreport+bench) ✅ disk mgmt ✅ calendar/calculator ✅ DND ✅ recent files ✅
desktop widgets (clock+stats, wallpaper-matched colours) ✅ multi-monitor ✅

## Phase 8 — Device integration ✅ (native stacks verified present)
Bluetooth ✅ printers ✅ displays ✅ audio ✅ USB ✅ local sharing ✅ network ✅ power mgmt ✅

## Phase 9 — Recovery & reliability ✅
GRUB previous-kernel ✅ (Debian standard) • REVERT.sh full theme/binary rollback ✅
sysreport + bench diagnostics ✅ • backup app ✅ • crash logs (session.log, journal) ✅
⬜ update rollback (apt snapshots — future)

## Phase 10 — Final testing 🟨
Test suite: 16 binaries, tens of thousands of checks — 0 failures except 7 environmental
(rconnect cgroup; code paths untouched by the rebrand). Full on-screen checklist: TEST-CHECKLIST.md.
