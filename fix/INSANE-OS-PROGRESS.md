# INSANE OS — Progress Log

Format: `[state] item — detail`. States: DONE, TEST-ON-SCREEN, PENDING, BLOCKED.

## Session 1 (bugfix round)
- DONE  insane-server CPU burn root-caused (8/12 ms IPC pollers never clearing) and fixed
        (idle backoff, sdk/vault.js + doc.js + mail.js; installed via rebrand build)
- DONE  Screenshot permission (permisos.json deny → allow) + shortcut audit (PrintScreen/❖⇧3/4/5)
- DONE  Mouse speed (settings was 1 = 2× cursor), pointer size, natural-scroll reset
- DONE  zram 3.8 GB zstd, sysctl (swappiness/vfs/page-cluster), noatime, fstrim.timer, journal 128M
- DONE  VA-API (intel-media-va-driver) → hardware YouTube decode
- DONE  CPU microcode (intel/amd) via full-upgrade
- TEST-ON-SCREEN  all of the above (user confirmed desktop smooth)

## Session 2 (rebrand + features)
- DONE  Rebrand InsaneOS → Insane OS: 981 files, display strings, 158 locale files, theme names
        (Insane Flow/Insane Classic), wordmark + glyph components, docs; internal names
        (binaries/paths/URLs/API) intentionally unchanged (user: no logic/URL changes)
- DONE  New brand rendered: chaotic burst mark, app icons 16–1024, glyphs, wordmark mark
        (pure-stdlib renderer tools/gen-brand-insane.py; SVG + PNG)
- DONE  Traffic lights on ALL windows incl. CSD (Chromium/GTK overlay), hidden on fullscreen
- DONE  macOS-style window capture (hover → highlight → click; drag = area)
- DONE  Ctrl+Shift+S shortcut
- DONE  Pressure-based background freezer + log (insaneos-smooth-freeze user service)
- DONE  Hot corners (3 default actions, configurable), Power Mode tile, battery limit
        (skipped: this battery has no charge_threshold sysfs — hardware), login chime (C synth),
        auto dark, dynamic wallpaper engine, menu bar CPU·temp widget, text replacement,
        Speed up button (optimize-now admin action), auto power profile
- DONE  Settings UIs: Automatic Appearance, Hot Corners, Text Replacement, Charge limit,
        Auto power switch

## Session 3 (aesthetic + this mission)
- DONE  Live wallpaper wired natively (motionUser → ~/Videos/insane-galaxy.mp4, 12 s loop,
        VA-API decode confirmed via vainfo + session log "vaapi":true)
- DONE  Login wallpaper set through the native root store (login-still = image:login-*.jpg)
- DONE  Login screen: dark vignette + glass panel (blur 30 px) around avatar/name/password
- DONE  Boot splash v2: 48-particle 3-layer field, breathing glow, eased bar, tagline
- DONE  Desktop glass widgets: clock (time/day/date) + live stats (CPU/RAM/temp) with
        wallpaper colour matching (pixels sampled from the playing wallpaper via
        wallpaperMedia store → accent/glow; native widget registry, behind windows)
- DONE  Window opening fade+rise (reduceMotion-aware), CSD lights hidden on fullscreen
- DONE  unattended-upgrades (security-only policy) + security enforcement snapshot
- DONE  Rebrand crash fixes caught pre-ship: MenuBar useEffect import, Control Center Button
        import, store.subscribe signature, InsaneOSPage identifier split
- TEST-ON-SCREEN  splash particles, live wallpaper, widget colours, window open feel
- PENDING  content search indexer, Universal Clipboard (needs 2 devices), Stage Manager
- BLOCKED  battery charge limit (no sysfs threshold on this hardware — service auto-disabled)

## Session 4 (deep pass — audit + design language v2 + root-cause: install gap)
- AUDIT  installed vs repo mismatch found: the user never re-ran the script after session 3 —
         every "broken" item (login wallpaper, boot splash, window animation, widgets v2) was
         sitting in the repo uninstalled. Live wallpaper settings were wired directly (works
         after next login). Script is the one required action.
- DONE   Widgets v2 — "classic premium": warm white cards (rgba(252,251,247,.92)), black
         typography, hairline borders, soft shadows, wallpaper-matched MUTED ink accent
         (sampled → desaturated → darkened), flat bars (no neon gradients)
- DONE   Login entrance animation: clock settles in first, glass panel rises 20 px and fades
         in with cubic ease-out (~0.8 s)
- DONE   Splash v2 verified + tightened: Park-Miller seeded particle init, size_for hoisted
         (order bug fixed), glow pulse, mark pulse, tagline fade-in
- DONE   Desktop/Operating re-synced with the final rebranded source (756 MB, publish-ready)
- PENDING  content search indexer, Universal Clipboard, Stage Manager (design notes in ROADMAP)

## Session 5 (transformation round 1 — performance, stability, wallpaper engine)
- DONE  audit: compositor + wallpaper engines mapped end to end (two reports: render pipeline,
        damage, GPU lifecycle, caches, watchdogs; media IPC, pause coverage, failure paths)
- DONE  rebrand regression fixed: fw scope-prefix length constants (15/11 → measured) — per-app
        firewall rules, Monitor app ids and notification app names never matched any scope since
        the rename (fw/rules.c, ui/js_monitor.c, sec/appid.c, sec/cgroup.c, sec/pwguard.c)
- DONE  rebrand regression fixed: tzif test's Australia/Lord_Howe listed as "Insane_Howe" — the
        30-minute-DST edge case had been dead since the rename; 216k instants now compare 0 diff
- DONE  GPU frame failure now retries: out_present's failed path goes through gpu_to_cpu (sets
        gpu_paused) with an exponential retry backoff (1 s … 30 s) so a broken GPU can't spin
- DONE  runaway-JS watchdog: JS_SetInterruptHandler + 3 s wall-clock budget on event dispatch and
        promise jobs (never on bundle eval) — a theme infinite loop throws and logs, the desktop
        survives
- DONE  unbounded caches capped: glyph cache wipes at 64 MB of bitmaps / 65536 entries (visible
        text re-rasterizes, hot set refills); file-image cache gc frees entries not drawn for 60 s
        once the cache passes 256 MB, image_draw reloads an evicted entry from its path
- DONE  wallpaper: compositor-side display-power backstop (media_display_power) — DPMS off pauses
        the wallpaper/greeter players in C, resume restores only what it paused
- DONE  wallpaper: helper watchdog — a player silent for 10 s (wedged decoder) is killed, the JS
        side sees a crash; zombie reap no longer spins on already-reaped pids
- DONE  wallpaper: no black flash before the first frame or across a ring rebuild — the wallpaper's
        and greeter's MediaView backgrounds stay transparent until pixels exist (mview.c)
- DONE  wallpaper: retry policy with growing waits (0.5 s, 1 s, 2 s, 4 s) and a persisted per-file
        disable (settings motionDisabled) with a try-again affordance (sdk motionDisabled/retryMotion)
- DONE  Wallpaper settings: the shipped motion catalog is back as a gallery (sections, verified
        downloads with progress, apply dialog desktop/login, remove, stopped→try again), real
        playback facts under the preview (the player's own stats), your-own-video flow with probe
        checks and heavy-video warnings, and the six "Pause when" switches
- KNOWN imager-test: release-SHA256SUMS.sig does not verify against the repo's public release key
        (pre-existing at 000142d; needs the maintainer's private key to re-sign the fixture — not
        weakened to keep the suite green)
- PENDING on-screen test of the live-wallpaper changes (desktop + login screen), theme audit for
  the design-system phase
