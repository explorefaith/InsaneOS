// backdrop.jsx — what a desktop, and the login screen, draw behind everything (docs/WALLPAPERS.md).
//
// One component for every source so the Settings preview, the desktop and the greeter show the same thing:
// a solid colour or a gradient (settings "wallpaperBg"/"loginBg"), or a still picture with the chosen fit
// mode. The live wallpaper is a layer of its own (sdk/motion.jsx MotionWallpaper) drawn over this — a
// failure there just leaves what is here, so no config error is ever a black screen.
//
// A change of wallpaper crossfades (450 ms quick, 1200 ms cinematic — the setting): the previous layer stays on top, fading out, while the new
// one is already there underneath. Reduce motion jumps straight to the new one.
import { createElement as h, useEffect, useRef, useState } from 'react';
import { Image, View } from '@insaneos/runtime';
import { settings } from './settings.js';
import { wallpaperSrc } from './wallpapers.js';

// The crossfade's length: the setting (Settings → Wallpaper → Wallpaper transition) — quick, the
// measured reference's pace, or cinematic, the reference recording's slower burn (1.2 s).
const fadeMs = () => {
  try { return settings.get().wallpaperFade === 'cinematic' ? 1200 : 450; } catch (e) { return 450; }
};

// The user's fit mode → the engine's objectFit (server/src/ui/style.c E_FIT: fill, cover, contain, center).
export const fitOf = (mode) => ({ fill: 'cover', fit: 'contain', stretch: 'fill', center: 'center' }[mode] || 'cover');

// A "wallpaperBg"/"loginBg" choice → node style. hex: '#rrggbb'; angle in degrees (0 = to top).
export function bgStyle(bg, opacity = 1) {
  if (!bg || !bg.a) return null;
  const base = opacity >= 1 ? {} : { opacity };
  if (bg.kind === 'gradient' && bg.b) return { ...base, background: `linear-gradient(${Math.round(+bg.angle || 180)}deg, ${bg.a}, ${bg.b})` };
  return { ...base, backgroundColor: bg.a };
}

// The background itself. displays: [{ id, x, y, w, h, scale }] (the desktop's own rects; the greeter and
// the Settings preview pass one box). wallpaper: the resolved still wallpaper (findWallpaper), null with a
// colour. bg: the solid/gradient choice, null for a picture. fit: 'fill'|'fit'|'stretch'|'center'.
export function Backdrop({ wallpaper, bg, fit, displays, onContextMenu, opacity = 1 }) {
  const reduce = !!settings.get().reduceMotion;
  const key = bg ? `bg:${bg.kind}:${bg.a}:${bg.b}:${Math.round(+bg.angle || 0)}` : `img:${(wallpaper && wallpaper.id) || ''}:${fitOf(fit)}`;
  const [fade, setFade] = useState(null);       // { wallpaper, bg, fit, p } the previous layer, fading 1 → 0
  const last = useRef(null);
  useEffect(() => {
    const before = last.current;
    last.current = { key, wallpaper, bg, fit };
    if (!before || before.key === key || reduce) { setFade(null); return undefined; }
    const t0 = performance.now();
    setFade({ wallpaper: before.wallpaper, bg: before.bg, fit: before.fit, p: 0 });
    const iv = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / fadeMs());
      if (p >= 1) { clearInterval(iv); setFade(null); return; }
      setFade((f) => (f ? { ...f, p } : f));
    }, 16);
    return () => clearInterval(iv);
  }, [key, reduce]);
  const layer = (what, alpha, dim) => displays.map((d) => {
    const st = { position: 'absolute', left: d.x, top: d.y, width: d.w, height: d.h, overflow: 'hidden' };
    if (alpha < 1) st.opacity = alpha;
    const style = bgStyle(what.bg, alpha);
    if (style) return h(View, { key: `${dim}:${d.id}:${d.x}`, style: { ...st, ...style }, onContextMenu });
    return h(Image, { key: `${dim}:${d.id}:${d.x}`, src: wallpaperSrc(what.wallpaper, d.w * (d.scale || 100) / 100, d.h * (d.scale || 100) / 100),
      onContextMenu, style: { ...st, objectFit: fitOf(what.fit) } });
  });
  const out = fade ? layer({ wallpaper: fade.wallpaper, bg: fade.bg, fit: fade.fit }, 1 - fade.p, 'old') : null;
  return [...layer({ wallpaper, bg, fit }, opacity, 'new'), ...(out || [])];
}
