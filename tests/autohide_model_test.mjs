// autohide_model_test.mjs — walks sdk/autohidemodel.js, the pure auto-hide state machine the
// Dock and the menu bar share (bug C). Covers the brief's scenarios: the bare desktop never
// hides, a window open hides, the edge reveals, a held button ignores the reveal, re-entry
// cancels and restarts the hide (never stacks), an open popup blocks hiding, 500 random edge
// cycles keep one timer at a time, and 20 window open/close cycles end in the right state.
import { autohideNext, AH_HIDDEN, AH_REVEALING, AH_SHOWN, AH_HIDING } from '../sdk/autohidemodel.js';
import { menuBarPrefs, menuBarPatch } from '../sdk/menubarmodel.js';

let n = 0, bad = 0;
const ok = (cond, what) => { n++; if (!cond) { bad++; console.log(`✗ ${what}`); } };

// a step helper: returns { state, act }
const step = (s, ev, ctx) => autohideNext(s, ev, ctx);
const shown = (s, act) => s === AH_SHOWN && act === 'show';

// the bar's tri-state setting: the default, a saved mode, the first cut's boolean honored, a bogus
// value falling back, and a patch that keeps its siblings
ok(menuBarPrefs({}).autohideMode === 'apps', 'autohideMode defaults to apps');
ok(menuBarPrefs({ menuBar: { autohideMode: 'always' } }).autohideMode === 'always', 'a saved mode is honored');
ok(menuBarPrefs({ menuBar: { autohide: false } }).autohideMode === 'never', "the first cut's boolean false maps to never");
ok(menuBarPrefs({ menuBar: { autohide: true } }).autohideMode === 'apps', "the first cut's boolean true maps to apps");
ok(menuBarPrefs({ menuBar: { autohideMode: 'bogus' } }).autohideMode === 'apps', 'a bogus mode falls back');
const patch = menuBarPatch({ menuBar: { autohideMode: 'apps', bell: true } }, 'autohideMode', 'never');
ok(patch.menuBar.autohideMode === 'never' && patch.menuBar.bell === true, 'the patch keeps its siblings');

// 1. bare desktop (mayHide false): pointer roams, the surface never hides
let st = AH_SHOWN, act;
for (let i = 0; i < 50; i++) {
  ({ state: st } = step(st, 'pointerMove', { edge: i % 2 === 0, over: i % 3 === 0, buttonDown: false, mayHide: false, keepOpen: false }));
  ok(st === AH_SHOWN, `bare desktop: stays shown (round ${i})`);
}
ok(true, 'bare desktop never hides');

// 2. a window opens (cover, mayHide true): shown → hiding → fired → hidden
({ state: st, act } = step(AH_SHOWN, 'cover', { coverOn: true, over: false, keepOpen: false, mayHide: true }));
ok(st === AH_HIDING && act === 'armHide', 'window opens: starts hiding');
({ state: st, act } = step(st, 'timerFired', { mayHide: true, keepOpen: false, over: false }));
ok(st === AH_HIDDEN && act === 'hide', 'hide fires: hidden');

// 3. the edge reveals: hidden → revealing → fired → shown
({ state: st, act } = step(st, 'pointerMove', { edge: true, over: false, buttonDown: false, mayHide: true, keepOpen: false }));
ok(st === AH_REVEALING && act === 'armReveal', 'edge: starts revealing');
({ state: st, act } = step(st, 'timerFired', {}));
ok(shown(st, act), 'reveal fires: shown');

// 4. a held button ignores the reveal
({ state: st, act } = step(AH_HIDDEN, 'pointerMove', { edge: true, over: false, buttonDown: true, mayHide: true, keepOpen: false }));
ok(st === AH_HIDDEN && act === null, 'button held: the edge is ignored');

// 5. the pointer leaves mid-reveal: cancel, hidden
({ state: st, act } = step(AH_REVEALING, 'pointerMove', { edge: false, over: false, buttonDown: false, mayHide: true, keepOpen: false }));
ok(st === AH_HIDDEN && act === 'cancel', 'edge left mid-reveal: cancelled');

