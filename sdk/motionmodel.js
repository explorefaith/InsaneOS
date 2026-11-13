// motionmodel.js — the decisions behind moving wallpapers, with no screen (docs/WALLPAPERS.md; tests:
// server/tests/motion_model_test.mjs). Hardware only: the decode must be in hardware, and on the desktop
// the GPU must compose the session (the login screen composes headless and only asks hwCodecs).
// There is no software mode: anything else shows the still poster.

// Which formats this machine decodes in hardware. hw is insane.media.hwDecode(). The catalog ships
// HEVC and H.264; a machine that also decodes VP9 or AV1 in hardware can play those as wallpapers of
// the user's own (webm, mkv). This is the whole requirement on the login screen, whose compositor is
// headless: only the decode needs the hardware, the frame itself is a plain blit (docs/WALLPAPERS.md).
export function hwCodecs(hw) {
  const out = [];
  if (!hw || hw.virtualGpu) return out;
  if (hw.hevc) out.push('hevc');
  if (hw.h264) out.push('h264');
  if (hw.vp9) out.push('vp9');
  if (hw.av1) out.push('av1');
  return out;
}

// Which formats this machine can play on the desktop: the GPU composing the session, and the decode
// in hardware (the login screen's poll asks hwCodecs() directly).
export function motionCodecs(hw, composition) {
  if (composition !== 'gpu') return [];
  return hwCodecs(hw);
}

// The variant to play on a screen: HEVC before H.264, then the smallest that covers the screen. Screens above the
// file's size use its largest. A format this machine doesn't decode in hardware is never chosen.
export function pickVariant(item, codecs, width, height) {
  for (const c of codecs) {
    const list = (item.variants || []).filter((v) => v.codec === c).sort((a, b) => a.w - b.w);
    if (!list.length) continue;
    return list.find((v) => v.w >= width && v.h >= height) || list[list.length - 1];
  }
  return null;
}

// Why the video should be paused now, or null. Each is a reason not to spend power on something nobody sees.
// The user's switches (Settings → Wallpaper → Live → Pause when) can turn the optional ones off: desktopCovered
// (any application window in view — the "Automatic Wallpaper Pause" switch), fullscreen, covered, locked
// (the session is not the one on the monitor), idle, battery and busy. Reduce motion, a screen that is off
// and memory pressure are not optional: they are accessibility and physics.
// The switches compose: desktopCovered off + covered on = pause only when a window covers every display;
// desktopCovered on (the default) makes covered unreachable — the desktop is hidden by the first window.
export function pauseReason({ screenOff, reduceMotion, pressure, idleSec, idleMax = 300, battery, covered, fullscreen, busy, locked, desktopCovered, pauseWhen }) {
  const w = pauseWhen || {};
  if (reduceMotion) return 'reduceMotion';
  if (screenOff) return 'screenOff';
  if (pressure) return 'pressure';
  if (locked && w.locked !== false) return 'locked';
  if (fullscreen && w.fullscreen !== false) return 'fullscreen';      // the more specific state reports
  if (desktopCovered && w.desktopCovered !== false) return 'desktopCovered';
  if (covered && w.covered !== false) return 'covered';
  if (idleSec >= idleMax && w.idle !== false) return 'idle';
  if (battery && battery.discharging && battery.percent <= 20 && w.battery !== false) return 'battery';
  if (busy && w.busy !== false) return 'busy';
  return null;
}

// Memory pressure: the wallpaper is the first decoder to stop, and the last thing to restart.
// sample comes from insane.system.pressure() ({ some10, some60, availKB }): the PSI memory "some"
// percentages and MemAvailable, the same signals the background freezer acts on. It stops when the
// system has been meaningfully stalled (some60 ≥ 25 %), or during a burst (some10 ≥ 40 %) with less
// than 400 MB free, and comes back only when it is clearly over (some60 < 15 and 800 MB free) — a
// memory storm must not flicker it on and off, and a pause costs nothing (the still image stays).
// Non-optional, like a screen that is off. Returns { on, state } with the caller's hysteresis state.
export const PRESSURE = { some60: 25, some10: 40, availMB: 400, resume60: 15, resumeMB: 800 };
export function memoryPressure({ some10 = 0, some60 = 0, availKB = Infinity } = {}, state = {}) {
  const hot = state.hot || 0;
  if (hot) {
    if (some60 < PRESSURE.resume60 && availKB >= PRESSURE.resumeMB * 1024) return { on: false, state: { hot: 0 } };
    return { on: true, state: { hot: 1 } };
  }
  const on = some60 >= PRESSURE.some60 || (some10 >= PRESSURE.some10 && availKB < PRESSURE.availMB * 1024);
  return { on, state: { hot: on ? 1 : 0 } };
}

