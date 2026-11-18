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

## 7. VERIFIED WORKING (self-audit, evidence-quoted)

- **Process monitoring + safe termination** (brief §6): apps/monitor/Processes.jsx — Stop
  (SIGTERM) / Force Quit (SIGKILL) behind a confirmation sheet (StopSheet :231, confirm copy
  :254-255), signalled by insane-server for the user's own processes and via the root helper's
  proc-signal for others (admins only); both check the process start time so a reused PID is
  never hit, and both refuse the protected set (PID 1, kernel threads, the session, Insane OS's
  services, PipeWire) — the table marks them `prot`.
- **Power actions** (brief §7): reboot/poweroff through `insane.session.power(...)` → sessiond
  (root) — insane-server runs nothing itself (sdk/power.jsx:8); the ask state machine
  (ask/sent/denied/unavailable) surfaces admin denial honestly; suspend comes from the login
  screen and sessiond guards it with idle-inhibit (sessiond.c:720-723).
- **Notifications** (brief §8): sdk/notify.js carries prefs (dnd + schedule + per-app) and the
  seen history; the island bar tracks unread against `seen.current` (IslandStrip.jsx:100) — the
  notification center's history, per-app controls and DND exist.
- **Bounded restarts**: sessiond's boot-time test restarts at most a set number of boots, a
  login cancels the pending restart (sessiond.c:850-864) — no unbounded restart loop on the
  boot path.

## 8. WM/workspace audit (round 1 — agent report, 10 findings)

| ID | Sev | Finding | Status |
|---|---|---|---|
| W1 | P1 | js_wm_end drained promise jobs WITHOUT the interrupt budget — a runaway chain pending at drag end froze the compositor forever | FIXED (drain_jobs_armed exposed from js.c; make clean; C tests green except the documented imager pair) |
| W2 | P2 | Insane Flow had NO Super+arrows snapping and no drag-to-edge snap (snap: true never set; wm.snapKey dead; keygrab kept ❖arrows only for Classic) | FIXED (snap: true + the shortcuts entry + keygrab rows for both flow tables; keygrab_test ok) |
| W3 | P2 | Meta+Alt+B "reveal menu bar" ran a no-op (the top bar was removed; nothing subscribes) | FIXED (entry removed) |
| W4 | P2 | the whole Window-menu feature set (Move & Resize halves/quarters/thirds, wm.arrange, wm.center) was unreachable in Flow after the bar's removal | FIXED (the CSD window menu carries Center + the full Move & Resize submenu) |
| W5 | P2 | the JS maximized drag-out path clamped only the top — a maximized window could be dragged entirely off screen | FIXED (wm.move clamps every side to the pointer display with grab.c's 48 px keep) |
| W6 | P3 | KG_TAKE shortcuts fire over a fullscreen Linux app (acting on invisible windows) | PARTIAL: the snap handler gates on wayland.fullscreen(); the general wl.c policy (gating ❖1..9/⌥F4 over fullscreen, while keeping ⌃⇧Esc force-quit reachable) is a UX decision — ledgered, not changed |
| W7 | P3 | the CSD resize fallback (Linux windows via JS) had no upper clamps | FIXED (display-bounded, grab.c's rule) |
| W8 | P3 | the PiP frame could be dragged/resized off screen | FIXED (48 px keep within its display) |
| W9 | P3 | the Overview could open over an own-app fullscreen window (its cards unreachable under the floating layer) | FIXED (blocked() also checks own fullscreen on the active desktop) |
| W10 | P3 | F4 (launcher) and F12 (Terminal) silently die over Linux windows (not in the keygrab tables) | LEDGERED: adding F-keys to the grab tables changes their behavior inside Linux apps — needs a UX call |

Shortcut-conflict sweep (the agent's): no unintended conflicts; ❖`'s double role is deliberate and gated; Classic Overview's ❖Tab remap is handled on both sides; ❖+letters over Linux apps never double-fire.

VERIFIED WORKING (the agent's trace): drag (grab.c per-frame clamp), 8-edge resize, minimize/restore genie, maximize (dblclick + jitter guard), close guards, Classic's snap layouts + ❖arrows, center, fullscreen + Esc, PiP stickiness, focus/stacking per desktopmodel, Alt-Tab/❖Tab switcher (hold-open, digits, exclusions), workspaces (create/remove/switch/move/keyboard nav/indicator/rename/reorder, state saved, session restore), the shared Overview (grid, placeholders, drag to another desktop), hot corners.

## 9. Session/lock audit (round 1 — agent report, 9 findings)

The audit verified the whole login chain against the C (crypt_r on shadow, constant-time compare,
timing-equalized unknown accounts, escalating fail waits, per-user spawn flock, drop-privileges
exec of the root-owned binary, keyring root-only and wiped) and confirmed **lock = taking the
session off the monitor** (EVIOCREVOKE on every lent fd, left-framebuffer removal, DROP_MASTER,
text consoles blocked) — nothing to bypass.

| ID | Sev | Finding | Status |
|---|---|---|---|
| S1 | P1 | the AUTOLOGIN worker restarted unconditionally on every reap — a session that never came up spawned a full attempt forever; the success path re-lent the monitor indefinitely | FIXED (retries only before the first show, bounded at 3, 20 s apart; after that the login screen takes over) |
| S2 | P1 | a theme bundle that THROWS at boot returned −1 before the fallback/recovery paths — the greeter died and came back at a bounded rate forever = a permanent dark display; a session re-failed at every login | FIXED (all load failures now walk the fallback themes and the recovery screen; the error stays on the log) |
| S3 | P2 | a failed greeter lend left the display dark with nothing scheduled (the session-failure path re-showed the greeter; the greeter path didn't) | FIXED (greeter_retry_at +2 s) |
| S4 | P2 | a login worker killed without replying wedged the greeter's submit on busy forever | FIXED (a login_replied flag; the reap answers the generic error) |
| S5 | P2 | sleeplock_monitor_taken was dead code — the sleep inhibitor released after the 4 s hold, not on RP_UNDISPLAY (SESSIONS.md said otherwise) | FIXED (mirror.c's RP_UNDISPLAY calls it now) |
| S6 | P3 | lock/switch parsed by substring — any future field containing the word would take the monitor back | FIXED (the parsed field compared, like power/display) |
| S7 | P3 | an invalid username at the greeter answered busy ("another request in progress") | FIXED (answers fail) |
| S8 | P3 | no password visibility toggle on the login screen | FIXED (an eye beside the submit arrow; the field re-mounts with secure off) |
| S9 | P3 | the autologin failure loop spammed session-creation logs | FIXED (part of S1: one clear line per bounded retry) |

VERIFIED WORKING (the agent's trace): authentication entirely the system's own; login flow
end-to-end; the lock's monitor take-back; unlock as the normal login path; switch user keeps the
background session; logout through session.quit; shell-crash → the login screen returns (never a
blank display); shutdown/reboot with the admin ask state machine; suspend/resume wiring with
idle-inhibit and the done_sleep latch; autologin gated once per boot; greeter lifecycle (10 s
linger, stale-binary kill, rate-bounded crash restart); insaneos.service KillMode/Delegate;
no-display path; greeter i18n complete.

## Agent audit reports (round 1)

- WM/workspace agent: running.
- Session/lock agent: running.
- Shell/launcher agent: hit the session concurrency cap — re-dispatching after a slot frees.
- Display/hardware/performance agent: queued.
