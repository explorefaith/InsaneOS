# REGRESSION_CHECKLIST.md

Re-run after every fix. "Auto" = an automated check that exists today; "Manual" = exact steps for
the live desktop. Every fix commit states which lines were re-run and what passed.

## Automated checks (all must stay green)

| Check | How | What it guards |
|---|---|---|
| `server/build/canvas-test` | run from `server/` | rasterizer bit-exactness (incl. the blur banded copies) |
| `server/build/bench-test` | run from `server/` | 22 engine invariants |
| `server/build/engine-test` | run from `server/` | layout engine (8831 cases) |
| `server/build/fpipe-test`, `cgweight-test`, `fw-rules-test` | run from `server/` | file pipe, CSS weight, firewall rules |
| `node tests/switcher_model_test.mjs`, `node tests/hwkeys_test.mjs` | repo root | app-switcher and menubar model defaults |
| `node server/tests/widget_model_test.mjs` | repo root | desktop-widgets model (six catalog entries) |
| `server/build/sound-test` | run from `server/` | PulseAudio protocol serialization |
| Build cleanliness | `make build/insane-server` | no new `-Wall -Wextra` warnings |
| ASan/UBSan build | separate build dir, `-g -O0 -fsanitize=address,undefined`; run the touched test binaries + the lab instance | no leaks/UB in touched code |

## Manual checks (the live desktop; after every UI-side fix)

### Dock
- [ ] App launches from the dock (click).
- [ ] Hover magnification follows the cursor, rAF-coalesced, no jitter.
- [ ] Auto-hide: dock appears on edge approach, hides after leave; re-enter cancels the hide timer.
- [ ] Right-click menu opens; "Remove from Dock" removes without a visible freeze (<100 ms).
- [ ] Dock settings (Settings → Dock) still apply (size, magnification, position).

### Top bar
- [ ] Status items in order: cleaner spark, battery (and % if enabled), clock; no crown, no layout
      label unless Settings → Keyboard turns it on.
- [ ] Control-center menus open and close; nothing hides while a menu is open (once C lands).

### Island strip and Auto accent (the desktop transformation)
- [ ] The top menu bar is gone (windows use the full height); the island is a floating glass pill at
      the top centre: open apps on the left, battery %, one-click screenshot, 24-hour clock, the bell
      and the control button — and nothing else (no logo, no OS name, no menus).
- [ ] Auto-hide: with an app open the island slides off the top (a small ear stays at the edge); the
      pointer touching the top edge slides it back over the window; an empty desktop keeps it on.
      While hidden it must not eat clicks over the window (hit-testing follows the transform).
- [ ] Clicking an open app's icon opens the golden panel under the icon with that app's windows;
      a row brings the window forward, × closes it; a click outside closes the panel.
- [ ] The control button opens the Android-style quick settings: Wi-Fi status (opens Settings),
      Bluetooth with a real switch, Night Light, Do Not Disturb, dark mode, the volume slider and
      the brightness slider (one display-brightness action per drag, not one per pixel).
- [ ] The bell opens notifications and the calendar; the unread dot clears when it opens.
- [ ] Auto accent: change the wallpaper (a still one and a live one) and the bar, panels and toggles
      retint; the Auto chip in Control Center shows the sampled colour; presets still apply; light
      mode keeps text legible (accent tone-mapped, violet fallback on an older server).
- [ ] Visualizer widget: add it from Edit Widgets; with audio playing the bars dance, in silence the
      desktop repaints nothing (the session log gains no frames); removing the last card releases the
      monitor capture.
- [ ] Weather tile: first open asks (Allow / No thanks — declined never fetches); allowed, it shows
      real conditions for Dhaka with a refresh button; with the network down it shows the cached data
      marked stale, or "Unavailable" when there is no cache.

### Windows
- [ ] Traffic lights: left/right position (Settings → Appearance → Window Controls), glyphs on
      hover (or always), 24×24 hit boxes, close/minimize/zoom all work.
- [ ] Open, close, minimize, restore, zoom an app; switcher (⌘-tab equivalent) still cycles.

### Wallpaper
- [ ] Change still wallpaper from Settings → Wallpaper (click a picture → dialog asks login screen
      or desktop → applied to the chosen one, survives reboot).
- [ ] Live wallpaper sets on desktop and login screen; the still stays drawn underneath.
- [ ] Pause reasons each hold: app window open (desktopCovered, default on), locked, fullscreen,
      covered, idle 5 min, CPU busy, low battery.
- [ ] Glass sliders (blur/transparency/saturation) apply live.

### Settings app
- [ ] Every section opens: General, Appearance, Wallpaper, Dock, Displays, Network, Bluetooth,
      Sound, Notifications, Printers, Clipboard, Sharing, Cloud, Language & Region, Date & Time,
      Keyboard, Trackpad, Default Apps, AI, Power/Energy, Cooling, Firmware (Pi5 only), Privacy,
      Users, Updates, Session.
- [ ] Sidebar search filters; the open section survives a language change.
- [ ] No raw `prefs.*`/`settings.*` keys visible on Energy or any other page (bug G watch line).

### Sound
- [ ] Settings → Sound → Sound Effects toggle gates every effect; master and per-event volumes work.
- [ ] Screenshot (save or copy) plays the shutter only after success.
- [ ] Plug/unplug power plays its notes; notification sound respects its toggle; startup chime plays.

### Battery
- [ ] Charge limit: on hardware without `charge_control_end_threshold` the dropdown rolls back with
      the honest reason; no silent write. (On supported hardware it persists across boot.)

### Core apps and plumbing
- [ ] Terminal opens, tabs/panes work; Files opens; text input works in a search field.
- [ ] A GTK app and a Qt app open as theme windows (Wayland); one X11 app through Xwayland.
- [ ] Log out returns to the greeter; session restore setting honored.
- [ ] Desktop widgets (out of scope, must not break): cards render, edit mode opens.

### Performance (bug A gate)
- [ ] Live session log has no `slow frame:` lines during ordinary use; if present, the breakdown
      names the cost and it is either fixed or ledgered in BUGS.md.
- [ ] Dock reveal/hover on the real hardware: no perceptible lag; `tp:` pointer rows stay ~0.1–0.3 ms.
