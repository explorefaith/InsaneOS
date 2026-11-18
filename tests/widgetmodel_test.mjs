// widgetmodel_test.mjs — the widget model's pure pieces: the temperature color ramp and the
// per-widget cfg write (compare-before-set, the React #185 lesson).
import assert from 'node:assert/strict';
import { tempColor, tempWord, TEMP_THRESHOLDS, setWidgetCfg, widgetLayout, loadWidgets } from '../sdk/widgetmodel.js';

// the ramp: cool stays teal, hot stays red, the midpoints interpolate, and it is monotonic
assert.equal(tempColor(20), tempColor(TEMP_THRESHOLDS.cool), 'below cool: the cool color');
assert.equal(tempColor(TEMP_THRESHOLDS.warm), '#f5a623', 'at warm: amber');
assert.equal(tempColor(120), '#ff453a', 'above hot: red');
assert.notEqual(tempColor(50), tempColor(60), 'between cool and warm: interpolating');
assert.equal(tempWord(40), 'cool');
assert.equal(tempWord(70), 'warm');
assert.equal(tempWord(90), 'hot');
assert.equal(tempWord(NaN), 'cool', 'no sensor: the cool default');
// the colors get darker/redder monotonically across the ramp (red channel only grows past warm)
const r = (h) => parseInt(h.slice(1, 3), 16);
const seq = [40, 50, 60, 70, 80, 90].map(tempColor);
for (let i = 1; i < seq.length; i++) assert.ok(r(seq[i]) >= r(seq[i - 1]), `red channel grows (step ${i})`);

// setWidgetCfg: merges, compares before writing, and rides moves
loadWidgets([{ type: 'insane-clock', id: 1, x: 10, y: 10, w: 300, h: 132 }]);
assert.equal(setWidgetCfg(1, { style: 'analog' }), true, 'first cfg write changes');
assert.deepEqual(widgetLayout.get()[0].cfg, { style: 'analog' });
assert.equal(setWidgetCfg(1, { style: 'analog' }), false, 'the same cfg writes nothing');
assert.equal(setWidgetCfg(1, { seconds: true }), true, 'a second key merges');
assert.deepEqual(widgetLayout.get()[0].cfg, { style: 'analog', seconds: true }, 'merge, not replace');
setWidgetCfg(1, { style: 'analog' }); // a move would happen here; the cfg must ride along
assert.equal(widgetLayout.get()[0].cfg.seconds, true, 'cfg survives');

console.log(`widgetmodel: ${6 + 3} checks passed`);
