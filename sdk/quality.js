// quality.js — the rendering side of the performance profiles (Settings → Power, and the Control
// Center's Power Mode tile, which picks both together). What the desktop draws cheaper when the
// user picks performance or low, and — with the default 'auto' — what adapts by itself when the
// system stays loaded and restores gradually when it recovers (docs/DESIGN.md, "Motion").
//
// Two levers live here:
//   - the backdrop blur's minimum downsample, into the compositor through insane.setBlurQuality
//     (canvas_blur_shrink) — the most expensive effect on the CPU path, and pure bandwidth on the GPU;
//   - the wallpaper's frame cap, which motion.jsx applies to the decoder live (media.control
//     'fpsmax', MM_FPSMAX) — its ladder and hysteresis are in motionmodel.js, tested without a screen.
// Application frame rates are never touched: nothing here limits anything but the ambient layers.

import { settings } from './settings.js';
import { createStore } from './store.js';

// 'auto' (the default) changes nothing on its own — the adaptive layer below answers the load;
// 'balanced' pins the normal quality; the other two trade a little softness and wallpaper
// smoothness for the bandwidth. busyAt is the CPU percentage where the adaptive layer steps in.
export const QUALITY_PROFILES = {
  auto: { blurShrink: 0, wallpaperFps: 30, busyAt: 85 },
  balanced: { blurShrink: 0, wallpaperFps: 30, busyAt: 85 },
  performance: { blurShrink: 4, wallpaperFps: 20, busyAt: 60 },
  low: { blurShrink: 8, wallpaperFps: 15, busyAt: 50 },
};

export const qualityProfile = () => {
  const q = settings.get().renderQuality;
  return QUALITY_PROFILES[q] ? q : 'auto';
};
export const qualityKnobs = () => QUALITY_PROFILES[qualityProfile()];

export const renderQuality = createStore('auto');       // what the shell last resolved (for the UI)

// The adaptive layer: the desktop lowers its ambient quality when the CPU stays loaded and raises
// it back step by step after it recovers. Only 'auto' adapts; a pinned profile holds its knobs.
// busyPct arrives from the same reader the wallpaper's pause rules use (sdk/motion.jsx); one call
// a tick (5 s) is enough — nothing here switches fast enough to flicker.
let hot = 0;                                            // consecutive loaded samples
let cool = 0;                                           // consecutive clear samples
let adaptive = false;
export const isAdaptive = () => adaptive;

function apply(shrink) {
  try {
    if (typeof insane !== 'undefined' && typeof insane.appId !== 'string' && insane.setBlurQuality) insane.setBlurQuality(shrink);
  } catch (e) { /* an older insane-server: the blur keeps its own factor */ }
}

export function qualityTick(busyPct) {
  const knobs = qualityKnobs();
  const profile = qualityProfile();
  const adaptiveAllowed = profile === 'auto';
  if (!adaptiveAllowed) {
    hot = cool = 0;
    if (adaptive) { adaptive = false; renderQuality.set(profile); }
    apply(knobs.blurShrink);
    return;
  }
  const busy = busyPct != null && busyPct >= knobs.busyAt;
  hot = busy ? hot + 1 : 0;
  cool = !busy ? cool + 1 : 0;
  // two loaded samples in a row (about 10 s) before anything yields; ten clear ones before the
  // first step back, the next after as many again — gradual, and never mid-burst
  if (!adaptive && hot >= 2) { adaptive = true; apply(4); renderQuality.set('auto-reduced'); }
  else if (adaptive && cool >= 2) { adaptive = false; apply(0); renderQuality.set('auto'); }
}

settings.subscribe(() => {
  const knobs = qualityKnobs();
  adaptive = false;                                     // a profile change restarts the layer
  hot = cool = 0;
  apply(knobs.blurShrink);
  renderQuality.set(qualityProfile());
});
apply(qualityKnobs().blurShrink);                       // and the first application, at load
