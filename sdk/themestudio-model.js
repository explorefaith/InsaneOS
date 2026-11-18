// themestudio-model.js — the Theme Studio's pure model: widget instances, their style schema,
// z-order, visibility, overlap policy, undo/redo and the persistence shape. No `insane.*`, no
// React: everything here is a function of its arguments so tests/theme_studio_model_test.mjs
// can walk every rule (the house pattern of widgetmodel.js / crypto.js).
//
// Persistence lives in one settings key (`settings.themeStudio`, see sdk/themestudio.js):
//   {
//     active: 'acid-press' | 'custom-172...' | null,
//     savedAppearance: { wallpaper, wallpaperBg, wallpaperFit, motion, mode } | null,
//     overrides: { '<themeId>': { widgets: [...] } },        // built-in themes: only what changed
//     customs:   { '<customId>': { name, base, widgets: [...] } },
//   }
// One widget instance:
//   { id, kind, x, y, w, h, z, hidden, pinned, cfg, style }
// `z` is a small integer; the array order doesn't matter, only z does (layer panel sorts by it).

export const TS_GRID = 4;                   // the snap grid (px), like widgetmodel's WIDGET_GRID
export const TS_MIN_W = 88;
export const TS_MIN_H = 56;

// The faces the engine carries (server/src/ui/text.c font_for). `preview` is the css-ish name
// the selector draws with, `weights` are the real files behind them.
export const TS_FONTS = [
  { id: 'sans-serif', name: 'Inter',                weights: [400, 500, 600, 700], italic: true,  role: 'sans' },
  { id: 'monospace',  name: 'JetBrains Mono',       weights: [400, 700],           italic: true,  role: 'mono' },
  { id: 'brand',      name: 'Plus Jakarta Sans',    weights: [500, 800],           italic: false, role: 'geometric' },
  { id: 'serif',      name: 'Noto Serif Display',   weights: [400, 700],           italic: true,  role: 'serif' },
  { id: 'display',    name: 'Noto Sans Display',    weights: [400, 700],           italic: true,  role: 'sans' },
  { id: 'narrow',     name: 'Liberation Sans Narrow', weights: [400, 700],         italic: true,  role: 'condensed' },
  { id: 'compact',    name: 'DejaVu Sans Condensed', weights: [400, 700],          italic: true,  role: 'condensed' },
  { id: 'book',       name: 'DejaVu Serif Condensed', weights: [400, 700],         italic: true,  role: 'serif' },
];

// The widget archetypes. `defaults` are the instance fields a new instance gets when a theme
// doesn't spell them out; `label` is for the layer panel and the add-menu.
export const TS_KINDS = {
  'clock-digital': { label: 'Digital clock',  defaults: { w: 300, h: 132 } },
  'clock-analog':  { label: 'Analog clock',   defaults: { w: 148, h: 148 } },
  'clock-world':   { label: 'World clock',    defaults: { w: 168, h: 168 } },
  'calendar':      { label: 'Calendar',       defaults: { w: 288, h: 300 } },
  'agenda':        { label: 'Agenda',         defaults: { w: 260, h: 128 } },
  'weather':       { label: 'Weather',        defaults: { w: 168, h: 168 } },
  'stats':         { label: 'System stats',   defaults: { w: 168, h: 158 } },
  'battery':       { label: 'Battery',        defaults: { w: 148, h: 148 } },
  'media':         { label: 'Now playing',    defaults: { w: 300, h: 92 } },
  'notes':         { label: 'Notes',          defaults: { w: 220, h: 180 } },
  'todo':          { label: 'Task list',      defaults: { w: 220, h: 196 } },
  'quote':         { label: 'Quote',          defaults: { w: 240, h: 150 } },
  'pomodoro':      { label: 'Pomodoro',       defaults: { w: 168, h: 180 } },
  'network':       { label: 'Network',        defaults: { w: 208, h: 128 } },
  'storage':       { label: 'Storage',        defaults: { w: 208, h: 108 } },
  'label':         { label: 'Typography',     defaults: { w: 420, h: 96 } },
  'headline':      { label: 'Headline',       defaults: { w: 400, h: 128 } },
  'gauge':         { label: 'Gauge',          defaults: { w: 168, h: 120 } },
};

const uid = (() => {
  let n = 0;
  return (p) => `${p}-${(++n).toString(36)}${Date.now().toString(36).slice(-4)}`;
})();

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const snap = (v, grid) => Math.round(v / grid) * grid;

// ---------------------------------------------------------------- instances

