// paneglyph_test.mjs — every sidebar section id must have a drawn PaneGlyph (bug E round, part F):
// a missing glyph silently falls back to the four-square grid, which is how seven sections ended
// up identical. The test reads the source as text (the components are JSX; node runs only models)
// and fails when a GROUPS id resolves to no glyph.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// the glyph keys from apps/settings/ui.jsx (the PaneGlyph map's `key: () =>` cases)
const ui = read('apps/settings/ui.jsx');
const glyphKeys = new Set([...ui.matchAll(/(^|\n)\s{4}(\w+): \(\) =>/gm)].map((m) => m[2]));
ok(glyphKeys.size >= 25, `the PaneGlyph set has ${glyphKeys.size} glyphs`);

// the sidebar's section ids from apps/settings/index.jsx (the GROUPS quadruples) — plus the
// GLYPH_OF bridge where an id and a glyph name differ
const idx = read('apps/settings/index.jsx');
const block = idx.slice(idx.indexOf('const GROUPS = ['), idx.indexOf('const SECTIONS ='));
const ids = [...block.matchAll(/\['(\w+)', \w+, '#[0-9a-f]{6}'\]/g)].map((m) => m[1]);
ok(ids.length >= 26, `the sidebar lists ${ids.length} sections`);

const bridgeSrc = idx.slice(idx.indexOf('const GLYPH_OF'), idx.indexOf('const SECTIONS ='));
const bridge = Object.fromEntries([...bridgeSrc.matchAll(/(\w+): '(\w+)',/g)].map((m) => [m[1], m[2]]));

let bad = 0;
for (const id of ids) {
  const g = bridge[id] || id;
  if (!glyphKeys.has(g)) { console.log(`✗ section "${id}" has no PaneGlyph (tried "${g}")`); bad++; }
}
// the bridge itself must point at real glyphs
for (const [id, g] of Object.entries(bridge)) {
  if (!glyphKeys.has(g) && ids.includes(id)) { console.log(`✗ bridge "${id}" → missing glyph "${g}"`); bad++; }
}

// the widgets glyph exists (the new one from this round)
ok(glyphKeys.has('widgets'), 'the Widgets section has its own glyph');

function ok(cond, what) { if (!cond) { console.log(`✗ ${what}`); process.exitCode = 1; } else console.log(`✓ ${what}`); }
console.log(`paneglyph: ${bad === 0 ? 'every sidebar section has its glyph' : bad + ' problems'}`);
process.exit(bad ? 1 : 0);
