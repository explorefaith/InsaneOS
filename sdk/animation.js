// animation.js — every duration and curve of the desktop's motion, in one place (docs/DESIGN.md).
// The theme and the SDK read these; nothing else hardcodes a millisecond of animation. The engine
// has no CSS transitions (themes/README.md), so every animation is a JS ramp — useTween is the one
// rAF loop they all share, and it honors Reduce Motion by itself.
//
// The curves below were measured frame-by-frame off the desktop's motion reference (the Shell Ninja
// Hyprland recording, 26 696 frames at 30 fps, ~/.cache/arch-ref-frames): a window rises from below
// and fades in over ~8 frames (250 ms) with a fast-out settle, the settings' active pill morphs
// between rows in 4–6 frames (150–200 ms) with a slight overshoot, and the reference's own settings
// page names the curve it applies — "elegant_bounce", P1 (0.35, 1.38), P2 (0.24, 1.02) — which
// bezier() reproduces exactly.

import { useEffect, useRef, useState } from 'react';
import { settings } from './settings.js';

export const DUR = {
  open: 250,          // a window rises from below and fades in (measured: ~8 frames)
  close: 170,         // a window leaves faster than it came (the reference's 2× out speed)
  minimize: 420,      // the genie: the window's strips fly into its Dock icon
  restore: 360,       // …and back out of it, a little quicker than in
  bounce: 1100,      // a Dock icon's launch hop (two hops, damped)
  dockSlide: 180,     // the Dock sliding away and back (auto-hide)
  reorder: 150,       // Dock neighbours making room for a dragged icon
  poof: 320,          // the «poof» when an icon is removed
  hover: 120,         // a control's hover/press feedback
  panel: 200,         // a panel, menu or popover appearing
  fade: 150,          // overlays, scrims, scrollbars
  toggle: 160,        // a Toggle's knob travelling
  banner: 240,        // a notification banner sliding in
  pill: 180,          // the settings' active pill morphing between rows (measured: 4–6 frames)
  page: 170,          // a settings page's content settling after a switch
};

// Easings. t is 0..1; each returns 0..1.
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const easeIn = (t) => t * t;
// A soft settle for things that arrive from a distance (banners, panels): fast out, gentle stop.
export const easeOutBack = (t) => { const c = 1.2; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };

// A cubic Bézier easing, as the compositor reference defines its curves: two control points plus
// the fixed ends (0,0) and (1,1). x is solved numerically (Newton, then a bisection guard), y comes
// from the Bézier at that parameter — the same shape a CSS cubic-bezier() or Hyprland's
// bezier = …, P1, P2 would draw. Values outside 0..1 on y overshoot and come back (a bounce).
export function bezier(p1x, p1y, p2x, p2y) {
  // x(t) = 3(1-t)²t·p1x + 3(1-t)t²·p2x + t³;  y(t) = 3(1-t)²t·p1y + 3(1-t)t²·p2y + t³
  const bx = (t) => 3 * (1 - t) * (1 - t) * t * p1x + 3 * (1 - t) * t * t * p2x + t * t * t;
  const by = (t) => 3 * (1 - t) * (1 - t) * t * p1y + 3 * (1 - t) * t * t * p2y + t * t * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;                       // Newton first, bisection as the net
    for (let i = 0; i < 8; i++) {
      const e = bx(t) - x;
      if (Math.abs(e) < 1e-5) return by(t);
      const dx = (bx(t + 1e-4) - bx(t - 1e-4)) / 2e-4;
      if (Math.abs(dx) < 1e-6) break;
      const nt = t - e / dx;
      if (nt <= lo || nt >= hi) break;
      t = nt;
    }
    while (hi - lo > 1e-5) { const m = (lo + hi) / 2; if (bx(m) < x) lo = m; else hi = m; }
    return by((lo + hi) / 2);
  };
}

// The reference's own curve ("elegant_bounce", P1 (0.35, 1.38), P2 (0.24, 1.02)): a fast rise that
// overshoots ~12 % and settles — the desktop's signature for things that land (pills, panels, windows).
export const easeElegantBounce = bezier(0.35, 1.38, 0.24, 1.02);

// The genie's per-strip progress: the bottom of the window leads, the top follows, each strip
// easing in-out; lead is how much later the top starts (0..1 of the whole animation).
export function genieStrip(p, v, lead = 0.42) {
  const start = lead * (1 - v);
  const q = Math.max(0, Math.min(1, (p - start) / (1 - start)));
  return easeInOut(q);
}

// Reduce Motion (Settings → Appearance): the setting exists on every theme; components that don't
// already hold the settings object read it here.
export const reducedMotionNow = () => { try { return !!settings.get().reduceMotion; } catch (e) { return false; } };

// The engine provides requestAnimationFrame; node (the scenes, the tests) does not: there a 16 ms
// timeout keeps the same shape. Exported for the one other continuous animation in the SDK
// (the Spinner's dots); every one-shot ramp goes through useTween instead.
export const nextFrame = typeof requestAnimationFrame === 'function'
  ? requestAnimationFrame : (fn) => setTimeout(() => fn(performance.now()), 16);
export const cancelFrame = typeof cancelAnimationFrame === 'function'
  ? cancelAnimationFrame : clearTimeout;

// One shared rAF ramp for a numeric value. With `from` it animates on mount too (an entrance:
// useTween(1, { from: 0 })); otherwise it sits at `target` until the target moves. It re-renders at
// most once a frame while it moves. Reduce Motion (or dur <= 0, or reduce: true) jumps straight to
// the target. Example:
//   const lift = useTween(hovered ? 1 : 0, { dur: DUR.hover });
//   <View style={{ opacity: 0.85 + 0.15 * lift, transform: [{ translateY: -2 * lift }] }}>
export function useTween(target, { from = null, dur = DUR.panel, ease = easeOutCubic, reduce } = {}) {
  const [v, setV] = useState(from != null && from !== target ? from : target);
  const at = useRef(from != null && from !== target ? from : target);
  const raf = useRef(0);
  useEffect(() => {
    const jump = reduce ?? reducedMotionNow();
    if (jump || dur <= 0 || at.current === target) {
      if (raf.current) cancelFrame(raf.current);
      at.current = target;
      setV(target);
      return undefined;
    }
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const val = at.current + (target - at.current) * ease(p);
      at.current = val;
      setV(val);
      if (p < 1) raf.current = nextFrame(step);
    };
    raf.current = nextFrame(step);
    return () => { if (raf.current) cancelFrame(raf.current); };
  }, [target, dur, reduce]);
  return v;
}
