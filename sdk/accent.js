// accent.js — the wallpaper-sampled accent colour the themes read (settings.accent 'auto').
// The sampler is server-side (media.accentFrom / media.accent, server/src/ui/js_media.c); the shell's
// theme entry stores the raw hex here on every wallpaper change, and both the theme's makeTheme and
// Settings' accent row show it. Raw — the theme tone-maps for its mode.
import { createStore } from './store.js';

export const wallpaperAccent = createStore({ hex: null });
