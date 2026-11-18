// theme_studio_themes_test.mjs — the built-in catalog's soundness: every theme resolves, every
// plan stays inside its design space without overlapping itself, every wallpaper id exists in the
// shipped catalog, every font/kind/accent is real. The catalog is a design document; this test is
// what keeps it honest.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { THEMES } from '../sdk/themestudio-themes.js';
import { TS_KINDS, TS_FONTS, resolvePlan, overlapPairs } from '../sdk/themestudio-model.js';

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };

// The wallpapers that exist (assets/wallpapers/index.json) — the only ids a theme may reference.
const catalog = JSON.parse(fs.readFileSync(new URL('../assets/wallpapers/index.json', import.meta.url), 'utf8'));
const wallpaperIds = new Set(catalog.map((e) => e.id));

ok(THEMES.length >= 25, `the brief's minimum: at least 25 themes (got ${THEMES.length})`);
const ids = new Set();
for (const t of THEMES) {
  ok(!ids.has(t.id), `unique id: ${t.id}`);
  ids.add(t.id);
  ok(typeof t.name === 'string' && t.name.length > 1, `${t.id}: a name`);
  ok(typeof t.desc === 'string' && t.desc.length > 10 && t.desc.length < 140, `${t.id}: a one-line description`);
  ok(Array.isArray(t.colors) && t.colors.length === 3 && t.colors.every((c) => /^#[0-9a-f]{6}$/i.test(c)), `${t.id}: three colour swatches`);
  ok(t.appearance && (t.mode = t.appearance.mode, t.appearance.mode === 'dark' || t.appearance.mode === 'light'), `${t.id}: a mode`);
  // the accent: a hex (tone-mapped at apply time) or the auto sample
  ok(t.appearance.accent === 'auto' || /^#[0-9a-f]{6}$/i.test(t.appearance.accent), `${t.id}: a hex or auto accent`);
  // the wallpaper: a catalog id, or a solid/gradient background instead of a picture
  if (t.appearance.wallpaper) {
    ok(wallpaperIds.has(t.appearance.wallpaper), `${t.id}: wallpaper '${t.appearance.wallpaper}' exists in the catalog`);
  } else {
    ok(t.appearance.wallpaperBg && /^#[0-9a-f]{6}$/i.test(t.appearance.wallpaperBg.a || ''), `${t.id}: no picture — a wallpaperBg stands in`);
  }
  ok(t.sw === 1280 && t.sh === 720, `${t.id}: the design space is declared`);
  ok(Array.isArray(t.widgets) && t.widgets.length >= 8, `${t.id}: a real composition (${(t.widgets || []).length} widgets)`);
  ok(t.style && TS_FONTS.some((f) => f.id === t.style.font), `${t.id}: the theme font '${t.style.font}' is a face the engine carries`);

  // the resolved plan: inside the design space, no overlaps, z sequential, kinds and cfgs valid
  const area = { x: 0, y: 0, w: t.sw, h: t.sh };
  const plan = resolvePlan(t.widgets, area, t.sw, t.sh);
  ok(plan.length === t.widgets.length, `${t.id}: every plan entry is a known kind`);
  const seen = new Set();
  for (const w of plan) {
    ok(w.x >= area.x && w.y >= area.y && w.x + w.w <= area.x + area.w && w.y + w.h <= area.y + area.h,
      `${t.id}: ${w.kind} (${w.id}) stays inside the design space [${w.x},${w.y} ${w.w}×${w.h}]`);
    ok(!seen.has(w.id), `${t.id}: deterministic ids are unique (${w.id})`);
    seen.add(w.id);
    if (w.kind === 'label' || w.kind === 'headline' || w.kind === 'quote') {
      ok(typeof w.cfg.text === 'string' && w.cfg.text.length > 2, `${t.id}: ${w.kind} carries its text`);
    }
    const st = { ...(t.style || {}), ...(w.style || {}) };
    if (st.size !== undefined) ok(st.size >= 12 && st.size <= 120, `${t.id}: ${w.kind}'s type size is sane`);
    if (st.alpha !== undefined) ok(st.alpha >= 0.15 && st.alpha <= 1, `${t.id}: ${w.kind}'s alpha is sane`);
  }
  const over = overlapPairs(plan);
  ok(over.length === 0, `${t.id}: the composition never overlaps itself${over.length ? ` — ${over.map((p) => p.join(' ↔ ')).join('; ')}` : ''}`);
  const zs = plan.map((w) => w.z);
  ok(zs.every((z) => Number.isFinite(z)), `${t.id}: z values are numbers`);
}

// the collection coverage: every catalog wallpaper from the user's groups anchors at least one
// theme, and the two reference poles exist with their signatures
for (const id of ['anime-1', 'anime-3', 'anime-4', 'wallpaper-1', 'wallpaper-2', 'wallpaper-3', 'sanime-1', 'sanime-2', 'sanime-4']) {
  ok(THEMES.some((t) => t.appearance.wallpaper === id), `the collection's ${id} anchors a theme`);
}
ok(THEMES.some((t) => t.id === 'acid-press' && t.style.font === 'narrow' && t.appearance.mode === 'light'), 'Acid Press keeps its signature');
ok(THEMES.some((t) => t.id === 'deep-forest' && t.style.font === 'serif'), 'Deep Forest keeps its signature');
// a real spread of modes, not 25 dark clones
const light = THEMES.filter((t) => t.appearance.mode === 'light').length;
ok(light >= 6, `a real spread of modes (${light} light of ${THEMES.length})`);
// at most two themes share a wallpaper (a second reading must be a genuinely different identity)
const byWall = {};
for (const t of THEMES) if (t.appearance.wallpaper) byWall[t.appearance.wallpaper] = (byWall[t.appearance.wallpaper] || 0) + 1;
ok(Object.values(byWall).every((n) => n <= 2), `no wallpaper anchors more than two themes: ${JSON.stringify(byWall)}`);

console.log(`theme_studio_themes: ${checks} checks passed, ${THEMES.length} themes`);
