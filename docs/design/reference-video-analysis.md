# Reference Video Analysis — Shell Ninja "Arch Linux" Rice (HI0BEngMtLA)

Source: `refvideo/Arch Linux.mp4` — 1280x720 @ 30 fps, 14:49.9, 45 MB, h264+AAC.
Analysis method: 74 frames sampled at 12 s intervals across the full timeline
(frames in `~/.cache/insane-ref-analysis/`), ffmpeg scene scan, audio loudness
analysis (volumedetect, ebur128, silencedetect) + 1920x1080 spectrogram.

## 1. What the video is

A full feature tour of **Shell Ninja's** Arch Linux + Hyprland + **Quickshell**
desktop rice (channel: shell-ninja; the rice ships via
`shell-ninja/hyprconf-install` [installer] + `shell-ninja/hyprconf`
[dotfiles, v1.0.2]). The video contains **no narration** — it is backed by
continuous bass-heavy music (−14.2 LUFS integrated, LRA 4.8 LU, max −0.8 dB,
no silence gaps ≥3 s, fade-out in the last ~15 s).

## 2. Chronological tour (evidence: frame timestamps)

| t (s) | What happens |
|------|--------------|
| 0–60 | Base desktop: anime character wallpaper (right side), floating top-center island bar, 3-column `lf` terminal window (left), fastfetch-style info card (bottom-right, Shell Ninja logo + Arch Linux x86_64 / Linux 7.3.13-zen2-2-zen / 6 (pacman) / fish 4.0.3 / kitty 0.56.0 / Hyprland 0.57.2 (Wayland)), live audio spectrum visualizer box (bottom-left) |
| 60–156 | **Control center** opens under the top bar: avatar + "shell-ninja" + uptime + power; theme preset chips **Violet / Orig / Pastel / Mono / Cool / Warm** (Warm active); tile toggles Ethernet (Connected), Bluetooth, Night Light (On), Caffeine, DND, Performance; two vertical sliders 30–40% (brightness/volume); sun/moon tiles; Notifications section ("All caught up"); weather footer chip + inline visualizer strip. RAM chip appears in bar ("RAM 2.2 GB"), red REC timer with elapsed time |
| 156–180 | **System Metrics panel** (island page 3): CPU/RAM/GPU/NET chips, orange history graph, Memory (RAM) bar "2.3 GB (5.4 GB) 44%", GPU section "AMD Radeon Graphics — VILLLoad 230 MHz / 528 MHz", Kernel activity row, 8 per-core vertical bars, pagination dots |
| 180–192 | Back to control center (brightness 33%) |
| 192–252 | **Weather Forecast panel** (island page 1): location search ("Homna, Bangladesh" → other cities), "Save" button, big 29° Clear sky, Humidity/Wind/UV/Pressure chips, 7-day forecast rows with gradient temperature bars, pagination dots + "Control Center >" button |
| 252–264 | **Wallpaper selector** (wide floating panel): carousel preview, "Wallpaper · 160 wallpapers", Shuffle toggle, source chips Wallpapers/Live/Wallhaven, search field, Mixed + NSFW toggles, **Accent >** dots row (wallpaper-derived accent colors), Apply. Purple PS-controller wallpaper "dnk_purple" applied |
| 264–276 | Wallpaper applied; control center re-opened; **entire shell retints purple** |
| 276 | Wallpaper switched to "cyberpunk-ninja" (red/pink) → **entire shell retints red/crimson** — wallpaper-driven adaptive theming across bar, panels, settings app |
| 264–360 | **Hyprland & Quickshell Settings** (big centered window): sidebar = Hyprland Settings, Dynamic Island, Desktop Widgets, Weather Forecast, Lockscreen Canvas, Application Dock, Top Bar Studio, Updates & Releases, Plugin; tabs = Overview, Appearance, Display, Animations, Input & Touchpad, Keyboard, Login Actor. Display tab: monitor resolution/refresh/scaling. **Animations tab: cubic Bézier velocity-curve editor** (canvas with draggable points), presets (elegant_bounce, mega_out, smooth_pop, slide_glide…), duration/loop preview, per-directive rows (windowsIn/windowsOut with speed sliders + bezier dropdowns). Input tab: pointer sensitivity, natural scroll, tap-to-click, disable-while-typing, left-handed swap, numpad. **Keyboard tab: Hyprland Keybindings Manager** (55 binds, search, category chips, rows with chips like "App Launcher", play/edit/delete buttons, "Edit Keybinding (SUPER+W)" modal with key-capture, modifiers SUPER/CTRL/ALT/SHIFT, action types Launch Command/Window Action/Workspace/Custom Log, presets, generated config snippet preview) |
| 360–384 | Login Actor tab: SDDM theme section ("SilentSDDM is not active. Current SDDM theme: prohoril", "Set SilentSDDM as Active Theme" — requires admin), User Profile & Avatars (avatar for SDDM login + desktop lockscreen) |
| 384–432 | **Dynamic Island settings**: "Dynamic Island Architecture & Visualizer — Configure layout smoothing, notch-to-island expansion, adaptive character wings, flex-bar transitions. Reset Defaults." Design picker: **Prism Blade** (active), **Orbital Satellite**, **Minimalist Matrix Rail** (radio "Recommended Design") with mini previews; Screen Position: Top Notch / Bottom Dock; toggles: Auto-Hide on Inactive, Move Visualizer to Bottom of Home on Hover, Matrix Rail Stream Animation; **Audio Spectrum Visualizer**: enable toggle, Bar Style = Harmonic Wave / Spectrum Equalizer / Floating Beads, Bar Count = 16/32/64, "Spectrum Stimulation & Preview" at 20 fps, Pause Simulation |
| 432–444 | **Desktop Widgets**: "DESKTOP CANVAS (DRAG & RESIZE)", Layout Library / Customize / Global tabs, live desktop preview, widget list with toggles: Desktop Clock, Audio Visualizer (on), System Monitor (CPU/RAM/usage/graphics/temp graphs), Audio Player (playlist strip + transport controls), Weather Forecast (glass HUD) |
| 444–456 | **Weather & Atmospheric Telemetry**: City/Town + Country selects, Quick Cities chips (London/Tokyo/New York/Paris/Ohio), Window Glass View chips (Rain & Wind, Clear Sky, Sun on Glass, Thunderstorms, Snow & Frost, Dark Clouds, Dense Fog) that restyle a photographic "window" preview, "Apply & Fetch", solar trajectory arc (6:40 AM → 5:30 PM, daylight progress 71%), wind/humidity tiles |
| 480–492 | **Lockscreen Canvas editor**: Cancel/Live Preview/Widget Configs & BG/Center X/Stick with Avatar/Reset/Save/**Test Lockscreen** toolbar; preview with clock 02:38, date, weather chip, avatar ring ("Drop Image / Drag Image"); User Avatar panel (Diameter slider 123 px, Breathing Pulse Animation, Celestial Orbit Ring & Satellites, Luminous Aurora Halo Glow); bottom tabs Clock/Weather/User/Password/Weather/Slots/Visualizer |
| 492–516 | **Dock & Bottom Bar Studio**: Dock Disabled toggle, "Sculpted Bottom Bar" vs "Classic Application Dock" (macOS-style, radio), Interactive Dock Preview, Dock Shadows & Visibility |
| 516–540 | **Top Bar Studio**: "Switch seamlessly between Dynamic Island and Full Top Bar and arrange bar modules" — two big cards; Live Bar Preview; Layout Zones (Start: App Launcher, Dynamic Workspaces, System Tray Drawer, Live Weather, Power Profile Switcher; Center: Profile Switcher, Clock & Calendar, Network Speed, Notification Center; End: Package Updates, Quick Toggles Group, System Monitor, Volume Controller) with reorder/up/down/remove per row; **Full Top Bar mode activates** — the bar becomes a full-width top strip showing workspaces 1–5, "Clear sky 29°" chip, clock+date, net throughput (401kB↑ 0B↓), tray icons, RAM 2.6G CPU 4% GPU 4% 465i chips. Widget Fine-Tuning grid (All/Active in Bar/Workspace/Audio & Media/Performance/Utilities): Dynamic Workspaces, Volume Controller, System Tray Drawer, Package Launcher, Active Window Title, System Monitor, Live Weather, Quick Toggles Group, App Launcher, Network Speed Monitor, Clock & Calendar, Job Indicator (Caffeine), Media Player, Battery/AC Power, Notification Center, Night Light (Sunset), Audio Spectrum Visualizer, Power Profile Switcher, Do Not Disturb (DND), Clipboard History |
| 540–560 | **Updates & Releases**: "Hyprconf is Up to Date v1.0.2 (stable)", stat cards (installed version, latest upstream, update shortcut SUPER+SHIFT+U, user state "100% isolated — requires Git Snapshot"), What's New changelog cards (Personal Keybinds Preserved, Cursor Quick Paste SUPER+V, Desktop Modes & Blur Engine (Island/Glass tri-state), Spotlight Omnibar & Calculators (unit conversion, multi-currency), Obsidian Glass & Spring Tuning), Dotfile Update Pipeline & Integrity (Git-pre-preserved, stash-guarded), Launch Dotfile Terminal Updater |
| 564 | OBS Studio + code editor visible: `RELEASE_NOTES_v1.0.2.md` — documents **GLSL shader wallpaper transition engine** (`WlLayer: Bottom`, `exclusiveZone = -1`, modes: "perfil" silhouette+bloom via ONNX `silueta.onnx` SDF tracing; "louvaugl" 2D value-noise liquid marble; zero-flicker buffer hand-off via shm sockets; `transition-mode` 0.0→1.0), Interactive Welcome App, tri-state Desktop System Modes |
| 576–612 | **Plugins & Extensions**: drag-and-drop install ("plugin.json manifest"), Installed (1): Code Theme Synchronizer v1.0.5 (harmonizes VS Code/VSCodium/IDE themes with wallpaper accents), Available Catalog (0) |
| 612–624 | **System Package Updater** floating window: stats (0 Total / 0 Pacman / 0 AUR), update sources Pacman + AUR (paru) with "up to date" checkmarks, Skip for now, live terminal output pane, "All packages are up to date" |
| 636–672 | Bottom **floating dock** enabled (~8 icons in a pill), **emoji picker** popup, **Spotlight Omnibar** launcher with typed query "20 usd to M" (unit/currency conversion inline), browser opens |
| 696–840 | Browser visits **github.com/shell-ninja/hyprconf-install** then **github.com/shell-ninja/hyprconf**: dotfiles tree under `~/.hyprconf/` (hypr/ with Lua configs env/exec/keybinds/windowrules/animations + scripts py/hypr-colors.py "M3 color harmony extraction engine", py/weather.py "Open-Meteo weather fetcher & daemon", sh/qs-dock.sh, sh/qs-island.sh, sh/qs-reload.sh, wallpaper/; quickshell/ with dock/, island/ "3-Page Dynamic Island (Weather, Control, System)", launcher/, lockscreen/ "Morphing PAM lockscreen", widgets/ "Desktop System Monitor, Weather & Visualizer", settings/ + Theme.qml "Live-reloaded reactive theme tokens"; kitty/, nvim/, .version). Installer TUI screenshots: hardware probing profile (Arch · Linux 7.3.4 · 15GB · Desktop; toggles for Quickshell suite, SDDM Prohoril/SilentSDDM, Bluetooth & audio, shell, browser, NVIDIA, keyboard incl. Felix5 & OpenBangla Bangla keyboard), 10-step live execution log, Setup Completed summary (Compositor: Hyprland; Shell: Quickshell; DM: SDDM; config ~/.hyprconf/, user state ~/.local/share/; shortcuts Super+Return Terminal, Super+Space Spotlight Omnibar, Super+W Wallpaper Studio, Super+Y Quick-paste Clipboard Tooltip, Super+X Power & Session Menu). Keybinds: 55 total; updater = Gum-powered `hyprconf.sh`, update notification with "Update Now" + audio chime |
| 852–end | Batman Gotham wallpaper outro — shell retints to neutral dark blue-gray again (adaptive theming demonstrated a third time); music fades |

## 3. Visual language (the target aesthetic)

- **Backgrounds**: deep black/charcoal; wallpapers are large character/scene art anchored right or centered; UI floats over them.
- **Accents**: one dominant accent (violet/purple in default, crimson/red over red wallpaper, neutral blue-gray over Batman) — **the accent is derived from the wallpaper** and applied to toggles, active chips, sliders, highlights, borders.
- **Surfaces**: dark translucent panels (approx 90–95% opacity) with **rounded corners (12–24 px)**, 1px subtle border, generous padding; nested cards inside panels use slightly lighter fills.
- **Panels float**: island bar top-center (pill), control center/metrics/weather attach under it; wallpaper selector wide top; settings app large centered; dock floats bottom-center.
- **Typography**: small, medium-weight sans (likely Inter/JetBrains mix); monospace for fetch card + terminals; chips everywhere (small rounded pills with icon+label).
- **Motion**: everything glides — panels scale/fade from their anchor chip, bars morph, toggles have springy transitions; "elegant_bounce" cubic Bézier curves; visualizer bars animate with real audio.
- **No chrome clutter**: no big window decorations; single pill bars; thin separators; consistent iconography.

## 4. Feature matrix observed (what "premium" means here)

1. Top interface: Dynamic Island (3 pages: Weather / Control / System) **or** Full Top Bar, both with per-module layout editor (zones: start/center/end).
2. Control center: theme presets, connectivity tiles, brightness/volume vertical sliders, night light, DND, caffeine, performance, notifications, weather footer, inline visualizer.
3. System metrics: CPU/RAM/GPU/NET history graphs, per-core bars, kernel activity.
4. Weather: Open-Meteo data, location search + save, 7-day forecast, weather-glass views, solar trajectory.
5. Wallpaper studio: library (160), Live wallpapers, Wallhaven online source, search, shuffle, accent extraction, apply.
6. Adaptive theming: wallpaper → accent → whole shell retint (M3 harmony extraction); theme presets (Violet/Orig/Pastel/Mono/Cool/Warm).
7. Settings app: 9 sidebar sections × 7 tabs, Apply/Cancel model, real system integration (SDDM themes, monitors, keybinds written live).
8. Animation studio: Bézier curve editor + presets + preview, per-directive speed/style.
9. Keybind manager: search, categories, capture, edit modals, generated config, cheat sheet.
10. Lockscreen canvas: drag & resize, per-widget tabs, avatar aura effects, Test Lockscreen.
11. Dock studio: sculpted bar vs classic dock, shadows, visibility.
12. Desktop widgets canvas: drag & resize (clock, visualizer, system monitor, audio player, weather).
13. Updates: version stats, changelog, updater pipeline, notifications with chime.
14. Plugins: manifest-based install, catalog.
15. System package updater: pacman + AUR with live output.
16. Spotlight Omnibar: apps + unit conversion + emoji picker + clipboard quick-paste.
17. Notifications: history, "All caught up", usage alerts.

## 5. What we deliberately do NOT copy

- Branding (Shell Ninja logo/name), the exact anime wallpapers, YouTube-facing layout gimmicks.
- QML/Quickshell as a foundation (Insane OS has its own compositor + shell stack; mission mandates C-first new components).
- Features that need services Insane OS doesn't have yet (SDDM theme switching) — adapt to the existing login/session stack.

## 6. Direct mapping to Insane OS mission

| Reference feature | Insane OS target |
|---|---|
| Dynamic Island pill bar | Existing top bar/panel (React shell) — restyle to floating pill + island pages |
| Control center (Violet…Warm chips) | New control-center panel with accent presets + real toggles |
| System metrics page | C daemon feeding real /proc,/sys data → graphs |
| Audio visualizer | C PipeWire/Pulse capture → shell visualizer (real data) |
| Wallpaper studio + accent extraction | Wallpaper manager + C accent-extraction (M3-like) + shell retint |
| Settings app | Extend existing settings app with appearance/wallpaper/shortcuts pages |
| Weather island page | Weather widget (Open-Meteo, cached, consent-gated) |
| Keybind manager | Settings shortcuts page writing compositor keybind config |
| Dock studio | Existing dock: styling + pinning flows already exist |
| Lockscreen canvas | Existing lock screen: restyle + avatar |
| Spotlight omnibar | Existing launcher: add search behaviors |
