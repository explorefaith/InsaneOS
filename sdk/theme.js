// theme.js — contract between themes and apps. The theme provides the tokens; apps use them
// with useTheme() and so look right with any theme.
import { createContext, createElement, useContext, useEffect } from 'react';
import { settings } from './settings.js';
import { createStore } from './store.js';

// Minimal tokens every theme must provide (see themes/README.md).
export const DEFAULT_TOKENS = {
  mode: 'dark',
  accent: '#0a84ff',
  text: '#f5f5f7',
  textDim: 'rgba(235,235,245,0.55)',
  windowBg: '#1f1f23',
  sidebarBg: '#26262b',
  separator: 'rgba(255,255,255,0.08)',
  hover: 'rgba(255,255,255,0.07)',
  control: '#3a3a40',
  inputBg: '#2c2c31',
  radius: 8,
  wallpapers: [],        // [{ id, nameKey (locale key), name (English fallback), src }]
  // Shape and style of the shared controls (sdk/components.jsx, sdk/controls.jsx). A theme changes
  // them to give every app its look without touching the apps (docs/DESIGN.md, "Theme tokens").
  controlRadius: 7,       // Button, TextInput, SearchField, Stepper, dialog buttons
  controlRadiusSmall: 6,  // small buttons, toolbar buttons, sidebar rows
  groupRadius: 10,        // GroupBox (inset forms)
  menuRadius: 8,          // MenuButton menus, tooltips use menuRadius - 2
  menuItemRadius: 5,
  menuHighlight: 'accent',  // 'accent': the hovered item is filled with the accent; 'subtle': a light fill
  selection: 'fill',      // SidebarItem: 'fill' (accent background) or 'indicator' (light fill and an accent bar)
  inputFocus: 'ring',     // TextInput: 'ring' (accent border) or 'underline' (accent line at the bottom)
  buttonBorder: false,    // Button: a 1 px border around neutral buttons
  popupBg: null,          // menus and tooltips; null = a light or dark surface for the mode
};

// The surface of menus, tooltips and popovers for a theme (popupBg, or one for the mode).
export const popupBg = (t) => t.popupBg || (t.mode === 'dark' ? '#2c2c31' : '#ffffff');

// Hex towards white (f > 0) or black (f < 0): the press and hover shades of an accent.
export function shadeHex(hex, f) {
  const h = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex));
  if (!h) return hex;
  const c = [1, 2, 3].map((i) => Math.round(parseInt(h[i], 16) + (f > 0 ? (255 - parseInt(h[i], 16)) * f : parseInt(h[i], 16) * f)));
  return `#${c.map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('')}`;
}
// Hex as a translucent fill (the accent's subtle backgrounds).
export const alphaHex = (hex, a) => {
  const h = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex));
  if (!h) return hex;
  return `rgba(${parseInt(h[1], 16)}, ${parseInt(h[2], 16)}, ${parseInt(h[3], 16)}, ${a})`;
};

// A raw hex accent a theme (or the Theme Studio) picked: keep its hue, pull the saturation into a
// legible band and place the lightness per mode — a screaming or muddy colour never sits on the
// panels. A gray tone maps to a neutral ink (the premium keep).
export function toneHex(hex, dark) {
  const h = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex));
  if (!h) return null;
  const [r0, g0, b0] = [1, 2, 3].map((i) => parseInt(h[i], 16) / 255);
  const mx = Math.max(r0, g0, b0), mn = Math.min(r0, g0, b0);
  if (mx - mn < 0.02) {
    const v = dark ? 0.62 : 0.42;
    return rgbToHex(v * 255, v * 255, v * 255);
  }
  const l0 = 0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0;
  const s0 = (mx - mn) / (1 - Math.abs(2 * l0 - 1) || 1e-6);
  const s = Math.max(dark ? 0.45 : 0.5, Math.min(dark ? 0.82 : 0.85, s0));
  const l = dark ? 0.62 : 0.44;
  let hue;
  const d = mx - mn;
  if (mx === r0) hue = ((g0 - b0) / d + (g0 < b0 ? 6 : 0)) / 6;
  else if (mx === g0) hue = ((b0 - r0) / d + 2) / 6;
  else hue = ((r0 - g0) / d + 4) / 6;
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return rgbToHex(hue2rgb(p, q, hue + 1 / 3) * 255, hue2rgb(p, q, hue) * 255, hue2rgb(p, q, hue - 1 / 3) * 255);
}
const rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

