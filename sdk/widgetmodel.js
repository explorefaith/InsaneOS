// widgetmodel.js — the desktop widgets' layout (round 4, docs/DESKTOP.md "Widgets").
//
// The widgets' places live in settings.desktopWidgets; this model is the only writer. Pure rules
// here (tests: server/tests/widget_model_test.mjs), the store and the persistence at the bottom.
//
//   widgetLayout   the [{ type, id, x, y, w, h }] in play (null until loaded: the theme's defaults)
//   widgetsEditing edit mode: the gallery is open, cards drag, every card has a remove button
//
// The grid is 4 px; a widget never overlaps the Dock's strip (the caller passes the work area) and
// two widgets may overlap each other only by accident of a drag — "add" looks for the first free
// spot top-down on the right, like the old fixed layout.
import { createStore } from './store.js';

export const WIDGET_GRID = 4;

// What the gallery offers, in its order. w/h are the default card sizes.
export const WIDGET_CATALOG = [
  { type: 'insane-clock', w: 300, h: 132 },
  { type: 'insane-calendar', w: 300, h: 316 },
  { type: 'insane-battery', w: 300, h: 96 },
  { type: 'insane-stats', w: 300, h: 158 },
  { type: 'insane-media', w: 300, h: 112 },
];

export const widgetLayout = createStore(null);      // null: the theme draws its defaults
export const widgetsEditing = createStore(false);

export const catalogOf = (type) => WIDGET_CATALOG.find((c) => c.type === type) || null;

const snap = (v) => Math.round(v / WIDGET_GRID) * WIDGET_GRID;

// Inside the work area, clear of the Dock's strip (area already excludes auto-hidden Docks).
export function clampWidget(w, area) {
  const width = Math.max(120, Math.min(560, w.w));
  const height = Math.max(80, Math.min(620, w.h));
  const x = Math.max(area.x, Math.min(area.x + area.w - width, w.x));
  const y = Math.max(area.y, Math.min(area.y + area.h - height, w.y));
  return { ...w, x: snap(x), y: snap(y), w: width, h: height };
}

const hits = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// The first free spot for `size` on the right side, scanning down then wrapping columns towards
// the centre — where the desktop's widgets have always lived.
export function freeSpot(layout, size, area) {
  const taken = layout.map((w) => clampWidget(w, area));
  for (let col = area.x + area.w - size.w - 40; col >= area.x; col -= size.w + 40) {
    for (let y = area.y + 60; y <= area.y + area.h - size.h; y += 16) {
      const cand = { x: col, y: Math.round(y / 4) * 4, w: size.w, h: size.h };
      if (!taken.some((t) => hits(cand, t))) return { x: cand.x, y: cand.y };
    }
  }
  return { x: snap(area.x + area.w - size.w - 40), y: area.y + 60 };   // the desktop is full: stack
}

let nextId = 1;
export function loadWidgets(saved) {
  const list = Array.isArray(saved) ? saved.filter((w) => w && catalogOf(w.type) && Number.isFinite(w.x) && Number.isFinite(w.y)) : null;
  widgetLayout.set(list);
  nextId = list ? list.reduce((m, w) => Math.max(m, (Number(w.id) || 0) + 1), 1) : 1;
  return widgetLayout.get();
}

export function addWidget(type, area) {
  const c = catalogOf(type);
  if (!c) return null;
  const layout = widgetLayout.get() || [];
  const at = freeSpot(layout, { w: c.w, h: c.h }, area);
  const w = clampWidget({ type, id: nextId++, ...at, w: c.w, h: c.h }, area);
  widgetLayout.set([...layout, w]);
  return w;
}

export function removeWidget(id) {
  const layout = widgetLayout.get() || [];
  widgetLayout.set(layout.filter((w) => w.id !== id));
}

export const getWidget = (id) => (widgetLayout.get() || []).find((w) => String(w.id) === String(id)) || null;

export function moveWidget(id, x, y, area) {
  const layout = widgetLayout.get() || [];
  widgetLayout.set(layout.map((w) => (String(w.id) === String(id) ? clampWidget({ ...w, x, y }, area) : w)));
}

export function resizeWidget(id, dw, dh, area) {
  const layout = widgetLayout.get() || [];
  widgetLayout.set(layout.map((w) => (String(w.id) === String(id) ? clampWidget({ ...w, w: w.w + dw, h: w.h + dh }, area) : w)));
}
