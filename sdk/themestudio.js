// themestudio.js — the Theme Studio's state: which theme is active, its live widget list, the
// appearance keys a theme drives, per-theme overrides and the user's custom presets.
//
// settings.themeStudio (written ONLY here — the one-writer rule) carries:
//   {
//     active: '<built-in id>' | 'custom-<key>' | null,
//     savedAppearance: { wallpaper…accent } | null,      // the pre-theme look, restored on deactivate
//     overrides: { '<themeId>': { widgets: [...] } },    // built-ins: only what changed from the plan
//     customs:   { 'custom-<key>': { name, base, widgets, appearance } },
//   }
// The runtime view is `tsLive`: { active, def, widgets, area } — the shell and Settings both read it;
// the shell's ThemeWidgets layer renders it, Settings' Themes page edits it through the model.
//
// A theme application writes the appearance keys straight through settings.set (wallpaper,
// wallpaperBg, wallpaperFit, motion, mode, accent) — the same keys Settings → Wallpaper and
// Appearance already drive, so the live desktop updates through the paths that always worked.
import { settings } from './settings.js';
import { admin } from './admin.js';
import { createStore } from './store.js';
import {
  TS_KINDS, resolvePlan, liveWidgets, newInstance, removeW, duplicateW,
  moveW, resizeW, setW, zOrder, planDiffers, deepCopy, setW as setWModel,
} from './themestudio-model.js';
import { THEMES } from './themestudio-themes.js';

// The appearance keys a theme owns while it is active.
export const TS_APPEARANCE_KEYS = ['wallpaper', 'wallpaperBg', 'wallpaperFit', 'motion', 'mode', 'accent',
  'glassBlur', 'glassTransparency', 'glassSaturate'];

export const tsLive = createStore({ active: null, def: null, widgets: [], area: null });
// The desktop-arrange mode: the Studio canvas's twin on the real desktop — the cards drag
// (pointer events land on the card's surface), one undo step per drag, Esc leaves.
export const tsArranging = createStore(false);
// The card picked on the desktop (arrange mode) and the look captured when the mode began —
// Cancel restores it exactly; Save & Apply flushes and leaves.
export const tsSelected = createStore(null);
// ONE undo stack for the whole customize experience (the Themes page's editor AND the desktop
// bar) — both push before their edits, so undo walks the user's steps regardless of surface.
export const tsHistory = (() => {
  let past = [], future = [], base = null;
  const cap = 60;
  return {
    push(state) { if (past.length === 0 || past[past.length - 1] !== state) { past.push(state); if (past.length > cap) past.shift(); } future = []; },
    undo(current) { if (!past.length) return null; future.push(current); const p = past.pop(); return p; },
    redo(current) { if (!future.length) return null; past.push(current); return future.pop(); },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    reset() { past = []; future = []; base = null; },
    beginDrag(pre) { base = pre; },
    endDrag(post) { if (base != null && base !== post) { past.push(base); if (past.length > cap) past.shift(); future = []; } base = null; },
  };
})();
export const tsEntrySnapshot = createStore(null);
// A desktop drag's pre-drag snapshot, handed to the Themes page (ONE undo step per desktop drag)
export const tsDesktopUndo = createStore(null);

// Enter/leave the desktop customize mode. Cancel(true) puts the entry look back; Save(false)
// flushes the debounced persist and leaves everything as the person shaped it.
export function tsEnterArrange() {
  const st = tsLive.get();
  tsEntrySnapshot.set(st.widgets ? st.widgets.map((w) => ({ ...w, cfg: JSON.parse(JSON.stringify(w.cfg || {})), style: JSON.parse(JSON.stringify(w.style || {})) })) : null);
  tsSelected.set(null);
  tsArranging.set(true);
}
export function tsExitArrange(cancel) {
  if (cancel) {
    const snap = tsEntrySnapshot.get();
    if (snap) tsMutate(() => snap);
    else tsResetTheme();
  }
  tsPersistFlush();
  tsSelected.set(null);
  tsEntrySnapshot.set(null);
  tsArranging.set(false);
}

// ---------------------------------------------------------------- validation (a malformed
// settings.themeStudio must never crash the shell — it degrades to "no theme")

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isFinite = (v) => typeof v === 'number' && Number.isFinite(v);

function validAppearance(v) {
  if (!isObj(v)) return null;
  const out = {};
  for (const k of TS_APPEARANCE_KEYS) if (v[k] !== undefined) out[k] = v[k];
  return Object.keys(out).length ? out : null;
}

function validInstance(w) {
  return isObj(w) && typeof w.id === 'string' && TS_KINDS[w.kind] &&
    isFinite(w.x) && isFinite(w.y) && isFinite(w.w) && isFinite(w.h) &&
    isFinite(w.z ?? 0) && isObj(w.cfg || {}) && isObj(w.style || {});
}

