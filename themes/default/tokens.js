// Tokens of the "Insane Flow" theme. The base keys (text, accent, windowBg…) are the contract
// with apps (see sdk/theme.js); the rest belongs to this theme.
import { insaneosWallpapers, wallpaperAccent, toneHex, resolveAccent } from '@insaneos/sdk';

export const accents = {
  azul: '#0a84ff',
  violeta: '#bf5af2',
  rosa: '#ff375f',
  naranja: '#ff9f0a',
  verde: '#30d158',
  grafito: '#8e8e93',
};

// The Insane OS collection (Signature, Lumo, Cosmos; sdk/wallpapers.js) and this theme's own
// gradients (tools/gen-wallpaper.py). name: English fallback; the shown name is the translation of
// nameKey (assets/locales/*/shell.json). Thumbnails: assets/thumbs/ (320×180).
const gradients = [
  { id: 'aurora', category: 'gradients', nameKey: 'shell.wallpaper.aurora', name: 'Aurora', src: 'assets/aurora.png', thumb: 'assets/thumbs/aurora.jpg' },
  { id: 'ocean', category: 'gradients', nameKey: 'shell.wallpaper.ocean', name: 'Ocean', src: 'assets/ocean.png', thumb: 'assets/thumbs/ocean.jpg' },
  { id: 'sunset', category: 'gradients', nameKey: 'shell.wallpaper.sunset', name: 'Sunset', src: 'assets/sunset.png', thumb: 'assets/thumbs/sunset.jpg' },
  { id: 'graphite', category: 'gradients', nameKey: 'shell.wallpaper.graphite', name: 'Graphite', src: 'assets/graphite.png', thumb: 'assets/thumbs/graphite.jpg' },
];
export const wallpapers = [...insaneosWallpapers, ...gradients];

// The "Auto" accent (settings.accent === 'auto'): the accent follows the wallpaper. The C side
// (server/src/ui/js_media.c, media.accentFrom / media.accent) reads the decoded picture and returns
// its dominant colour; index.jsx samples on every wallpaper change into the sdk's wallpaperAccent
// store (sdk/accent.js — Settings' accent row shows it too). Until the first sample lands (and
// whenever the running server predates those APIs) it stays null and makeTheme falls back to the OS
// violet, so 'auto' never renders a broken theme.
export { wallpaperAccent };

const hexToRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const hexFromRgb = (o) => '#' + [o.r, o.g, o.b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
// The picture's own colour is often too dark, too bright or too screaming to sit on the panels;
// keep its hue, pull the saturation into a legible band and place the lightness per mode.
export function toneAccent(hex, dark) { return toneHex(hex, dark); }

export function makeTheme({ mode, accent, effects, glassBlur, glassTransparency, glassSaturate }) {
  const dark = mode === 'dark';
  // Glass (0.8.8.8, Settings → Wallpaper): the transparency slider pulls every glass surface's
  // alpha towards a floor of 0.06 (almost clear); 0 keeps today's colours exactly. The blur
  // slider is the backdrop-blur radius in px, the saturation one boosts the blurred colours
  // (1 keeps them). All are off without effects.
  const gt = effects ? Math.max(0, Math.min(1, Number.isFinite(glassTransparency) ? glassTransparency : 0.3)) : 0;
  const ga = (base) => Math.max(0.04, base + (0.06 - base) * gt);
  const gb = effects ? Math.max(0, Math.min(64, Number.isFinite(glassBlur) ? Math.round(glassBlur) : 24)) : 0;
  const gs = effects && gb ? Math.max(1, Math.min(2, Number.isFinite(glassSaturate) ? glassSaturate : 1.2)) : 1;
  // the backdrop filter the glass surfaces use: the blur's radius and its saturation
  const glassFilter = gb ? `blur(${gb}px) saturate(${gs})` : undefined;
  return {
    mode,
    accent: accent === 'auto'
      ? (wallpaperAccent.get().hex ? toneAccent(wallpaperAccent.get().hex, dark) : accents.violeta)
      : resolveAccent(accent, accents, dark, accents.azul),
    accents,
    wallpapers,
    effects,
    glassBlur: gb,
    glassSaturate: gs,
    glassFilter,
    glassAlpha: (base) => ga(base),
    text: dark ? '#f5f5f7' : '#1d1d1f',
    textDim: dark ? 'rgba(235,235,245,0.55)' : 'rgba(60,60,67,0.6)',
    windowBg: dark ? '#1f1f23' : '#ffffff',
    sidebarBg: dark ? '#26262b' : '#f3f3f6',
    separator: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    hover: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
    control: dark ? '#3a3a40' : '#e3e3e8',
    inputBg: dark ? '#2a2a2f' : '#ffffff',
    // This theme's own (the deep charcoal of the reference look: the surfaces sit one step darker
    // than the windows, so the floating panels read as glass over the wallpaper, not as windows):
    menuBg: dark ? `rgba(18,18,24,${ga(0.46).toFixed(3)})` : `rgba(250,250,252,${ga(0.55).toFixed(3)})`,
    menuText: dark ? '#f5f5f7' : '#1d1d1f',
    // the app's menus on a display without the focused window (a bar on every display): menuText at textDim's strength
    menuTextDim: dark ? 'rgba(245,245,247,0.55)' : 'rgba(29,29,31,0.5)',
    menuHover: dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)',
    panelBg: dark ? (effects ? `rgba(28,28,36,${ga(0.76).toFixed(3)})` : '#24242c') : (effects ? `rgba(246,246,248,${ga(0.78).toFixed(3)})` : '#f2f2f5'),
    windowBorder: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)',
    titleBg: dark ? '#2b2b30' : '#ececef',
    dockBg: dark ? `rgba(46,46,56,${ga(0.42).toFixed(3)})` : `rgba(255,255,255,${ga(0.38).toFixed(3)})`,
    dockBorder: dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.55)',
    lightOff: dark ? '#4a4a50' : '#c8c8cc',
    // overlay scroll bars (sdk/components.jsx ScrollView): a soft pill
    scrollThumb: dark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.3)',
    scrollThumbHover: dark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
    blur: gb,
  };
}
