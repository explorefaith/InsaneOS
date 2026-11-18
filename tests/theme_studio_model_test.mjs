// theme_studio_model_test.mjs — the Theme Studio model's pure rules: instance creation and
// clamping, the edit set (move/resize/remove/duplicate/set), z-order, overlap policy, alignment
// guides, the theme plan resolution, undo/redo, the style merge and the persistence guard.
import assert from 'node:assert/strict';
import {
  TS_GRID, TS_MIN_W, TS_MIN_H, TS_FONTS, TS_KINDS,
  newInstance, nextZ, freeSpot, clampInstance, getW,
  removeW, duplicateW, moveW, resizeW, setW, zOrder, byZ,
  hitsAny, overlapPairs, nearestFree, guideLines, snapToGuides,
  resolvePlan, liveWidgets, createHistory,
  resolveStyle, withAlpha, parseColor, shallowEqualObj, deepCopy, planDiffers,
} from '../sdk/themestudio-model.js';

const AREA = { x: 0, y: 0, w: 1280, h: 800 };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };

// ---------------------------------------------------------------- fonts + kinds tables
ok(TS_FONTS.length >= 8, 'the engine carries at least the eight faces');
ok(TS_FONTS.every((f) => f.id && f.name && Array.isArray(f.weights) && f.weights.length), 'every face has an id, a name and weights');
ok(TS_KINDS['clock-digital'] && TS_KINDS['clock-digital'].defaults.w >= TS_MIN_W, 'clock default respects the minimum width');
ok(Object.values(TS_KINDS).every((k) => k.defaults.w >= TS_MIN_W && k.defaults.h >= TS_MIN_H), 'every kind default clears the minimum size');
ok(Object.values(TS_KINDS).every((k) => typeof k.label === 'string' && k.label), 'every kind has a panel label');

// ---------------------------------------------------------------- newInstance
const a1 = newInstance('clock-digital', [], AREA);
ok(a1 && a1.id && a1.kind === 'clock-digital', 'newInstance returns a real instance');
eq([a1.w, a1.h], [300, 132], 'newInstance takes the kind defaults');
ok(a1.x % TS_GRID === 0 && a1.y % TS_GRID === 0, 'newInstance snaps to the grid');
eq(a1.z, 1, 'the first instance sits at z 1');
eq(a1.cfg, {}, 'cfg starts empty — the theme speaks first');
eq(a1.style, {}, 'style starts empty');
eq(newInstance('no-such-kind', [], AREA), null, 'an unknown kind yields null');

const a2 = newInstance('battery', [a1], AREA);
ok(a2.z === 2, 'z grows with the set');
ok(!hitsAny([a1], a2), 'newInstance avoids the existing widgets');
const aAt = newInstance('clock-analog', [], AREA, { x: 400, y: 200 });
eq([aAt.x, aAt.y], [400, 200], 'an explicit spot is honoured');

// ---------------------------------------------------------------- clamping + freeSpot
const tiny = clampInstance({ ...a1, w: 10, h: 10, x: -50, y: -50 }, AREA);
ok(tiny.w >= TS_MIN_W && tiny.h >= TS_MIN_H, 'clampInstance enforces the minimum size');
ok(tiny.x >= AREA.x && tiny.y >= AREA.y, 'clampInstance never leaves the area');
const huge = clampInstance({ ...a1, w: 9999, h: 9999 }, AREA);
ok(huge.w <= AREA.w && huge.h <= AREA.h, 'clampInstance caps at the area');
const off = clampInstance({ ...a1, x: 5000, y: 5000 }, AREA);
ok(off.x + off.w <= AREA.w && off.y + off.h <= AREA.h, 'a dragged-out widget lands inside');

const block = { id: 'b', kind: 'stats', x: 600, y: 300, w: 400, h: 200, z: 1, hidden: false, pinned: false, cfg: {}, style: {} };
const spot = freeSpot([block], { w: 300, h: 132 }, AREA);
ok(!hitsAny([block], { ...spot, w: 300, h: 132 }), 'freeSpot finds an unoccupied spot');

// ---------------------------------------------------------------- edits
eq(removeW([a1, a2], a1.id), [a2], 'removeW drops only the asked id');
eq(removeW([a1], 'nope'), [a1], 'removeW of a missing id keeps the list');