function validList(v) {
  return Array.isArray(v) ? v.filter(validInstance).map((w) => ({
    id: w.id, kind: w.kind, x: w.x, y: w.y, w: w.w, h: w.h,
    z: w.z ?? 0, hidden: !!w.hidden, pinned: !!w.pinned, locked: !!w.locked, cfg: w.cfg || {}, style: w.style || {},
  })) : null;
}

function validOverrides(v) {
  const out = {};
  if (!isObj(v)) return out;
  for (const k of Object.keys(v)) {
    const list = validList(isObj(v[k]) ? v[k].widgets : null);
    if (list) out[k] = { widgets: list };
  }
  return out;
}

function validCustoms(v) {
  const out = {};
  if (!isObj(v)) return out;
  for (const k of Object.keys(v)) {
    const c = v[k];
    if (!isObj(c) || typeof c.name !== 'string' || !c.name.trim()) continue;
    const widgets = validList(c.widgets);
    if (!widgets) continue;
    out[k] = { name: c.name.slice(0, 60), base: typeof c.base === 'string' ? c.base : null, widgets, appearance: validAppearance(c.appearance) };
  }
  return out;
}

function tsSaved() {
  const s = settings.get().themeStudio;
  if (!isObj(s)) return { active: null, savedAppearance: null, overrides: {}, customs: {} };
  return {
    active: typeof s.active === 'string' ? s.active : null,
    savedAppearance: validAppearance(s.savedAppearance),
    overrides: validOverrides(s.overrides),
    customs: validCustoms(s.customs),
  };
}

function write(saved) { settings.set({ themeStudio: saved }); }

// ---------------------------------------------------------------- theme resolution

// A theme definition: built-in (from the registry) or a user's custom preset. Both expose
// { id, name, desc, appearance, widgets, custom } — the widgets of a custom preset are concrete
// instances, a built-in's are a plan in the 1280×800 design space (themestudio-model.resolvePlan).
export function themeOf(id) {
  if (!id) return null;
  const saved = tsSaved();
  if (saved.customs[id]) {
    const c = saved.customs[id];
    const base = c.base ? THEMES.find((t) => t.id === c.base) : null;
    return {
      id, name: c.name, desc: base ? `Based on ${base.name}` : 'Custom theme', custom: true,
      appearance: c.appearance || (base ? deepCopy(base.appearance) : {}),
      widgets: c.widgets, colors: base ? base.colors : null,
    };
  }
  return THEMES.find((t) => t.id === id) || null;
}

// Every theme the picker lists: the built-ins in registry order, then the customs by name.
export function tsAllThemes() {
  const saved = tsSaved();
  const customs = Object.keys(saved.customs)
    .map((id) => themeOf(id))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...THEMES, ...customs];
}

function snapshotAppearance() {
  const s = settings.get();
  const out = {};
  for (const k of TS_APPEARANCE_KEYS) if (s[k] !== undefined) out[k] = s[k];
  return out;
}

// ---------------------------------------------------------------- activation

function overrideOf(saved, id) { return (saved.overrides[id]) || null; }

// Boot (the theme's startShell): resolve the active theme's live widget list for the real area.
// A theme that no longer exists (deleted custom preset, retired built-in) degrades to no theme
// without touching the appearance — the desktop keeps exactly what it is showing.
export function tsInit(area) {
  const saved = tsSaved();
  const def = themeOf(saved.active);
  if (saved.active && !def) {
    write({ ...saved, active: null });
    tsLive.set({ active: null, def: null, widgets: [], area });
    return;
  }
  const widgets = def ? liveWidgets(def, overrideOf(saved, saved.active), area) : [];
  tsLive.set({ active: saved.active, def, widgets, area });
}

