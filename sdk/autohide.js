// autohide.js — the one edge-triggered auto-hide behavior, shared by the Dock and the menu bar
// (bug C: one component, no copy-paste). Born as the Dock's own useAutohide (themes/default/
// components/Dock.jsx) and lifted here unchanged in spirit; every number is a parameter so each
// surface keeps its own feel:
//
//   const slide = useAutohide({
//     enabled,                 // the user's master switch (the Dock's setting, the bar's own)
//     mayHide,                 // may it hide right now? (the Dock's 'overlap' needs a covering window;
//                              //   the bar hides only while an app window is on the desktop)
//     position,                // which display edge reveals it: 'top' | 'bottom' | 'left' | 'right'
//     areaRef,                 // the display's area { x, y, w, h } (the edge is measured against it)
//     rectRef,                 // the surface's own box { x0, y0, x1, y1 } (pointer-on-it keeps it)
//     keepOpen,                // a menu or sheet of it is open: never hide (a ref to truth is fine)
//     force,                   // show now (the Dock's context menu, the bar's menus)
//     revealMs, hideMs, slideMs, coverMs, over, edgePx,
//   });
//
// Returns slide 0 (hidden) … 1 (in view) and the same guarantees the Dock had: one timer and one
// rAF at a time (never stacked), the timer cancelled and restarted on re-entry, no hiding while
// the pointer is on the surface or something of its is open, and Reduce-Motion callers can pass
// slideMs 0 to jump. The reveal waits revealMs of edge presence; the leave waits hideMs.
import { useEffect, useRef, useState } from 'react';
import { addListener } from '@insaneos/runtime';

export function useAutohide({
  enabled, mayHide, position, areaRef, rectRef, keepOpen,
  force = false, covered = null,
  revealMs = 120, hideMs = 500, slideMs = 180, coverMs = 300, over = 8, edgePx = 2,
}) {
  const may = !!enabled && !!mayHide;                        // may it hide now
  const [p, setP] = useState(may ? 0 : 1);                   // 0 hidden … 1 in view
  const want = useRef(!may);
  const keep = useRef(keepOpen);
  keep.current = keepOpen;
  const mayH = useRef(may);
  mayH.current = may;
  const api = useRef(null);
  useEffect(() => {
    if (!enabled) { want.current = true; setP(1); return undefined; }
    want.current = !mayH.current;
    setP(want.current ? 1 : 0);
    let timer = 0, raf = 0, from = 0, t0 = 0, px = -1, py = -1;
    const animate = (to) => {
      cancelAnimationFrame(raf);
      t0 = performance.now();
      if (slideMs <= 0) { from = to; setP(to); return; }
      const step = (now) => {
        const k = Math.min(1, (now - t0) / slideMs), e = 1 - (1 - k) * (1 - k);
        setP(from + (to - from) * e);
        if (k < 1) raf = requestAnimationFrame(step);
        else from = to;
      };
      raf = requestAnimationFrame(step);
    };
    const set = (on) => {
      if (want.current === on) return;
      want.current = on;
      from = on ? 0 : 1;
      animate(on ? 1 : 0);
    };
    const stop = () => { if (timer) { clearTimeout(timer); timer = 0; } };
    const isOver = () => {
      const r = rectRef.current;
      return !!r && px >= r.x0 - over && px < r.x1 + over && py >= r.y0 - over && py < r.y1 + over;
    };
    // hides after ms unless, by then, the pointer is on it, a menu of it is open or it may not hide
    const hideSoon = (ms) => {
      if (!timer) timer = setTimeout(() => { timer = 0; if (!keep.current && mayH.current && !isOver()) set(false); }, ms);
    };
    api.current = {
      show: () => { stop(); set(true); },
      // the cover state changed (a window started or stopped covering the surface's reason to hide)
      cover: (on) => {
        stop();
        if (!on) set(true);
        else if (want.current && !keep.current && !isOver()) hideSoon(coverMs);
      },
    };
    const off = addListener('pointermove', (e) => {
      px = e.x; py = e.y;
      const A = areaRef.current;
      if (!A) return;
      const inX = e.x >= A.x && e.x < A.x + A.w, inY = e.y >= A.y && e.y < A.y + A.h;
      const edge = position === 'bottom' ? inX && e.y >= A.y + A.h - edgePx
        : position === 'left' ? inY && e.x <= A.x + (edgePx > 1 ? 1 : edgePx)
        : position === 'right' ? inY && e.x >= A.x + A.w - edgePx
        : inX && e.y <= A.y + (edgePx > 1 ? 1 : edgePx);      // 'top'
      if (!want.current) {
        if (edge && !timer) timer = setTimeout(() => { timer = 0; set(true); }, revealMs);
        else if (!edge) stop();
      } else if (!isOver() && !keep.current && mayH.current) hideSoon(hideMs);
      else stop();
    });
    return () => { off(); stop(); cancelAnimationFrame(raf); api.current = null; };
  }, [enabled, position]);
  useEffect(() => { if (force && enabled) api.current?.show(); }, [force, enabled]);
  useEffect(() => { if (enabled && covered != null) api.current?.cover(covered); }, [covered, enabled]);
  return p;
}