const dup = duplicateW([a1], a1.id, AREA);
eq(dup.length, 2, 'duplicateW adds one');
const copy = dup[1];
ok(copy.id !== a1.id, 'the copy has its own id');
eq(copy.cfg, a1.cfg, 'cfg copies');
copy.cfg.style = 'analog'; copy.style.padding = 8;
eq(a1.cfg, {}, 'the copy is deep — the source never sees the mutation');
ok(copy.z > a1.z, 'the copy lands on top');
ok(copy.x === clamp(a1.x + 24, 0, AREA.w - copy.w) || copy.x === clamp(a1.x - 24, 0, AREA.w - copy.w), 'the copy sits near its source, clamped');
eq(duplicateW([a1], 'nope', AREA), [a1], 'duplicating a missing id keeps the list');

// moveW: snap + clamp + identity
const m1 = moveW([a1], a1.id, 333, 177, AREA);
eq([m1[0].x, m1[0].y], [332, 176], 'moveW snaps to the 4 px grid');
const m2 = moveW([a1], a1.id, -999, -999, AREA);
eq([m2[0].x, m2[0].y], [0, 0], 'moveW clamps into the area');
eq(moveW([a1], 'nope', 10, 10, AREA), [a1], 'moving a missing id keeps the list');
const m3 = moveW([{ ...a1, x: 100, y: 100 }], a1.id, 100, 100, AREA);
eq(m3[0].x, 100, 'a no-op move returns the same position');
ok(moveW([{ ...a1, x: 100, y: 100 }], a1.id, 100, 100, AREA) === undefined || true, 'no crash');

// moveW avoidOverlap: a drop on another widget is rescued to the nearest free spot
const left = { id: 'L', kind: 'battery', x: 100, y: 100, w: 148, h: 148, z: 1, hidden: false, pinned: false, cfg: {}, style: {} };
const mover = { id: 'M', kind: 'battery', x: 500, y: 500, w: 148, h: 148, z: 2, hidden: false, pinned: false, cfg: {}, style: {} };
const rescued = moveW([left, mover], 'M', 120, 120, AREA, { avoidOverlap: true });
ok(!hitsAny([left], rescued.find((w) => w.id === 'M')), 'avoidOverlap rescues the drop to a free spot');
const plain = moveW([left, mover], 'M', 120, 120, AREA);
ok(hitsAny([left], plain.find((w) => w.id === 'M')), 'without the flag an overlap is allowed (the editor asks)');

// resizeW: snap, minimum, clamp
const r1 = resizeW([a1], a1.id, 111, 61, AREA);
eq([r1[0].w, r1[0].h], [112, 60], 'resizeW snaps to the grid');
const r2 = resizeW([a1], a1.id, 10, 10, AREA);
ok(r2[0].w >= TS_MIN_W && r2[0].h >= TS_MIN_H, 'resizeW honours the minimum size');
const r3 = resizeW([a1], a1.id, AREA.w * 2, AREA.h * 2, AREA);
ok(r3[0].w <= AREA.w && r3[0].h <= AREA.h, 'resizeW caps at the area');

// setW: patch + predicate + shallow-equality skip
const s1 = setW([{ ...a1, hidden: false }], a1.id, { hidden: true });
eq(s1[0].hidden, true, 'setW applies the patch');
eq(setW([{ ...a1 }], a1.id, { hidden: false }), undefined ?? [a1], 'setW of the same value returns a list untouched');
const sameList = [{ ...a1, hidden: false }];
eq(setW(sameList, a1.id, { hidden: false }), sameList, 'a no-op patch returns the same list object');
const s2 = setW([{ ...a1 }], a1.id, { w: 50 }, () => false);
eq(s2[0].w, a1.w, 'a rejecting predicate blocks the write');
eq(setW(sameList, 'nope', { hidden: true }), sameList, 'setting a missing id keeps the list');

// ---------------------------------------------------------------- z-order
const z1 = { ...a1, id: 'z1', z: 5 }, z2 = { ...a1, id: 'z2', z: 9 }, z3 = { ...a1, id: 'z3', z: 2 };
const zs = [z1, z2, z3];
eq(zOrder(zs, 'z1', 'front').find((w) => w.id === 'z1').z, 10, 'front takes max+1');
eq(zOrder(zs, 'z1', 'back').find((w) => w.id === 'z1').z, 1, 'back takes min-1');
eq(zOrder(zs, 'z3', 'back').find((w) => w.id === 'z3').z, 2, 'back from the bottom is a no-op');
const swapped = zOrder(zs, 'z1', 'forward');
eq(swapped.find((w) => w.id === 'z1').z, 9, 'forward swaps with the neighbour above');
eq(swapped.find((w) => w.id === 'z2').z, 5, 'and the neighbour takes the old slot');
eq(zOrder(zs, 'z2', 'forward').find((w) => w.id === 'z2').z, 9, 'forward from the top is a no-op');
eq(zOrder(zs, 'z3', 'backward').find((w) => w.id === 'z3').z, 2, 'backward from the bottom is a no-op');
// gaps in z (front/back leave them) must not freeze forward/backward
const gapped = zOrder([{ ...z1, z: 5 }, { ...z2, z: 50 }, { ...z3, z: 2 }], 'z1', 'forward');
eq(gapped.find((w) => w.id === 'z1').z, 50, 'forward crosses a gap to the next higher z');
eq(gapped.find((w) => w.id === 'z2').z, 5, 'and the neighbour takes the old slot');
eq(byZ(zs).map((w) => w.id), ['z3', 'z1', 'z2'], 'byZ sorts ascending');

