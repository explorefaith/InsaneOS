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

## Session 6 (round 2 — GPU delivery, adaptive quality, benchmarks)
- MEASURED  buffer-age scissor on a real desktop GPU for the first time (build/gpu-scissor, UHD 620 /
        Mesa iris): the scissored compose saves 71–89 % of the frame's GPU time at 1.5–30 % damage;
        58–69 % under a 4-core memory-traffic load; 2,465,420 pixels compared against the whole
        composition, 0 differ. V3D's 0.8.7 loss stands; the default now follows the driver
        (scissor_default in gpu/gpu.c) with the env override kept — docs/GPU.md carries the table
- DONE   rendering side of the performance profiles (sdk/quality.js): auto/balanced/performance/low
        behind Settings → Power and the Control Center's Power Mode tile; levers: canvas_blur_shrink
        through insane.setBlurQuality, and the wallpaper's frame cap changed live through MM_FPSMAX
        (media.control 'fpsmax' → the decode loop, no decoder restart)
- DONE   adaptive layer: two loaded samples in lower the ambient quality (blur floor, then the
        wallpaper ladder cap→half→10), 15 steady seconds per rung back; adaptiveCap unit-tested
        (motion-model-test 64/64); application frame rates untouched
- DONE   docs: WALLPAPERS.md (the adaptive cap), SETTINGS.md (Rendering quality), GPU.md (the
        measurement + decision)
