// Tokens of the "Insane Flow" theme. The base keys (text, accent, windowBg…) are the contract
// with apps (see sdk/theme.js); the rest belongs to this theme.
import { insaneosWallpapers } from '@insaneos/sdk';

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
    accent: accents[accent] || accents.azul,
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
    // This theme's own:
    menuBg: dark ? `rgba(24,24,30,${ga(0.42).toFixed(3)})` : `rgba(250,250,252,${ga(0.55).toFixed(3)})`,
    menuText: dark ? '#f5f5f7' : '#1d1d1f',
    // the app's menus on a display without the focused window (a bar on every display): menuText at textDim's strength
    menuTextDim: dark ? 'rgba(245,245,247,0.55)' : 'rgba(29,29,31,0.5)',
    menuHover: dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)',
    panelBg: dark ? (effects ? `rgba(36,36,42,${ga(0.72).toFixed(3)})` : '#2a2a30') : (effects ? `rgba(246,246,248,${ga(0.78).toFixed(3)})` : '#f2f2f5'),
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