// Apply a theme (built-in or custom): write its appearance, resolve its widgets, remember it.
// The pre-theme appearance is snapshotted once — switching Theme A → B keeps the original, so
// deactivating always returns to the look the user had before the Studio took over.
export function tsApplyTheme(id, area) {
  const def = themeOf(id);
  if (!def) return false;
  tsPersistFlush();
  const saved = tsSaved();
  const savedAppearance = saved.active && saved.savedAppearance ? saved.savedAppearance : snapshotAppearance();
  const appearance = def.appearance || {};
  const patch = {};
  for (const k of TS_APPEARANCE_KEYS) if (appearance[k] !== undefined) patch[k] = appearance[k];
  // a theme stands either on a picture or on a background — the pair is written together so the
  // previous theme's gradient (which Backdrop draws INSTEAD of any picture) never survives
  if (patch.wallpaper === undefined) patch.wallpaper = appearance.wallpaper ?? null;
  if (patch.wallpaperBg === undefined) patch.wallpaperBg = appearance.wallpaperBg ?? null;
  settings.set({ ...patch, themeStudio: { ...saved, active: id, savedAppearance } });
  // the lock screen follows the theme (the toggle lives in the theme look): its picture lands on
  // the login screen with the apply itself — every path that applies a theme brings the lock
  // screen along, not only the Themes page's own button. User pictures use the login-image flow
  // and are skipped here; a refusal is logged, never swallowed silently.
  if (settings.get().lockFollowTheme !== false && patch.wallpaper && !String(patch.wallpaper).startsWith('image:')) {
    admin.run('wallpaper-login', `still ${patch.wallpaper}`).catch((e) => console.error('themestudio: the login screen did not follow the theme:', e && e.message ? e.message : e));
  }
  const widgets = liveWidgets(def, overrideOf(saved, id), area);
  tsLive.set({ active: id, def, widgets, area });
  return true;
}

// Back to no theme: the saved look returns (or, when there is none, the keys stay as they are —
// an interrupted first apply must not blank the desktop).
export function tsDeactivate(area) {
  tsPersistFlush();
  const saved = tsSaved();
  const restore = saved.savedAppearance || {};
  write({ active: null, savedAppearance: null, overrides: saved.overrides, customs: saved.customs });
  if (Object.keys(restore).length) settings.set(restore);
  tsLive.set({ active: null, def: null, widgets: [], area });
}

// ---------------------------------------------------------------- edits (live list → persisted)

// The pending write carries the state it was scheduled with, so a theme switch cannot steal it:
// apply/deactivate flush first (tsPersistFlush). Exposed for the tests, which assert immediately.
let pending = null;
function persistNow() {
  if (!pending) return;
  const { active, def, area, widgets } = pending;
  pending = null;
  const saved = tsSaved();
  if (saved.customs[active]) {
    const c = saved.customs[active];
    write({ ...saved, customs: { ...saved.customs, [active]: { ...c, widgets } } });
    return;
  }
  // A built-in keeps its settings entry only when the list really left the plan — an untouched
  // theme must never write an override (the settings.json honesty rule).
  const plan = resolvePlan(def.widgets || [], area, def.sw, def.sh);
  const rec = planDiffers({ widgets }, plan) ? { widgets } : null;
  const overrides = { ...saved.overrides };
  if (rec) overrides[active] = rec;
  else delete overrides[active];
  write({ ...saved, overrides });
}
export function tsPersistFlush() {
  clearTimeout(persistTimer);
  persistNow();
}
let persistTimer = 0;
function persistWidgets(list) {
  const st = tsLive.get();
  if (!st.active || !st.def) return;
  // live list updates ride every frame; the settings write settles 400 ms after the last one —
  // the classic widgets' own debounce (DesktopWidgets' saveTimer) — with the state it belongs to
  pending = { active: st.active, def: st.def, area: st.area, widgets: list };
  clearTimeout(persistTimer);
  persistTimer = setTimeout(persistNow, 400);
}

// Run a pure model edit over the live list; `fn(list, area)` returns the next list or null.
// The model's no-op paths return a fresh copy (never === the live list), so equality is checked
// by value — a nudge already at the edge, forward from the top, S at minimum size must not re-set
// the store, re-persist, or leave a junk undo entry.
const sameWidgets = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const key = (w) => `${w.id}|${w.x}|${w.y}|${w.w}|${w.h}|${w.z}|${w.hidden}|${w.pinned}|${w.locked}|${JSON.stringify(w.cfg)}|${JSON.stringify(w.style)}`;
  for (let i = 0; i < a.length; i++) if (key(a[i]) !== key(b[i])) return false;
  return true;
};

export function tsMutate(fn, area) {
  const st = tsLive.get();
  if (!st.active || !st.def) return null;
  const a = area || st.area;
  const next = fn(st.widgets.map((w) => ({ ...w })), a);
  if (!next || sameWidgets(next, st.widgets)) return st.widgets;
  tsLive.set({ ...st, widgets: next });
  persistWidgets(next);
  return next;
}

// Add a widget of a named style route (the 525-entry catalog): the kind is created and the
// route's style patch rides it, so 'Clock · Glass' lands looking like glass on any theme.
export function tsAddVariant(kind, stylePatch, area, at) {
  const st = tsLive.get();
  if (!st.active || !TS_KINDS[kind]) return null;
  let made = null;
  tsMutate((list, a) => {
    made = newInstance(kind, list, a, at);
    if (made) made = { ...made, style: { ...(made.style || {}), ...(stylePatch || {}) } };
    return made ? [...list, made] : null;
  }, area);
  return made;
}

