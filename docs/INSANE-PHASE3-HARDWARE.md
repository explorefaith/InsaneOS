# INSANE OS — Phase 3 hardware compatibility findings

What the hardware layer actually does, verified from the source and the shipped evidence, and
where the honest "not supported here" states live. The rule everywhere: a control whose hardware
path is absent is disabled with a note — never faked.

## Verified paths (evidence)

| Subsystem | Path | Evidence |
|---|---|---|
| Audio output/input | PipeWire state through insane-server (`sdk/sound.js` — soundState store, setVolume/setMute/setDefault/setPort); the CC's volume rides the sink's `level` | hwkeys.js uses the same fields; the vertical sliders (Phase 2) drive the same calls |
| Wi-Fi | insane-server (netlink) reads state; changes through the root helper's net-* actions (0600 socket) — scan, connect, enable/disable | apps/settings/Network.jsx; docs/NETWORK.md; server/src/net/wifi.c |
| Bluetooth | `insane.bt.state()` store + setBluetoothPower; pairing/connect through the adapter's agent | sdk/hardware.jsx; server/src/hw/bt.c (adapter.powered, devices[].connected — the fields the Phase-2 audit verified) |
| Brightness | the backlight list (`insane.display.list().backlight` → {name, value, max}) + the closed display-brightness action, 120 ms debounced | apps/settings/Displays.jsx:220-240; the CC's vertical slider rides the same action |
| Keyboard light | keyboardLight list + keyboard-light action | sdk/hwkeys.js:44 |
| Battery | the hardware thread's power.c fields (percent, charging, onAC, minutesLeft, hasBattery) | server/src/hw/power.c:137 (Phase-2 cross-check); the low-battery path gates the wallpaper pause |
| Power actions | reboot/poweroff through insane.session.power → sessiond (root, fixed argv systemctl); suspend: greeter-side with the idle-inhibit check, session-side via the closed power-suspend action | sdk/power.jsx:8; sessiond.c:719-732; hw_admin.c:164-169 |
| Sleep-before-lock | logind's delay inhibitor, released on RP_UNDISPLAY (the Phase-3 fix) | server/src/hw/sleeplock.c; mirror.c |
| Fan/cooling | the Cooling page reads the fans and can force 100 % (apps/monitor/Cooling.jsx); the fan curve is a real service | server/src/fan/fancurve.c |
| Voltage | the monitor's voltage thread (chips[].in[].v) — wants the source on | server/src/monitor/voltage.c (Phase-2's wantAndTake) |
| GPU | the monitor's gpu thread (cards[].busy, clients) — wants the source on; the compositor's GPU path falls back to CPU rendering | server/src/monitor/gpustat.c; docs/DISPLAYS.md's llvmpipe evidence |

## The honest-unsupported states (verified in the UI)

- No backlight → the brightness control disabled with `prefs.display.noBacklight` (Settings) and
  the CC slider's disabled note.
- No GPU decode → live wallpapers show still posters with the one-line reason
  (docs/WALLPAPERS.md's rule).
- No battery → the battery rows/widgets hide (hasBattery guard).
- No PSI (kernel without pressure) → the memory-pressure widget's quiet state (the −1 sentinel).
- No voltage chip / GPU → those widgets' quiet states.

## Untestable here (BLOCKED on real hardware)

Suspend/resume cycles, lid close, monitor hotplug, BT device pairing, Wi-Fi roaming — the
headless lab has no radios, battery, lid or second display. The code paths are traced and
evidence-quoted above; the live-desktop pass (docs/INSANE-PHASE3-TEST-RESULTS.md's manual list)
is the acceptance gate.