// Is the desktop hidden behind applications? A normal application window counts: in the view
// (this active desktop — desktopmodel.FIRST_DESKTOP is the default for a window that never named
// one), not minimized, not picture-in-picture (a floating video never hides the desktop), and not
// fullscreen (its own reason governs that, so the user's "Fullscreen" switch keeps meaning
// something on its own). Shell surfaces — the Dock, Control Center, Spotlight, notification
// banners, the desktop's own context menu — are not windows in the wm store and never count:
// overlays must not pause the wallpaper (round 4, State E).
export function appsOpen(windows, active) {
  return windows.some((w) => !w.minimized && !w.pip && !w.fullscreen && (w.desktop ?? 1) === (active ?? 1));
}

// Is this display's desktop fully hidden by a window? rects: the windows on it, not minimized.
export function displayCovered(display, rects) {
  return rects.some((r) => r.x <= display.x && r.y <= display.y && r.x + r.w >= display.x + display.w && r.y + r.h >= display.y + display.h);
}

// An added video: a format this machine plays in hardware. No length limit — a long file loops from
// its start, and the decode cost is per frame, not per second of source — but it must be readable.
export function userVideoProblem(info, codecs) {
  if (!info || !info.duration) return 'unreadable';
  const c = String(info.codec || '').toLowerCase();
  const fmt = c === 'hevc' || c === 'h265' ? 'hevc' : c === 'h264' || c === 'avc' ? 'h264'
    : c === 'vp9' ? 'vp9' : c === 'av1' ? 'av1' : '';
  return codecs.includes(fmt) ? null : 'format';
}

// A file that will cost more than a wallpaper needs: above 1080p, or above 30 fps. A warning,
// not a refusal — it plays if the format decodes in hardware; 1080p 30 fps is what a moving
// wallpaper needs, and that is what the message recommends. The probe answers the raw shape
// ({streams: […]}) or a flat {codec, width…}: both are read here.
export function heavyVideoWarning(info) {
  const v = info && (info.streams || []).find((s) => s.type === 'video') || info || {};
  if ((v.width || 0) > 1920 || (v.height || 0) > 1080) return 'big';
  if ((v.fps || 0) > 30) return 'fps';
  return null;
}

// Random: a different one from the last, among those on disk.
export function nextRandom(ids, last, pick = Math.random) {
  const list = ids.filter((i) => i !== last);
  if (!list.length) return ids[0] || null;
  return list[Math.floor(pick() * list.length) % list.length];
}

// The wallpaper's adaptive frame cap (sdk/quality.js resolves the profile's top; docs/WALLPAPERS.md).
// The cap steps down a rung as soon as the system stays loaded or the decoder drops what it decodes,
// and climbs back one rung only after STEADY_MS of being clear — a burst lowers it for the burst,
// and a recovery never flickers it around. One call a tick (5 s in sdk/motion.jsx). state is the
// caller's { level, good }; the answer carries the next one. A cap of 0 means no cap.
export const CAP_STEADY_MS = 15000;

export function adaptiveCap(cap, { busy, dropRatio }, state, now) {
  if (!cap) return { cap, state: { level: 0, good: 0 } };
  const half = Math.max(12, Math.round(cap / 2));
  const ladder = cap <= half || cap <= 10 ? [cap] : half <= 10 ? [cap, half] : [cap, half, 10];
  const st = { level: state?.level ?? 0, good: state?.good ?? 0 };
  if (st.level >= ladder.length) st.level = ladder.length - 1;
  const bad = !!busy || dropRatio >= 0.5;
  if (bad) st.good = 0;
  else if (!st.good) st.good = now;
  const want = bad ? Math.min(ladder.length - 1, st.level + 1)
    : st.good && now - st.good >= CAP_STEADY_MS ? Math.max(0, st.level - 1) : st.level;
  if (want !== st.level) {
    st.level = want;
    if (!bad) st.good = now;                            // the next rung needs as long again
  }
  return { cap: ladder[st.level], state: st };
}
