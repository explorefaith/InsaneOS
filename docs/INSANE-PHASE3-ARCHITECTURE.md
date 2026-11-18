# INSANE OS — Phase 3 architecture findings (desktop environment, hardware, reliability)

The Phase-3 audit ledger's architecture half. Everything here is read from the code and the
shipped docs (WINDOWS.md, DESKTOPS.md, DISPLAYS.md, SESSIONS.md, NETWORK.md, SOUND.md, DOCK.md),
not assumed. Statuses follow the brief: DISCOVERED → INVESTIGATING → FIXING → FIXED → TESTING →
VERIFIED → BLOCKED.

## 1. Window manager & workspaces (pre-audit findings from the docs)

- **The display architecture is a custom Wayland compositor** (`insane-server`, C) — not X11, not
  a stock WM. Windows are logical-px rectangles the compositor lays out and paints (CPU or GPU
  path); themes draw the frames in React.
- **Workspaces/desktops are a complete, tested system** (docs/DESKTOPS.md): 1–9 desktops, one
  logical space across all displays, `sdk/desktopmodel.js` (pure rules +
  `server/tests/desktop_model_test.mjs`), per-desktop windows, PiP sticky across desktops,
  fullscreen belongs to a desktop, hidden-desktop apps stay mounted (`display: none`) so editor
  state survives, saved count/names, an indicator, an animation, keyboard switching.
- **The Overview is shared** (`sdk/overview.jsx`) between both themes; Insane Classic's task view
  was replaced by it.
- Windows open on the desktop in view; `wm.focus`/`wm.open` jump desktops; `wm.raise` stays.
- Pending audit: snapping corners, always-on-top, center-window, rename UI, shortcut conflicts —
  the WM audit agent is walking the code.

## 2. Displays & GPU

- **Multi-display is one logical space, per-display scale** (100–300 % in 25 % steps, text
  rasterized at native resolution; mixed-DPI verified with screenshots in docs/DISPLAYS.md on two
  virtio-gpu heads, CPU and GPU paths).
- Extend + mirror (each display rendered, not copied — a big mirror stays sharp); arrangement
  saved by EDID identity (connector appended for identical panels); rotation per display; hotplug
  moves the unplugged display's windows back (docs/DISPLAYS.md "unplugged" evidence).
- GTK/Linux apps ride fractional-scale-v1 + viewporter (verified at 150 %).
- GPU path: EGL surfaces per display on one context (llvmpipe-verified); the compositor falls
  back to CPU rendering — the wallpaper system's rule ("a moving wallpaper only with GPU
  composition") shows the probing is real, not assumed.
- Settings → Displays: resolution, scale, rotation, primary, arrangement (drag), mirror, per-
  display brightness (backlight list through the closed display-brightness action; the honest
  no-backlight state).

## 3. Sessions, login, lock

- **insane-sessiond (root) owns the card and input**; the login screen runs as `insaneos-greeter`
  with no admin helper and no access to homes; authentication is the system's (shadow read by
  sessiond) — the shell never touches passwords.
- **Locking really takes the session off the monitor** (monitor.c lend/revoke): not an overlay —
  a hung session cannot block the greeter, and the greeter keeps working.
- Recovery: the session manager falls back when a theme fails to load (the 5cbac9b6 lesson:
  a theme crash at boot fell back to the previous bundle and the log named the throw).
- Pending audit: bounded restart policies on the boot units, suspend/resume wiring.

## 4. Performance monitoring

- The C monitor thread (server/src/monitor/) publishes ready-made JSON (sample, processes,
  connections, disk temps, voltage, gpu, network history) only while a view wants it
  (`mon_want*`), sleeping when nobody looks — the widgets' want-flags ride the same valves.
- apps/monitor renders per-core CPU, processes (with termination), connections; the Control
  Center meters read the same sample.

## 5. Hardware

- Wi-Fi/BT through netd (root, a closed admin action list, 0600 socket); audio state from
  PipeWire via insane-server; brightness through the backlight list + display-brightness action;
  battery through the hardware thread (power.c fields verified in Phase 2).
- Phase 2 already made the honest-unsupported rule real in UI: no backlight → disabled control
  with a note; no GPU decode → posters instead of videos; no sensor → quiet widget states.

## 6. Notifications & services

- sdk/notify.js: preferences (dnd + schedule + per-app), history (seen), banners, sounds;
  the CC's DND toggle writes the same key.
- Boot units under tools/boot/systemd/ — the pending audit checks restart policies.

## Agent audit reports (round 1)

- WM/workspace agent: running.
- Session/lock agent: running.
- Shell/launcher agent: hit the session concurrency cap — re-dispatching after a slot frees.
- Display/hardware/performance agent: queued.