- TESTED engine-test 8831/0 with the scissor default on for Intel; fw-rules 16181/16181; full
        suites green except the documented pre-existing set (imager fixture, clean-test
        nondeterminism, sound/pkg/hwreport JS, store-search's timing check under load)
- BLOCKED InsaneBench comparisons: three attempts, three honest refusals (battery; thermal twice —
        the machine runs the user's own workload; 77–92 °C against a 50 °C passive trip). The gate
        did its job. Procedure in fix/BENCHMARK-ROUND2.md §4
- PENDING on-screen: install via fix/upgrade-insaneos.sh, then TEST-CHECKLIST (wallpaper gallery,
        live wallpaper, dock/panel feel, Launchpad keyboard, CC's DND + Night Light tiles)

## Session 7 (round 3 — real-world responsiveness & interaction engineering)
- MEASURED  the input path end to end: pointer motion dispatch was gated on the main display's page flip
        completing (fpipe.h without the pipeline) — GPU-late frames under load queue the pointer behind
        them; and a burst of due JS timers (up to 64 rounds of js_tick) delays the next device read
- DONE   input: motion dispatches once the queued flip misses its vblank (1.25 periods, motion_due in
        main.c) — the pointer never queues behind the GPU; coalescing unchanged. A timer burst yields
        after 8 ms so events are read between waves
- DONE   input: a pointer latency trace like keylag's (src/plag.c, INSANE_INPUT_DEBUG=1): three stages
        (evdev→read, read→dispatch, dispatch→flip), percentile lines (p50/p95/p99/max) every 5 s to
        $XDG_RUNTIME_DIR/insaneos-pointerlag.log; pointer devices now stamp CLOCK_MONOTONIC (EVIOCSCLOCKID)
- DONE   priority: the focused app's cgroup scope weighs 400 against 100 (sec/fgprio.c follows the
        keyboard focus; new root-side "weight" verb on /run/insaneos/cgroup.sock, backward/forward
        compatible with the enter verb); the live wallpaper's and login screen's decode enters its
        scope at weight 50 (CG_WALLPAPER_CPU_WEIGHT, ambient=1 in the play params); cgweight-test 18/18
- DONE   wallpaper: insane.system.pressure() (PSI memory + MemAvailable) and motionmodel.memoryPressure —
        the wallpaper is the first decoder to stop under real memory pressure (some60 ≥ 25 %, or
        avg10 ≥ 40 % with < 400 MB free) and the last to restart (some60 < 15 % and 800 MB free);
        non-optional 'pressure' pause reason; motion-model-test 78 ok
- DONE   interaction: dock magnification coalesced to one layout per frame (rAF, latest pointer wins) —
        a re-render per event ran at the dispatch rate exactly when the machine is busy; windows restore
        through the same genie warp the minimize uses, driven 1→0 (Reduce Motion skips it); Control
        Center and Launchpad got the panel-entrance their tokens define (closes stay instant)
- MEASURED  real-world suite (fix/realworld-suite.sh + fix/rwload.c, fix/REALWORLD-TESTS.md): ambient
        49.8 fps / frame p99 34.6 ms; all-core nice-0 load 41.2 fps / p99 52 ms / missed 41; memory-
        traffic pressure 18.8 fps / frame p99 639 ms / testbench in-to-screen 338 ms — the case for the
        pressure pause and the unblocked dispatch (a CPU weight cannot buy back a page-wait)
- BLOCKED InsaneBench: refused at the gate again (stopReason: thermal; machine 99 % busy with the
        round's own test run, battery 63 %); quoted verbatim in the session log of the attempt
- TESTED  engine-test 8831/0 (damage fuzz 12 seeds clean; scissor fuzz 1793 frames 0 differ), fpipe
        61/0, cgweight 18/18 (new), fw-rules 16193/16193, fwlists 8307/8307, tzif ok, npcompile
        71/71, timer-order 427538 callbacks 0 differ, mview 9/0, cloud 2279, media-wallpaper OK;
        JS 90 passed / 4 failed (the documented environmental set); motion-model-test 78 ok
- KNOWN  rconnect-run-test 7 failed — verified identical at the round-2 close commit d9cb56b
        (sandbox namespace isolation does not work in this environment); hiss-test 14/15 and
        sql-e2e-test (blocked at 0 % CPU, killed after 22 min) reached for the first time here —
        the suite used to stop at imager-test; all environmental, none in this round's diff
- PENDING install via fix/upgrade-insaneos.sh + relogin, then TEST-CHECKLIST §10 and the suite re-run
        (the round's C changes are in the tree, not in the installed binary — REALWORLD-TESTS.md notes it)

## Session 8 (round 4 — desktop experience, multi-app performance, macOS-inspired interaction)
- MEASURED  the round-3 build installed (04:37) and rebooted: real-display session (i915 KMS 1920×1080@60,
        hw decode) — the pending round-3 comparison taken on it: A 56.0 fps / frame p99 18.2 ms / 39
        vblank skips (was 49.8 / 34.6 / 83 against the pre-round-1 binary; different machine state,
        recorded in fix/results-realworld-20261114-045*), C1 52.1 fps / p99 34.0 ms, C2 12.1 fps /
        p99 869 ms — the memory-traffic collapse stands, unschedulable, as predicted
- DONE   wallpaper: automatic desktop-aware pause — appsOpen() (an app window on the active desktop,
        not minimized/pip/fullscreen) is the new non-default-off 'desktopCovered' pause reason; the
        windows-store and active-desktop subscriptions make it event-driven (no polling); motion-model
        test 96 ok incl. a 100-cycle open/close/minimize/restore acceptance; the "An app window is
        open" switch (default on) in Wallpaper → Pause when
- DONE   windows: the traffic lights' spec'd hit targets (24×24 boxes, circles still 13 px/8 px apart)
        and the 100 ms glyph fade through useTween; CSD overlay keeps its plate with the same treatment
- DONE   panel: the old Lord OS crown (the Cleaner status item's PNG!) replaced by a generated four-point
        spark (tools/gen-cleaner-status.py); the keyboard layout's US label off by default (Menu Bar
        settings row brings it back; switching itself untouched) — found by zooming into the user's
        actual screenshots, not by grepping
- DONE   battery: charge limit refuses honestly — without charge_control_end_threshold the action
        answers battery.limit.unsupported (translated), writes nothing; the dropdown rolls back and
        shows the reason (this machine: unsupported, verified in /sys)
- DONE   sound: the effects layer — shutter (mirror slap), trash (crumple), plug/unplug (two-note)
        synthesized in snd.c with per-effect volume (sound.play(name, vol)); sdk/soundfx.js gates
        everything (Settings → Sound → Sound Effects: master, volume, per-event, previews; minimize/
        restore and app launch are opt-in); the shutter fires only after a capture landed
- DONE   widgets: the desktop widget system — widgetmodel.js (grid, clamp, free spots, persistence to
        settings.desktopWidgets, widget-model-test 20/20), edit mode (desktop right-click → Edit
        Widgets: drag, remove, gallery) and calendar/battery/media cards; weather honestly absent
- DONE   dock: the understated defaults (46/62 px, bar 70) — magnification machinery unchanged
- TESTED JS 91 passed / 3 failed (the documented environmental set); menubar-model updated for the new
        default; bundles + code manifest clean; C suite run at the round's close (see ROUND4-REPORT.md)
- PENDING install + relogin for the round-4 build; then TEST-CHECKLIST §11 and the wallpaper-paused
        CPU comparison (the running session's binary predates this round)
