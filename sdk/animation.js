// animation.js — every duration and curve of the desktop's motion, in one place (docs/DESIGN.md).
// The theme and the SDK read these; nothing else hardcodes a millisecond of animation.

export const DUR = {
  open: 200,          // a window fades in and rises
  close: 150,         // a window fades out, faster than it came
  minimize: 420,      // the genie: the window's strips fly into its Dock icon
  restore: 360,       // …and back out of it, a little quicker than in
  bounce: 1100,       // a Dock icon's launch hop (two hops, damped)
  dockSlide: 180,     // the Dock sliding away and back (auto-hide)
  reorder: 150,       // Dock neighbours making room for a dragged icon
  poof: 320,          // the «poof» when an icon is removed
};

// Easings. t is 0..1; each returns 0..1.
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const easeIn = (t) => t * t;

// The genie's per-strip progress: the bottom of the window leads, the top follows, each strip
// easing in-out; lead is how much later the top starts (0..1 of the whole animation).
export function genieStrip(p, v, lead = 0.42) {
  const start = lead * (1 - v);
  const q = Math.max(0, Math.min(1, (p - start) / (1 - start)));
  return easeInOut(q);
}
