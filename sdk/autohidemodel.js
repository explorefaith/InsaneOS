// autohidemodel.js — the pure state machine behind sdk/autohide.js (bug C): HIDDEN → REVEALING →
// SHOWN → HIDING → HIDDEN, one timer at a time. Pure on purpose: tests/autohide_model_test.mjs
// walks it in node (timer restart, no stacked timers, popup-open blocks hiding, button-held
// ignores the reveal, 500 random edge cycles), the React hook only maps its actions onto one
// setTimeout and one animation. The dock's original useAutohide semantics are the contract.
//
//   autohideNext(state, ev, ctx) → { state, act }
//     ev    'pointerMove' | 'timerFired' | 'cover' | 'show'
//     ctx   { edge, over, buttonDown, mayHide, keepOpen, coverOn }
//           edge/over: the pointer is in the reveal zone / on the surface now
//           buttonDown: a mouse button is held (dragging, selecting — the reveal trigger is ignored)
//           mayHide: the surface's reason to hide holds (an app window is open for the bar)
//           keepOpen: a menu or sheet of this surface is open (never hide)
//           coverOn: for 'cover', the new mayHide (a transition may show or start the hide)
//     act   'armReveal' | 'armHide' | 'cancel' | 'show' | 'hide' | null
//           exactly one timer at a time: armReveal/armHide follow a cancel in the hook, and the
//           model never returns two arms without the state that consumed the first.
//
// Feel lives in the callers (revealMs, hideMs, coverMs, the slide); the model only decides.
export const AH_HIDDEN = 'hidden';
export const AH_REVEALING = 'revealing';
export const AH_SHOWN = 'shown';
export const AH_HIDING = 'hiding';

export function autohideNext(state, ev, ctx) {
  switch (state) {
    case AH_HIDDEN:
      // the edge asks for the surface — unless a button is held (a drag near the edge must not
      // make it flicker)
      if (ev === 'pointerMove' && ctx.edge && !ctx.buttonDown) return { state: AH_REVEALING, act: 'armReveal' };
      if (ev === 'pointerMove' && ctx.edge && ctx.buttonDown) return { state, act: null };
      if (ev === 'pointerMove') return { state, act: null };
      // the reason to hide went away while hidden: come out (the dock's cover(false)) — straight
      // to shown, animating in; REVEALING is only the edge-held wait for the reveal delay
      if (ev === 'cover' && !ctx.coverOn) return { state: AH_SHOWN, act: 'show' };
      return { state, act: null };
    case AH_REVEALING:
      if (ev === 'timerFired') return { state: AH_SHOWN, act: 'show' };
      // the pointer left the edge before the reveal delay: cancel and stay hidden
      if (ev === 'pointerMove' && !ctx.edge) return { state: AH_HIDDEN, act: 'cancel' };
      // the reason to hide arrived mid-reveal: the dock stopped the timer and stayed hidden
      if (ev === 'cover' && ctx.coverOn) return { state: AH_HIDDEN, act: 'cancel' };
      if (ev === 'cover' && !ctx.coverOn) return { state: AH_SHOWN, act: 'show' };
      return { state, act: null };
    case AH_SHOWN:
      // the pointer left the surface: start the hide — unless something of the surface is open
      // or the surface may not hide right now (a fresh leave keeps no old timer: one at a time)
      if (ev === 'pointerMove' && !ctx.over && !ctx.keepOpen && ctx.mayHide) return { state: AH_HIDING, act: 'armHide' };
      if (ev === 'pointerMove' && (ctx.over || ctx.keepOpen || !ctx.mayHide)) return { state, act: 'cancel' };
      // the reason to hide arrived while shown (a window opened over a bare-desktop bar): hide
      if (ev === 'cover' && ctx.coverOn && !ctx.keepOpen && !ctx.over) return { state: AH_HIDING, act: 'armHide' };
      return { state, act: null };
    case AH_HIDING:
      // re-entering the surface or the edge cancels the hide and shows again (restart, not stack)
      if (ev === 'pointerMove' && (ctx.over || ctx.edge)) return { state: AH_SHOWN, act: 'show' };
      // the hide fired: it happens only if nothing blocks it at that moment
      if (ev === 'timerFired') {
        return (!ctx.mayHide || ctx.keepOpen || ctx.over) ? { state: AH_SHOWN, act: null } : { state: AH_HIDDEN, act: 'hide' };
      }
      // the reason to hide went away mid-hide: come back
      if (ev === 'cover' && !ctx.coverOn) return { state: AH_SHOWN, act: 'show' };
      return { state, act: null };
    default:
      return { state: AH_SHOWN, act: 'show' };
  }
}
