// widget_model_test.mjs — the desktop widgets' layout (sdk/widgetmodel.js): the catalog, the
// clamp against the work area (the Dock's strip included), the free-spot search, add/move/resize,
// and loading a saved layout (junk dropped, ids continue from the saved ones).
import { WIDGET_CATALOG, catalogOf, clampWidget, freeSpot, loadWidgets, addWidget, removeWidget, moveWidget, resizeWidget, getWidget, widgetLayout, widgetsEditing } from '../../sdk/widgetmodel.js';

let ok = 0, bad = 0;
const eq = (name, a, b) => {
  if (JSON.stringify(a) === JSON.stringify(b)) ok++;
  else { bad++; console.error(`FAIL ${name}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); }
};

// the catalog: every entry well-formed, types unique
eq('catalog has the five first widgets', WIDGET_CATALOG.length, 5);
eq('types unique', new Set(WIDGET_CATALOG.map((c) => c.type)).size, 5);
eq('every entry has a size', WIDGET_CATALOG.every((c) => c.w >= 120 && c.h >= 80 && Number.isFinite(c.w) && Number.isFinite(c.h)), true);
eq('clock known', !!catalogOf('insane-clock'), true);
eq('unknown type', catalogOf('nope'), null);

const AREA = { x: 0, y: 30, w: 1920, h: 1000 };     // the menu bar's strip already excluded

// clamp: inside, snapped to the grid, sizes bounded
eq('clamp keeps inside', clampWidget({ x: -50, y: -50, w: 300, h: 132 }, AREA), { x: 0, y: 32, w: 300, h: 132 });
eq('clamp right edge', clampWidget({ x: 1900, y: 900, w: 300, h: 132 }, AREA).x, 1620);
eq('clamp snaps', clampWidget({ x: 61, y: 63, w: 300, h: 132 }, AREA).x, 60);
eq('clamp bounds the size', clampWidget({ x: 0, y: 0, w: 4000, h: 4000 }, AREA).w, 560);

// free spot: the first is where the widgets always lived (right side), the second steps aside
loadWidgets(null);
const a1 = addWidget('insane-clock', AREA);
eq('first add on the right', a1.x > AREA.w - 500, true);
const a2 = addWidget('insane-clock', AREA);
eq('second add does not overlap', hits(a1, a2), false, );
function hits(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }

// move and resize: clamped, and the id lookup works
moveWidget(a1.id, 10, 40, AREA);
eq('move applied (snapped)', getWidget(a1.id).x, 12);   // 10 snaps to 12
resizeWidget(a1.id, 400, 0, AREA);
eq('resize bounded at the cap', getWidget(a1.id).w, 560);   // 300 + 400 → the 560 cap

// remove
removeWidget(a2.id);
eq('removed', getWidget(a2.id), null);
eq('the other stays', getWidget(a1.id).type, 'insane-clock');

// load a saved layout: junk out, ids continue past the saved ones
loadWidgets([
  { type: 'insane-clock', id: 7, x: 100, y: 100, w: 300, h: 132 },
  { type: 'nope', id: 8, x: 0, y: 0, w: 100, h: 100 },               // unknown: dropped
  { type: 'insane-stats', id: 'x', x: 'left', y: 0, w: 300, h: 158 }, // bad coords: dropped
]);
eq('saved good kept', getWidget(7).y, 100);
eq('junk dropped', widgetLayout.get().length, 1);
const a3 = addWidget('insane-battery', AREA);
eq('ids continue past saved', a3.id, 8);
eq('editing starts off', widgetsEditing.get(), false);
eq('unknown add refused', addWidget('nope', AREA), null);

console.log(`widget-model-test: ${ok} ok, ${bad} failed`);
process.exitCode = bad ? 1 : 0;