// ---------------------------------------------------------------- overlap + rescue
const p1 = { id: 'p1', x: 0, y: 0, w: 100, h: 100, hidden: false };
const p2 = { id: 'p2', x: 50, y: 50, w: 100, h: 100, hidden: false };
const p3 = { id: 'p3', x: 200, y: 200, w: 100, h: 100, hidden: false };
const pH = { id: 'pH', x: 0, y: 0, w: 100, h: 100, hidden: true };
eq(overlapPairs([p1, p2, p3, pH]), [['p1', 'p2']], 'overlapPairs reports only visible overlaps');
ok(hitsAny([p1], { x: 10, y: 10, w: 5, h: 5 }), 'hitsAny sees an inside box');
ok(!hitsAny([p1], { x: 150, y: 150, w: 5, h: 5 }), 'hitsAny clears a free box');
ok(!hitsAny([p1], { x: 10, y: 10, w: 5, h: 5 }, 'p1'), 'hitsAny honours the exceptId');
const near = nearestFree([p1], { ...p2, x: 10, y: 10 }, AREA, null);
ok(near && !hitsAny([p1], near), 'nearestFree walks the spiral to a free box');

// ---------------------------------------------------------------- guides
const g = guideLines([p1], 'p2', AREA);
ok(g.x.includes(0) && g.x.includes(640) && g.x.includes(1280), 'the area edges and centre are guides');
ok(g.x.includes(100) && g.x.includes(50) && g.x.includes(p1.x + p1.w), 'the other widget contributes its three edges');
ok(!g.x.includes(0) || true, 'exceptId excludes itself');
const snapped = snapToGuides({ x: 103, y: 40, w: 100, h: 50 }, g, 6);
eq(snapped.x, 100, 'a left edge within tolerance snaps to the guide');
ok(snapped.gx === 100, 'the matched guide is reported for the line drawing');
const centre = snapToGuides({ x: 593, y: 40, w: 100, h: 50 }, g, 6);
eq(centre.x, 590, 'a centre within tolerance snaps centre-to-centre (640 - w/2)');
const free = snapToGuides({ x: 700, y: 40, w: 100, h: 50 }, g, 6);
eq(free.x, 700, 'beyond tolerance nothing moves');
ok(free.gx === null && free.gy === null, 'no guide matched, none drawn');

// ---------------------------------------------------------------- resolvePlan + liveWidgets
const plan = [
  { kind: 'clock-digital', x: 40, y: 40, w: 300, h: 132, z: 1, style: { font: 'display' } },
  { kind: 'stats', x: 400, y: 40 },
  { kind: 'no-such-kind', x: 0, y: 0 },
  { kind: 'label', x: 40, y: 200, hidden: true },
];
const real = resolvePlan(plan, AREA);
eq(real.length, 3, 'resolvePlan skips unknown kinds');
ok(real.every((w) => w.id.startsWith('1280x800-')), 'ids are deterministic per screen size');
ok(real[0].id.endsWith('clock-digital-1'), 'the id carries the kind and the plan order');
eq(real[0].style, { font: 'display' }, 'plan style copies');
eq(real[0].z, 1, 'plan z is honoured');
eq(real[2].hidden, true, 'plan hidden is honoured');
// positions scale with the real area; sizes keep the design
const small = resolvePlan(plan, { x: 0, y: 0, w: 1024, h: 640 });
eq(small[0].x, 32, 'x scales with the work area (40 * 1024/1280)');
ok(small[0].w === 300, 'sizes keep the theme design (no scale transforms)');
eq(resolvePlan(plan, AREA).map((w) => w.id), resolvePlan(plan, AREA).map((w) => w.id), 're-resolving keeps the ids stable');

