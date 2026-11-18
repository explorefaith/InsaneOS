// autohide.js — the one edge-triggered auto-hide behavior, shared by the Dock and the menu bar
// (bug C): one component, no copy-paste. Born as the Dock's own useAutohide and lifted here; the
// DECISIONS live in sdk/autohidemodel.js (pure — tests/autohide_model_test.mjs walks them: the
// bare desktop never hides, the edge reveals, a held button ignores the reveal, re-entry cancels
// and restarts the single timer, an open menu blocks hiding), and this hook only maps the model's
// actions onto one setTimeout and one animation. The model is the contract; the feel is here:
//
//   const slide = useAutohide({
//     enabled,                 // the user's master switch (false: always shown, no listeners)
//     mayHide,                 // the surface's reason to hide (an app window is open, for the bar)
//     position,                // which display edge reveals it: 'top' | 'bottom' | 'left' | 'right'
//     areaRef,                 // the display's area { x, y, w, h } (the edge is measured against it)
//     rectRef,                 // the surface's own box { x0, y0, x1, y1 } (pointer-on-it keeps it)
//     keepOpen,                // a menu or sheet of it is open (never hide)
//     force,                   // show now (the Dock's context menu, the bar's keyboard focus)
//     revealMs, hideMs, slideMs, coverMs, over, edgePx,
//   });
//
// Returns slide 0 (hidden) … 1 (in view). Reduce Motion jumps the slide. The blur governor is a
// compositor-side per-frame matter — a slide moves nodes and never bypasses it.
import { useEffect, useRef, useState } from 'react';
import { addListener } from '@insaneos/runtime';
import { autohideNext, AH_SHOWN } from './autohidemodel.js';
import { reducedMotionNow } from './animation.js';

export function useAutohide({
  enabled, mayHide, position, areaRef, rectRef, keepOpen,
  force = false, covered = null,
  revealMs = 120, hideMs = 500, slideMs = 180, coverMs = 300, over = 8, edgePx = 2,
}) {
  const may = !!enabled && !!mayHide;                        // may it hide now
  const [p, setP] = useState(may ? 0 : 1);                   // 0 hidden … 1 in view
  const state = useRef(may ? 'hidden' : 'shown');
  const keep = useRef(keepOpen);
  keep.current = keepOpen;
  const mayH = useRef(may);
  mayH.current = may;
  const overRef = useRef(false);
  const buttonDown = useRef(false);
  const api = useRef(null);
  useEffect(() => {
    if (!enabled) { state.current = 'shown'; setP(1); return undefined; }
    state.current = mayH.current ? 'hidden' : 'shown';
    setP(state.current === 'hidden' ? 0 : 1);
    let timer = 0, raf = 0, from = 0, t0 = 0, px = -1, py = -1;
    const animate = (to) => {
      cancelAnimationFrame(raf);
      if (reducedMotionNow() || slideMs <= 0) { from = to; setP(to); return; }
      t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / slideMs), e = 1 - (1 - k) * (1 - k);
        setP(from + (to - from) * e);
        if (k < 1) raf = requestAnimationFrame(step);
        else from = to;
      };
      raf = requestAnimationFrame(step);
    };
    const acts = {
      armReveal: () => { clearTimeout(timer); timer = setTimeout(() => { timer = 0; dispatch('timerFired'); }, revealMs); },
      armHide: () => { clearTimeout(timer); timer = setTimeout(() => { timer = 0; dispatch('timerFired'); }, hideMs); },
      cancel: () => clearTimeout(timer),
      show: () => { clearTimeout(timer); animate(1); },
      hide: () => { clearTimeout(timer); animate(0); },
    };
    const ctx = (coverOn) => ({ edge: edgeNow(), over: overRef.current, buttonDown: buttonDown.current,
      mayHide: mayH.current, keepOpen: keep.current, coverOn: coverOn === undefined ? mayH.current : coverOn });
    const edgeNow = () => {
      const A = areaRef.current;
      if (!A) return false;
      const inX = px >= A.x && px < A.x + A.w, inY = py >= A.y && py < A.y + A.h;
      const e = position === 'bottom' ? inX && py >= A.y + A.h - edgePx
        : position === 'left' ? inY && px <= A.x + (edgePx > 1 ? 1 : edgePx)
        : position === 'right' ? inY && px >= A.x + A.w - edgePx
        : inX && py <= A.y + (edgePx > 1 ? 1 : edgePx);       // 'top'
      return !!e;
    };
    const dispatch = (ev, coverOn) => {
      const { state: next, act } = autohideNext(state.current, ev, ctx(coverOn));
      state.current = next;
      overRef.current = ev === 'pointerMove' ? isOver() : overRef.current;
      if (act) acts[act]();
    };
    const stop = () => { clearTimeout(timer); timer = 0; };
    const isOver = () => {
      const r = rectRef.current;
      return !!r && px >= r.x0 - over && px < r.x1 + over && py >= r.y0 - over && py < r.y1 + over;
    };
    api.current = {
      show: () => dispatch('show'),
      cover: (on) => dispatch('cover', on),
    };
    const down = addListener('pointerdown', () => { buttonDown.current = true; });
    const up = addListener('pointerup', () => { buttonDown.current = false; });
    const off = addListener('pointermove', (e) => {
      px = e.x; py = e.y;
      overRef.current = isOver();
      dispatch('pointerMove');
    });
    return () => { down(); up(); off(); clearTimeout(timer); cancelAnimationFrame(raf); api.current = null; };
  }, [enabled, position]);
  useEffect(() => { if (force && enabled) api.current?.show(); }, [force, enabled]);
  useEffect(() => { if (enabled) api.current?.cover(may); }, [may, enabled]);
  return p;
}
