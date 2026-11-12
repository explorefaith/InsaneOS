// motionmodel.js — the decisions behind moving wallpapers, with no screen (docs/WALLPAPERS.md; tests:
// server/tests/motion_model_test.mjs). Hardware only: a moving wallpaper needs the GPU composing the session and
// hardware decoding of the file's format. There is no software mode: anything else shows the still poster.

// Which formats this machine can play. hw is insane.media.hwDecode(); composition insane.media.composition().
// The catalog ships HEVC and H.264; a machine that also decodes VP9 or AV1 in hardware can play those as
// wallpapers of the user's own (webm, mkv).
export function motionCodecs(hw, composition) {
  if (composition !== 'gpu' || !hw || hw.virtualGpu) return [];
  const out = [];
  if (hw.hevc) out.push('hevc');
  if (hw.h264) out.push('h264');
  if (hw.vp9) out.push('vp9');
  if (hw.av1) out.push('av1');
  return out;
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
// The user's switches (Settings → Wallpaper → Live → Pause when) can turn the optional ones off: fullscreen,
// covered, locked (the session is not the one on the monitor), idle, battery and busy. Reduce motion and a
// screen that is off are not optional: they are accessibility and physics.
export function pauseReason({ screenOff, reduceMotion, idleSec, idleMax = 300, battery, covered, fullscreen, busy, locked, pauseWhen }) {
  const w = pauseWhen || {};
  if (reduceMotion) return 'reduceMotion';
  if (screenOff) return 'screenOff';
  if (locked && w.locked !== false) return 'locked';
  if (fullscreen && w.fullscreen !== false) return 'fullscreen';
  if (covered && w.covered !== false) return 'covered';
  if (idleSec >= idleMax && w.idle !== false) return 'idle';
  if (battery && battery.discharging && battery.percent <= 20 && w.battery !== false) return 'battery';
  if (busy && w.busy !== false) return 'busy';
  return null;
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