// A fresh instance of `kind` at a free spot of `area`; `list` is the existing set (its ids and
// occupied space are avoided). Style/cfg start empty — the theme's kind definition speaks first.
export function newInstance(kind, list, area, at) {
  const k = TS_KINDS[kind];
  if (!k) return null;
  const w = k.defaults.w, h = k.defaults.h;
  const spot = at || freeSpot(list, { w, h }, area);
  const z = nextZ(list);
  return {
    id: uid('ts'),
    kind,
    x: snap(clamp(spot.x, area.x, area.x + area.w - w), TS_GRID),
    y: snap(clamp(spot.y, area.y, area.y + area.h - h), TS_GRID),
    w, h,
    z,
    hidden: false,
    pinned: false,
    cfg: {},
    style: {},
  };
}

export function nextZ(list) {
  return list.reduce((m, w) => Math.max(m, w.z), 0) + 1;
}

// First spot that doesn't cover an existing widget: scan the right columns downward (the desktop
// compositions live on the left), then wrap column by column. Same spirit as widgetmodel.freeSpot.
export function freeSpot(list, size, area) {
  const step = 24;
  for (let c = 0; c < 24; c++) {
    for (let r = 0; r < 24; r++) {
      const x = area.x + area.w - size.w - c * step;
      const y = area.y + 12 + r * step;
      if (x < area.x || y + size.h > area.y + area.h) break;
      if (!hitsAny(list, { x, y, w: size.w, h: size.h })) return { x, y };
    }
  }
  return { x: area.x + area.w - size.w, y: area.y + 12 };   // full: last resort, overlap allowed there
}

export function clampInstance(w, area) {
  const o = { ...w };
  o.w = clamp(o.w, TS_MIN_W, Math.max(TS_MIN_W, area.w));
  o.h = clamp(o.h, TS_MIN_H, Math.max(TS_MIN_H, area.h));
  o.x = clamp(Math.round(o.x), area.x, area.x + area.w - o.w);
  o.y = clamp(Math.round(o.y), area.y, area.y + area.h - o.h);
  return o;
}

export function getW(list, id) { return list.find((w) => w.id === id) || null; }

// ---------------------------------------------------------------- edits (pure list → list)

export function removeW(list, id) { return list.filter((w) => w.id !== id); }

export function duplicateW(list, id, area) {
  const w = getW(list, id);
  if (!w) return list;
  const copy = { ...w, id: uid('ts'), z: nextZ(list), cfg: deepCopy(w.cfg), style: deepCopy(w.style) };
  // 24 px down-right, then clamped — a deliberate click, never a hidden overlap (v1 keeps the
  // copy near its source so the layer panel reads naturally)
  const moved = clampInstance({ ...copy, x: w.x + 24, y: w.y + 24 }, area);
  const over = hitsAny(list, moved) && !hitsAny(list, { ...moved, x: w.x - 24, y: w.y - 24 });
  const placed = over ? clampInstance({ ...moved, x: w.x - 24, y: w.y - 24 }, area) : moved;
  return [...list, placed];
}

export function moveW(list, id, x, y, area, opt = {}) {
  const w = getW(list, id);
  if (!w) return list;
  const nx = opt.snap === false ? Math.round(x) : snap(x, TS_GRID);
  const ny = opt.snap === false ? Math.round(y) : snap(y, TS_GRID);
  let moved = clampInstance({ ...w, x: nx, y: ny }, area);
  if (opt.avoidOverlap && w.kind !== 'label' && hitsAny(list, moved, id)) {
    const rescue = nearestFree(list, moved, area, id);
    if (rescue) moved = rescue;
  }
  if (moved.x === w.x && moved.y === w.y) return list;
  return list.map((o) => (o.id === id ? moved : o));
}

export function resizeW(list, id, w, h, area) {
  const o = getW(list, id);
  if (!o) return list;
  const size = clampInstance({ ...o, w: snap(w, TS_GRID), h: snap(h, TS_GRID) }, area);
  if (size.w === o.w && size.h === o.h) return list;
  return list.map((x) => (x.id === id ? size : x));
}

export function setW(list, id, patch, test) {
  const o = getW(list, id);
  if (!o) return list;
  const next = { ...o, ...patch };
  if (test && test(o, next) === false) return list;
  if (shallowEqualObj(o, next)) return list;
  return list.map((x) => (x.id === id ? next : x));
}

// z-order: bring to front (max+1), send to back (min-1), forward/backward swap with the adjacent
// widget in sorted order (front/back leave gaps in z, so the neighbour is found by rank, not z±1)
export function zOrder(list, id, op) {
  const w = getW(list, id);
  if (!w) return list;
  const zs = list.map((o) => o.z);
  const min = Math.min(...zs), max = Math.max(...zs);
  if (op === 'front' && w.z !== max) return list.map((o) => (o.id === id ? { ...o, z: max + 1 } : o));
  if (op === 'back' && w.z !== min) return list.map((o) => (o.id === id ? { ...o, z: min - 1 } : o));
  const dir = op === 'forward' ? 1 : op === 'backward' ? -1 : 0;
  if (!dir) return list;
  const ordered = byZ(list);
  const idx = ordered.findIndex((o) => o.id === id);
  const other = ordered[idx + dir];
  if (!other) return list;
  return list.map((o) => {
    if (o.id === id) return { ...o, z: other.z };
    if (o.id === other.id) return { ...o, z: w.z };
    return o;
  });
}