// 6. re-entering while hiding cancels the timer and shows (restart, never stack)
({ state: st } = step(AH_SHOWN, 'cover', { coverOn: true, over: false, keepOpen: false, mayHide: true }));
({ state: st, act } = step(st, 'pointerMove', { edge: true, over: true, buttonDown: false, mayHide: true, keepOpen: false }));
ok(shown(st, act), 're-entered while hiding: shown again, timer cancelled');

// 7. an open popup blocks hiding
({ state: st, act } = step(AH_SHOWN, 'pointerMove', { edge: false, over: false, buttonDown: false, mayHide: true, keepOpen: true }));
ok(st === AH_SHOWN, 'popup open: does not hide');

// 8. the hide fires while a popup opened meanwhile: stays shown
({ state: st } = step(AH_SHOWN, 'cover', { coverOn: true, over: false, keepOpen: false, mayHide: true }));
({ state: st, act } = step(st, 'timerFired', { mayHide: true, keepOpen: true, over: false }));
ok(st === AH_SHOWN && act === null, 'hide fired with a popup open: stays shown');

// 9. the reason to hide went away mid-hide: comes back
({ state: st } = step(AH_SHOWN, 'cover', { coverOn: true, over: false, keepOpen: false, mayHide: true }));
({ state: st, act } = step(st, 'cover', { coverOn: false, over: false, keepOpen: false, mayHide: false }));
ok(shown(st, act), 'windows all closed mid-hide: shown again');

// 10. mid-reveal, a window opens: the dock's own semantics — stop and stay hidden
({ state: st, act } = step(AH_REVEALING, 'cover', { coverOn: true, over: false, buttonDown: false, mayHide: true, keepOpen: false }));
ok(st === AH_HIDDEN && act === 'cancel', 'window opens mid-reveal: cancelled to hidden');

// 11. 500 random edge enter/leave cycles: always at most one timer, always a valid state
//     (the hook owns one timer; the model's act stream never arms twice without consuming)
const EVENTS = ['pointerMove', 'timerFired', 'cover', 'show'];
let timer = null;                                  // the model's own timer ledger
st = AH_HIDDEN;
let seeded = 7;
const rnd = () => (seeded = (seeded * 1103515245 + 12345) % 2147483648) / 2147483648;
for (let i = 0; i < 500; i++) {
  const ev = EVENTS[Math.floor(rnd() * (rnd() < 0.6 ? 2 : EVENTS.length))];
  const ctx = {
    edge: rnd() < 0.4, over: rnd() < 0.4, buttonDown: rnd() < 0.15,
    mayHide: rnd() < 0.6, keepOpen: rnd() < 0.15,
    coverOn: rnd() < 0.6,                            // cover carries its own new mayHide
  };
  const before = st;
  ({ state: st, act } = step(st, ev, ctx));
  // the timer ledger: arms set it, cancel/fired/show/hide consume it — never two arms in a row
  if (act === 'armReveal' || act === 'armHide') { ok(timer === null, `no stacked timer (cycle ${i}, ${before}+${ev})`); timer = act; }
  else if (act === 'cancel' || act === 'show' || act === 'hide' || ev === 'timerFired') timer = null;
  ok([AH_HIDDEN, AH_REVEALING, AH_SHOWN, AH_HIDING].includes(st), `valid state (cycle ${i})`);
}
ok(true, `500 random cycles survived (${bad === 0 ? 'no' : bad} violations so far)`);

// 12. 20 window open/close cycles: the bar ends shown when closed, hidden-ish when open
st = AH_SHOWN;
for (let i = 0; i < 20; i++) {
  ({ state: st } = step(st, 'cover', { coverOn: true, over: false, keepOpen: false, mayHide: true }));
  ok(st === AH_HIDING || st === AH_HIDDEN, `window open: hiding or hidden (round ${i})`);
  ({ state: st } = step(st, 'timerFired', { mayHide: true, keepOpen: false, over: false }));
  ok(st === AH_HIDDEN, `window open settled: hidden (round ${i})`);
  ({ state: st, act } = step(st, 'cover', { coverOn: false, over: false, keepOpen: false, mayHide: false }));
  ok(shown(st, act), `windows closed: shown again (round ${i})`);
}
ok(true, '20 open/close cycles: correct state each time');

console.log(`autohide model: ${n - bad}/${n} checks passed`);
process.exit(bad ? 1 : 0);