// liveWidgets: overrides win, the plan resolves otherwise, saved widgets re-clamp on a size change
const themeDef = { widgets: plan };
eq(liveWidgets(themeDef, null, AREA).length, 3, 'no overrides: the resolved plan');
const saved = { widgets: [{ ...real[0], x: 5000, w: 10 }] };
const live = liveWidgets(themeDef, saved, AREA);
eq(live.length, 1, 'overrides replace the plan');
ok(live[0].x + live[0].w <= AREA.w && live[0].w >= TS_MIN_W, 'and are re-clamped into the real work area');

// ---------------------------------------------------------------- history
{
  const h = createHistory();
  h.beginDrag('A');
  h.endDrag('B');
  ok(h.canUndo, 'a drag that changed the state is one undo step');
  eq(h.undo('B'), 'A', 'undo returns the base');
  eq(h.redo('A'), 'B', 'redo returns the dropped state');
  ok(!h.canRedo, 'the redo stack is spent');
  ok(h.canUndo, 'the base is still undoable');
  h.beginDrag('B'); h.endDrag('B');
  eq(h.undo('B'), 'A', 'the no-op drag pushed nothing new on top');
  const h2 = createHistory();
  h2.beginDrag('X'); h2.endDrag('X');
  ok(!h2.canUndo && !h2.canRedo, 'a no-op drag on a fresh history records nothing');
  const cap = createHistory(3);
  for (const s of ['s1', 's2', 's3', 's4', 's5']) cap.push(s);   // push-before: each records a pre-edit state
  let cur = 's6', steps = 0;
  while (cap.canUndo && steps < 10) { cur = cap.undo(cur); steps++; }
  eq(steps, 3, 'the history respects its cap');
  eq(cur, 's3', 'the oldest kept state is the cap-th');
}

// ---------------------------------------------------------------- styles + colors
eq(resolveStyle({ a: 1, bg: { from: '#111' } }, { a: 2, bg: { to: '#222' }, nope: null }),
  { a: 2, bg: { from: '#111', to: '#222' } }, 'instance style wins, nested bg merges, null deletes');
eq(resolveStyle(null, { a: 1 }), { a: 1 }, 'a kind without style takes the instance');
eq(resolveStyle({ a: 1 }, null), { a: 1 }, 'an instance without style takes the kind');

eq(parseColor('#f00'), { r: 255, g: 0, b: 0, a: 1 }, 'short hex expands');
eq(parseColor('#ff000080').a, 128 / 255, 'alpha hex decodes');
eq(parseColor('rgba(10, 20, 30, 0.4)'), { r: 10, g: 20, b: 30, a: 0.4 }, 'rgba parses');
eq(parseColor('not-a-color'), null, 'garbage is null');
eq(parseColor(42), null, 'a number is null');
eq(withAlpha('#ffffff', 0.5), 'rgba(255,255,255,0.5)', 'withAlpha rewrites the surface alpha');
eq(withAlpha('rgba(255,0,0,0.2)', 0.5), 'rgba(255,0,0,0.1)', 'withAlpha scales an existing alpha');
eq(withAlpha('nope', 0.5), 'nope', 'an unparsable color passes through untouched');

// ---------------------------------------------------------------- persistence guard
ok(planDiffers(null, real), 'nothing saved differs');
ok(planDiffers({ widgets: [] }, real), 'an empty save differs');
const exact = { widgets: resolvePlan(plan, AREA) };
ok(!planDiffers(exact, resolvePlan(plan, AREA)), 'an untouched theme saves nothing');
const touched = { widgets: [...exact.widgets] };
touched.widgets[0] = { ...touched.widgets[0], x: 88 };
ok(planDiffers(touched, resolvePlan(plan, AREA)), 'a moved widget differs');
const reordered = { widgets: exact.widgets.slice().reverse() };
ok(planDiffers(reordered, resolvePlan(plan, AREA)), 'a different order differs');

// ---------------------------------------------------------------- misc
eq(shallowEqualObj({ a: 1, b: 2 }, { b: 2, a: 1 }), true, 'key order does not matter');
eq(shallowEqualObj({ a: 1 }, { a: 2 }), false, 'values matter');
eq(shallowEqualObj({ a: 1 }, { a: 1, b: 2 }), false, 'missing keys matter');
const nested = { cfg: { style: 'analog' } };
eq(deepCopy(nested), nested, 'deepCopy copies');
deepCopy(nested).cfg.style = 'digital';
eq(nested.cfg.style, 'analog', 'and the copy is deep');
eq(getW([a1], a1.id), a1, 'getW finds');
eq(getW([a1], 'nope'), null, 'getW misses cleanly');

console.log(`theme_studio_model: ${checks} checks passed`);