export function tsAdd(kind, area, at) {
  const st = tsLive.get();
  if (!st.active || !TS_KINDS[kind]) return null;
  let made = null;
  tsMutate((list, a) => {
    made = newInstance(kind, list, a, at);
    return made ? [...list, made] : null;
  }, area);
  return made;
}

export const tsRemove = (id, area) => tsMutate((l, a) => removeW(l, id), area);
export const tsDuplicate = (id, area) => tsMutate((l, a) => duplicateW(l, id, a), area);
export const tsMove = (id, x, y, area, opt) => tsMutate((l, a) => moveW(l, id, x, y, a, opt), area);
export const tsResize = (id, w, h, area) => tsMutate((l, a) => resizeW(l, id, w, h, a), area);
export const tsZ = (id, op, area) => tsMutate((l, a) => zOrder(l, id, op), area);
export const tsSetInstance = (id, patch, test, area) => tsMutate((l, a) => setW(l, id, patch, test), area);

// One widget back to the theme's plan (the customize panel's reset). Nothing to reset when the
// theme is a custom preset — the custom list IS the plan.
export function tsResetInstance(id, area) {
  const st = tsLive.get();
  if (!st.active || !st.def || st.def.custom) return null;
  const plan = resolvePlan(st.def.widgets || [], area || st.area, st.def.sw, st.def.sh);
  // ids carry the screen size (resolvePlan); after a resolution change the recomputed plan's ids
  // differ, so fall back to the same ordinal of the same kind
  let p = plan.find((w) => w.id === id);
  if (!p) {
    const cur = st.widgets.find((w) => w.id === id);
    if (cur) {
      const sameKind = plan.filter((w) => w.kind === cur.kind);
      const ord = st.widgets.filter((w) => w.kind === cur.kind).findIndex((w) => w.id === id);
      p = sameKind[Math.max(0, ord)] || sameKind[0];
    }
  }
  if (!p) return null;
  return tsSetInstance(id, { ...deepCopy(p) }, null, area);
}

// The whole theme back to its plan (the Themes page's Reset layout).
export function tsResetTheme(area) {
  const st = tsLive.get();
  if (!st.active || !st.def) return null;
  if (st.def.custom) return null;
  tsPersistFlush();
  const saved = tsSaved();
  const overrides = { ...saved.overrides };
  delete overrides[st.active];
  write({ ...saved, overrides });
  const widgets = resolvePlan(st.def.widgets || [], area || st.area, st.def.sw, st.def.sh);
  tsLive.set({ ...tsLive.get(), widgets });
  return widgets;
}

// ---------------------------------------------------------------- custom presets

// Save the active theme's current state as the user's own preset. The originals are never
// touched — the brief's rule (and the reason overrides exist).
export function tsSaveCustom(name) {
  const st = tsLive.get();
  const saved = tsSaved();
  if (!st.active) return null;
  const base = st.def && !st.def.custom ? st.active : (st.def && st.def.base) || null;
  const id = `custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;
  const rec = { name: String(name || 'My theme').slice(0, 60), base, widgets: deepCopy(st.widgets), appearance: snapshotAppearance() };
  write({ ...saved, customs: { ...saved.customs, [id]: rec } });
  return id;
}

export function tsRenameCustom(id, name) {
  const saved = tsSaved();
  const c = saved.customs[id];
  if (!c || typeof name !== 'string' || !name.trim()) return false;
  write({ ...saved, customs: { ...saved.customs, [id]: { ...c, name: name.slice(0, 60) } } });
  if (tsLive.get().active === id) tsLive.set({ ...tsLive.get(), def: themeOf(id) });
  return true;
}

export function tsDeleteCustom(id) {
  const saved = tsSaved();
  if (!saved.customs[id]) return false;
  const customs = { ...saved.customs };
  delete customs[id];
  write({ ...saved, customs });
  if (tsLive.get().active === id) tsDeactivate(tsLive.get().area);
  return true;
}

// While a custom preset is active, appearance changes made elsewhere (Wallpaper, Appearance)
// belong to that preset — recorded with compare-before-write so the subscription settles.
let syncing = false;
settings.subscribe(() => {
  if (syncing) return;
  const saved = tsSaved();
  if (!saved.active || !saved.customs[saved.active]) return;
  const cur = snapshotAppearance();
  const c = saved.customs[saved.active];
  if (JSON.stringify(cur) === JSON.stringify(c.appearance)) return;
  syncing = true;
  try {
    write({ ...saved, customs: { ...saved.customs, [saved.active]: { ...c, appearance: cur } } });
  } finally { syncing = false; }
});