// The theme accent from settings.accent: a named accent of the theme's table, a raw hex
// (tone-mapped), or anything else falls back to `fallback` (usually azul). The 'auto' case is the
// theme's own (the wallpaper sample) — pass the resolved hex here when it is already decided.
export const resolveAccent = (value, accents, dark, fallback) =>
  (accents && accents[value]) || (/^#[0-9a-f]{6}$/i.test(value || '') ? (toneHex(value, dark) || fallback) : fallback);

// Tokens every theme receives from its own accent and mode unless it provides them. The shadows were
// literals repeated in six places (window frames, menus, panels, banners); the accent shades repeat
// every hover/press rule. docs/DESIGN.md keeps the numbers here now.
export function deriveTokens(t) {
  const dark = t.mode !== 'light';
  const a = /^#[0-9a-f]{6}$/i.test(t.accent || '') ? t.accent : '#0a84ff';
  return {
    accentHover: t.accentHover || shadeHex(a, dark ? 0.14 : -0.14),
    accentPress: t.accentPress || shadeHex(a, dark ? -0.16 : -0.24),
    accentSubtle: t.accentSubtle || alphaHex(a, dark ? 0.16 : 0.12),
    shadowWindow: t.shadowWindow || (dark ? '0 24px 56px rgba(0,0,0,0.55)' : '0 24px 56px rgba(0,0,0,0.28)'),
    shadowWindowDim: t.shadowWindowDim || (dark ? '0 10px 28px rgba(0,0,0,0.32)' : '0 10px 28px rgba(0,0,0,0.16)'),
    shadowPanel: t.shadowPanel || (dark ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 40px rgba(0,0,0,0.22)'),
    shadowPopup: t.shadowPopup || (dark ? '0 8px 24px rgba(0,0,0,0.45)' : '0 8px 24px rgba(0,0,0,0.18)'),
    scrim: t.scrim || (dark ? 'rgba(10,10,16,0.35)' : 'rgba(10,10,16,0.22)'),
    scrimPanel: t.scrimPanel || (dark ? 'rgba(18,18,24,0.94)' : 'rgba(246,246,248,0.96)'),
  };
}

export const ThemeContext = createContext(DEFAULT_TOKENS);

// The tokens of the outermost provider, the theme's. The on-screen keyboard is mounted beside the
// theme's tree, not inside it (startShell's layers), and reads them here so it follows the mode and accent.
export const shellTokens = createStore(null);

// Isolated .lpk apps (another process) receive these same tokens live through the broker
// (insane.broker.publish, see docs/PRIVACY.md). Only the theme publishes them, not the app host.
let published = '';
function publishTokens(value) {
  try {
    if (typeof insane === 'undefined' || !insane.broker || typeof insane.broker.publish !== 'function') return;
    const json = JSON.stringify(value, (k, v) => (typeof v === 'function' ? undefined : v));
    if (json !== published) { published = json; insane.broker.publish('theme', json); }
  } catch (e) { /* non-serializable tokens */ }
}

// Linux apps (GTK, GNOME, Qt) read the mode, accent and title-bar button order through
// org.freedesktop.portal.Settings, served by insane-server (ui/portal.c). gtkButtons is the
// GTK order: traffic lights on the left, or buttons on the right in a taskbar-style theme.
const GNOME_ACCENTS = { azul: 'blue', violeta: 'purple', rosa: 'pink', naranja: 'orange', verde: 'green', grafito: 'slate',
  rojo: 'red', amarillo: 'yellow', turquesa: 'teal', celeste: 'blue' };
let portalSent = '';
function syncPortal(value) {
  try {
    if (typeof insane === 'undefined' || !insane.portal) return;
    const name = settings.get().accent || '';
    const msg = { dark: value.mode !== 'light', accent: /^#[0-9a-f]{6}$/i.test(value.accent) ? value.accent : '#0a84ff',
      accentName: GNOME_ACCENTS[name] || 'blue', buttons: value.gtkButtons || 'close,minimize,maximize:' };
    const json = JSON.stringify(msg);
    if (json !== portalSent) { portalSent = json; insane.portal.set(msg); }
  } catch (e) { /* no portal */ }
}

// Settings every app's controls follow, carried with the tokens so isolated apps (which have no
// settings file of their own) get them too: the scroll bars' mode (Settings → Appearance → Show
// scroll bars, sdk/scrollbar.js) and reduce motion. Tokens the theme (or, in an isolated app, the
// published tokens) already carry win.
function settingTokens() {
  const s = settings.get();
  return { scrollBars: s.scrollBars || 'auto', reduceMotion: !!s.reduceMotion };
}

export function ThemeProvider({ tokens, children }) {
  const base = { ...DEFAULT_TOKENS, ...settingTokens(), ...tokens };
  const value = { ...base, ...deriveTokens(base) };
  const outermost = useContext(ThemeContext) === DEFAULT_TOKENS;
  useEffect(() => { publishTokens(value); syncPortal(value); if (outermost) shellTokens.set(value); });
  return createElement(ThemeContext.Provider, { value }, children);
}

export const useTheme = () => useContext(ThemeContext);

// A translucent line color (rgba) laid over an opaque one (#rrggbb), as one opaque color. A window of an
// app with a transparent background (the Terminal) has nothing behind its border and title separator,
// so those are drawn already mixed: otherwise what is behind the window shows through them.
export function solidOver(rgba, hex) {
  const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(String(rgba));
  const h = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex));
  if (!m || !h) return rgba;
  const a = m[4] == null ? 1 : +m[4];
  const c = [1, 2, 3].map((i) => Math.round(+m[i] * a + parseInt(h[i], 16) * (1 - a)));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