export function byZ(list) { return [...list].sort((a, b) => a.z - b.z); }

// ---------------------------------------------------------------- geometry predicates

export function hitsAny(list, box, exceptId = null) {
  return list.some((o) => o.id !== exceptId && !o.hidden &&
    box.x < o.x + o.w && o.x < box.x + box.w && box.y < o.y + o.h && o.y < box.y + box.h);
}

export function overlapPairs(list) {
  const out = [];
  const vis = list.filter((w) => !w.hidden);
  for (let i = 0; i < vis.length; i++)
    for (let j = i + 1; j < vis.length; j++)
      if (hitsAny([vis[i]], { x: vis[j].x, y: vis[j].y, w: vis[j].w, h: vis[j].h })) out.push([vis[i].id, vis[j].id]);
  return out;
}

// Walk a small spiral of candidate offsets until the box lands free (or give up).
export function nearestFree(list, box, area, exceptId) {
  const step = 24;
  for (let ring = 1; ring <= 6; ring++) {
    for (let dx = -ring * step; dx <= ring * step; dx += step) {
      for (let dy = -ring * step; dy <= ring * step; dy += step) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring * step) continue;   // ring border only
        const cand = clampInstance({ ...box, x: box.x + dx, y: box.y + dy }, area);
        if (cand.x === box.x + dx && cand.y === box.y + dy && !hitsAny(list, cand, exceptId)) return cand;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------- alignment guides

// Edges worth snapping to, from the OTHER widgets and the area itself. Returns
// { x: [values], y: [values] } in absolute px, plus the area's centre/right/bottom.
export function guideLines(list, exceptId, area) {
  const xs = [area.x, area.x + area.w / 2, area.x + area.w];
  const ys = [area.y, area.y + area.h / 2, area.y + area.h];
  for (const o of list) {
    if (o.id === exceptId || o.hidden) continue;
    xs.push(o.x, o.x + o.w / 2, o.x + o.w);
    ys.push(o.y, o.y + o.h / 2, o.y + o.h);
  }
  return { x: xs, y: ys };
}

// Snap a moving box against the guides within `tol` px; returns { x, y, gx, gy } where gx/gy are
// the guide line to draw (or null).
export function snapToGuides(box, guides, tol = 6) {
  let { x, y } = box;
  let gx = null, gy = null;
  const myX = [box.x, box.x + box.w / 2, box.x + box.w];
  const myY = [box.y, box.y + box.h / 2, box.y + box.h];
  for (const m of myX)
    for (const g of guides.x)
      if (Math.abs(m - g) <= tol && (gx === null || Math.abs(m - g) < Math.abs(gx - myX.find((v) => Math.abs(v - gx) <= tol)))) gx = g;
  for (const m of myY)
    for (const g of guides.y)
      if (Math.abs(m - g) <= tol && (gy === null || Math.abs(m - g) < Math.abs(gy - myY.find((v) => Math.abs(v - gy) <= tol)))) gy = g;
  if (gx !== null) {
    if (Math.abs(box.x - gx) <= tol) x = gx;
    else if (Math.abs(box.x + box.w / 2 - gx) <= tol) x = gx - box.w / 2;
    else x = gx - box.w;
  }
  if (gy !== null) {
    if (Math.abs(box.y - gy) <= tol) y = gy;
    else if (Math.abs(box.y + box.h / 2 - gy) <= tol) y = gy - box.h / 2;
    else y = gy - box.h;
  }
  return { x, y, gx, gy };
}

// ---------------------------------------------------------------- theme resolution

// A theme definition's widget plan: positions in a 1280×800 design space, turned into concrete
// instances for the real work area. Positions scale with the screen; sizes keep the theme's
// design (scale transforms are forbidden by the engine — they render children blank), clamped
// into the area. Ids are deterministic per theme so a re-apply keeps each widget's identity
// (and therefore its overrides) stable.
export function resolvePlan(plan, area, sw = 1280, sh = 800) {
  const kx = area.w / sw, ky = area.h / sh;
  const out = [];
  let n = 0;
  for (const p of plan) {
    const k = TS_KINDS[p.kind];
    if (!k) continue;
    const w = Math.min(p.w || k.defaults.w, area.w);
    const h = Math.min(p.h || k.defaults.h, area.h);
    out.push({
      id: `${area.w}x${area.h}-${p.kind}-${++n}`,
      kind: p.kind,
      x: snap(clamp(Math.round(area.x + p.x * kx), area.x, area.x + area.w - w), TS_GRID),
      y: snap(clamp(Math.round(area.y + p.y * ky), area.y, area.y + area.h - h), TS_GRID),
      w: snap(w, TS_GRID), h: snap(h, TS_GRID),
      z: p.z ?? n,
      hidden: !!p.hidden,
      pinned: !!p.pinned,
      cfg: deepCopy(p.cfg || {}),
      style: deepCopy(p.style || {}),
    });
  }
  return out;
}

// The live widget list for a theme: the user's overrides, or the theme's resolved plan. When the
// screen size changed since the overrides were written, every instance is re-clamped (a widget
// may never end up outside the safe area — the rules the editor enforces apply at boot too).
// The design space rides the theme def (sw/sh; a theme composes in its own canvas, the default
// 1280×800 is the historical one).
export function liveWidgets(themeDef, saved, area) {
  if (saved && Array.isArray(saved.widgets) && saved.widgets.length) {
    return saved.widgets.map((w) => clampInstance(w, area));
  }
  return resolvePlan(themeDef.widgets || [], area, themeDef.sw, themeDef.sh);
}

// ---------------------------------------------------------------- undo / redo

// Push-based history of per-theme widget lists. Contract: `push(state)` records the state
// BEFORE a discrete edit (call it, then mutate); drags coalesce through `beginDrag(pre)` /
// `endDrag(post)` which record the pre-drag state once. undo(current) returns the recorded
// previous state, redo(current) the next one.
export function createHistory(cap = 60) {
  let past = [], future = [], base = null;
  return {
    start(current) { base = current; past = []; future = []; },
    // record a completed state (one undo step)
    push(current) {
      if (base !== null) { past.push(base); base = null; }
      else if (past.length === 0 || past[past.length - 1] !== current) past.push(current);
      if (past.length > cap) past.shift();
      future = [];
    },
    beginDrag(current) { base = current; },
    endDrag(current) {
      if (base !== null && base !== current) { past.push(base); if (past.length > cap) past.shift(); future = []; }
      base = null;
    },
    undo(current) {
      if (!past.length) return current;
      future.push(current);
      const prev = past.pop();
      return prev;
    },
    redo(current) {
      if (!future.length) return current;
      past.push(current);
      return future.pop();
    },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    reset() { past = []; future = []; base = null; },
  };
}

// ---------------------------------------------------------------- style helpers

// Merge the theme's kind style with the instance overrides (instance wins; 1-level deep is
// enough — the schema is flat except `bg` gradients and `shadow`).
export function resolveStyle(themeStyle, instStyle) {
  const out = { ...(themeStyle || {}) };
  for (const k in instStyle || {}) {
    const v = instStyle[k];
    if (v === undefined || v === null || v === '') delete out[k];
    else out[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? { ...(out[k] || {}), ...v } : v;
  }
  return out;
}

// rgba()/hex → { r,g,b,a } and back, for the opacity slider that must touch only the surface.
export function withAlpha(color, alpha) {
  const c = parseColor(color);
  if (!c) return color;
  return `rgba(${c.r},${c.g},${c.b},${+(alpha * (c.a ?? 1)).toFixed(3)})`;
}

export function parseColor(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    if (h.length === 6) return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
    if (h.length === 8) return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: parseInt(h.slice(6, 8), 16) / 255 };
    return null;
  }
  m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    return { r: p[0] | 0, g: p[1] | 0, b: p[2] | 0, a: p.length > 3 ? p[3] : 1 };
  }
  return null;
}

// ---------------------------------------------------------------- misc

export function shallowEqualObj(a, b) {
  if (a === b) return true;
  const ka = Object.keys(a || {}), kb = Object.keys(b || {});
  if (ka.length !== kb.length) return false;
  return ka.every((k) => a[k] === b[k]);
}

export function deepCopy(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(deepCopy);
  const out = {};
  for (const k in v) out[k] = deepCopy(v[k]);
  return out;
}

// The persistence writer's guard: never save a list identical to the theme's plan (keeps
// settings.json honest — an untouched theme has no entry at all).
export function planDiffers(saved, plan) {
  if (!saved || !Array.isArray(saved.widgets)) return true;
  if (saved.widgets.length !== plan.length) return true;
  return saved.widgets.some((w, i) => {
    const p = plan[i] || {};
    return w.id !== p.id || w.x !== p.x || w.y !== p.y || w.w !== p.w || w.h !== p.h ||
      w.z !== p.z || !!w.hidden !== !!p.hidden || !!w.pinned !== !!p.pinned ||
      JSON.stringify(w.cfg) !== JSON.stringify(p.cfg) || JSON.stringify(w.style) !== JSON.stringify(p.style);
  });
}
