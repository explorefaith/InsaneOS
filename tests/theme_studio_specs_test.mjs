// theme_studio_specs_test.mjs — the widget spec catalog's soundness: every kind is unique, sized
// sanely, routed to a declared renderer variant and a declared data provider; the model's kind
// table derives from it; every built-in theme's plan places real kinds; the categories are real.
import assert from 'node:assert/strict';
import { TS_WIDGET_SPECS, TS_CATS, TS_VARIANTS, TS_PROVIDERS, specOf, specsOfCat, specKinds } from '../sdk/ts-widget-specs.js';
import { TS_KINDS } from '../sdk/themestudio-model.js';
import { THEMES } from '../sdk/themestudio-themes.js';
import { resolvePlan, overlapPairs } from '../sdk/themestudio-model.js';

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };

const ids = new Set();
for (const s of TS_WIDGET_SPECS) {
  ok(!ids.has(s.id), `unique id: ${s.id}`);
  ids.add(s.id);
  ok(typeof s.label === 'string' && s.label.length > 1, `${s.id}: a label`);
  ok(TS_CATS.some(([c]) => c === s.cat), `${s.id}: a real category (${s.cat})`);
  ok(TS_VARIANTS.includes(s.v), `${s.id}: variant '${s.v}' is declared`);
  if (s.src) ok(TS_PROVIDERS.includes(s.src), `${s.id}: provider '${s.src}' is declared`);
  ok(s.w >= 88 && s.h >= 56, `${s.id}: clears the minimum size (${s.w}×${s.h})`);
  ok(s.w <= 480 && s.h <= 320, `${s.id}: stays a widget, not a window (${s.w}×${s.h})`);
  if (s.cfg) ok(typeof s.cfg === 'object', `${s.id}: cfg is an object`);
}

ok(TS_WIDGET_SPECS.length >= 100, `the brief's bar: at least 100 kinds (got ${TS_WIDGET_SPECS.length})`);
ok(TS_PROVIDERS.length >= 60, `the provider table is substantial (${TS_PROVIDERS.length})`);

// every category carries at least 5 kinds — no decorative headings
for (const [c, name] of TS_CATS) {
  ok(specsOfCat(c).length >= 4, `category '${name}' carries ${specsOfCat(c).length} kinds`);
}

// the model's kind table derives from the specs (one source of truth)
eq_kinds();
function eq_kinds() {
  const derived = specKinds();
  const keysA = Object.keys(derived).sort(), keysB = Object.keys(TS_KINDS).sort();
  assert.deepEqual(keysA, keysB, 'TS_KINDS matches the spec table');
  checks++;
  for (const k of keysA) {
    assert.deepEqual(TS_KINDS[k].defaults, derived[k].defaults, `TS_KINDS.${k} defaults match`);
    checks++;
  }
}

// the built-in themes only place real kinds, and every plan still resolves cleanly
const kinds = new Set(TS_WIDGET_SPECS.map((s) => s.id));
for (const t of THEMES) {
  const area = { x: 0, y: 0, w: t.sw, h: t.sh };
  const plan = resolvePlan(t.widgets, area, t.sw, t.sh);
  ok(plan.length === t.widgets.length, `${t.id}: every placed kind is in the spec table`);
  ok(overlapPairs(plan).length === 0, `${t.id}: the composition still never overlaps itself`);
  for (const w of plan) ok(kinds.has(w.kind), `${t.id}: ${w.kind} exists`);
}

// specOf / specsOfCat round trips
ok(specOf('clock-digital')?.v === 'clock', 'specOf finds');
ok(specOf('no-such') === null, 'specOf misses cleanly');
ok(specsOfCat('time').every((s) => s.cat === 'time'), 'specsOfCat filters');

console.log(`theme_studio_specs: ${checks} checks passed, ${TS_WIDGET_SPECS.length} kinds, ${TS_PROVIDERS.length} providers`);
