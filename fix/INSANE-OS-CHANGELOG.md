# INSANE OS — Changelog (this fork)

## 0.8.8.6-insane.5 — full rebrand: every name and the mark itself
- Full rename, inside and out: `lord*` → `insane*` across ~2000 files — binaries
  (`lord-server` → `insane-server`), packages, IPC methods (`lord.*` → `insane.*`),
  config paths (`~/.config/lordos` → `~/.config/insaneos`), systemd units, docs, URLs
  (`lordos.org` → `insaneos.org`, `github.com/lordbasex` → `github.com/insaneos`).
  165 file/directory renames (`git mv`), text replaced in 1831 files; the EFF/diceware
  wordlist data is untouched (upstream data, not branding)
- New mark: an orange apple (body, stem, leaf) with an amber → deep-orange radial gradient,
  replacing the burst/crown everywhere — app icons (16–1024), menu-bar glyphs, the wordmark's
  front mark, Plymouth splash, GRUB menu, favicon, social card, wallpapers, `insaneos-fetch`
- The wordmark "Insane OS" is outlined from the brand face (Plus Jakarta Sans ExtraBold) by a
  TrueType parser in `tools/gen-brand-insane.py` (pure stdlib: cmap/glyf/hmtx/loca) — every
  SVG lockup and the boot wordmark render from those paths; two font quirks handled (its loca
  header lies about the format; the space glyph sits past numberOfHMetrics and inherits a too
  wide advance — the wordmark uses a normal word space)
- Boot splash recoloured: orange glow and bar behind the apple on the navy gradient; the GRUB
  selection band orange; boot previews regenerated (`tools/boot/gen-boot-assets.py`)
- Lumo's headgear is the apple now (the crown is gone from every pose), laptop lid sticker too;
  mascot SVGs + UI PNGs regenerated
- Motion wallpaper re-rendered: a seamless 6 s palindrome loop of a slow orange dawn over navy
  (h264 874 KB, hevc 119 KB, poster + thumb; `motion.json` 1080 entries' sizes/hashes updated)
- Brand docs rewritten for the new mark (docs/INSANEOS-BRAND.md, docs/brand/README.md): colour
  tables, proportions, typography, don'ts; swatches re-inked to the orange palette
- Themes build verified after the rename (`npm run build` clean); the theme accent colour is
  unchanged (the UI accent is still violet — only the mark and brand materials are orange)

## 0.8.8.6-insane.4 — design language v2 (classic premium) + install-gap fixes
- Desktop widgets redesigned: warm white cards, black typography, hairline borders,
  flat muted accents that follow the wallpaper (sampled ink, not neon)
- Login screen entrance: clock + glass panel rise and fade in with cubic easing
- Boot splash: particle init order fixed, seeding documented, glow/mark pulse tuned
- Install gap identified and documented: session-3 deliverables required a script re-run

## 0.8.8.6-insane.3 — this build
- Window opening animation: fade + 12 px rise, 200 ms, skipped when reduce-motion is on
- Traffic lights hidden while an app is fullscreen (were overlaying content)
- unattended-upgrades enabled with a security-only policy + 20auto-upgrades
- Security enforcement snapshot written to the backup folder on every install
- Boot splash v2: 48 glowing particles in three depth layers (drift, sway, twinkle, wrap),
  breathing violet glow behind the mark, eased progress bar, "insane os" tagline fade-in,
  boot timer — all in the Plymouth script, CPU-light, no boot delay added
- Desktop widgets: colours now follow the live wallpaper (pixels sampled from the playing
  video through the new wallpaperMedia store; accent + glow tint the glass, bars and clock)
- Fixed from the verification pass: MenuBar missing useEffect import (menu bar crash),
  Control Center missing Button import (panel crash), store.subscribe callback signature
  (auto power profile never fired), InsaneOSPage identifier split (Store build failure)

## 0.8.8.6-insane.2
- Rebrand: InsaneOS → Insane OS across 981 files (UI, 158 locale files, docs, login, About);
  new burst mark + app icons rendered from vectors (pure-stdlib renderer); theme names
  Insane Flow / Insane Classic; internal names, paths and URLs deliberately unchanged
- Live wallpaper wired natively (motionUser), login wallpaper through the native root store
- Login glass panel; desktop glass widgets (clock + live stats) in the native widget registry
- Plymouth splash assets rendered (mark, glow, particles)

## 0.8.8.6-insane.1
- Rebase on upstream 0.8.8.6-dev (master): screenshot media-job fix, sharper fractional
  scaling, Cloud freeze fix, Bluetooth mouse trust fix, multi-display screenshots, OCR
- SDK poller idle backoff (vault/doc/mail): the 8 ms boot-long CPU burn is gone
- Pressure-based background freezer; hot corners; auto power profile; Speed up button
- Battery charge limit (auto-disabled where the hardware has no threshold)
- zram + sysctl + noatime + fstrim + journal cap; VA-API; CPU microcode
- Traffic lights on every window; Ctrl+Shift+S; macOS-style window capture
- Login chime (synthesized C6-E6-G6); auto dark; menu bar CPU·temp widget; text replacement
