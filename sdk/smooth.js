// smooth.js — quality-of-life extras shared by every theme (mounted by startShell):
//
//   • Hot corners: push the pointer into a screen corner for a moment and an action
//     fires — overview, show desktop, or Do Not Disturb. Settings → hotCorners:
//     { on, tl, tr, bl, br } with actions 'overview' | 'showDesktop' | 'dnd' | 'none'.
//   • Auto dark: settings.autoDark { on, from, to } (local minutes) switches the
//     appearance dark at night and light by day, like macOS's automatic mode.
//   • Dynamic wallpaper: settings.dynamicWallpaper { on, day, night, from, to } —
//     wallpaper tokens swapped by time of day.
//   • Login chime: sound.play('chime') once per session start.
import { addListener, screen } from '@insaneos/runtime';
import { settings } from './settings.js';
import { sound } from './sound.js';
import { toggleShowDesktop } from './appcontrol.js';
import { toggleOverview } from './overview.jsx';
import { battery } from './hardware.jsx';

const CORNER = 6;          // px from the edges that counts as "in the corner"
const DWELL = 350;         // ms the pointer must rest there before it fires
const LEAVE = 24;          // px away that resets a fired corner

let fired = '';            // which corner fired, until the pointer leaves it
let enteredAt = 0;

const corners = () => {
  const c = settings.get().hotCorners;
  return { on: !c || c.on !== false, tl: c?.tl || 'overview', tr: c?.tr || 'dnd', bl: c?.bl || 'showDesktop', br: c?.br || 'none' };
};

function runAction(what) {
  try {
    if (what === 'overview') toggleOverview();
    else if (what === 'showDesktop') toggleShowDesktop();
    else if (what === 'dnd') {
      const n = settings.get().notifications || {};
      settings.set({ notifications: { ...n, dnd: !n.dnd } });
    }
  } catch (e) { console.log(`hot corner: ${e.message}`); }
}

function whichCorner(x, y) {
  const W = screen.width, H = screen.height;
  const nearL = x <= CORNER, nearR = x >= W - 1 - CORNER, nearT = y <= CORNER, nearB = y >= H - 1 - CORNER;
  if (nearT && nearL) return 'tl';
  if (nearT && nearR) return 'tr';
  if (nearB && nearL) return 'bl';
  if (nearB && nearR) return 'br';
  return null;
}

function inWindow(minutes, from, to) {
  return from <= to ? (minutes >= from && minutes < to) : (minutes >= from || minutes < to);
}

function tick() {
  const s = settings.get();
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  // auto dark
  const a = s.autoDark;
  if (a?.on) {
    const want = inWindow(mins, a.from ?? 19 * 60, a.to ?? 7 * 60) ? 'dark' : 'light';
    if (s.mode !== want) settings.set({ mode: want });
  }
  // dynamic wallpaper
  const d = s.dynamicWallpaper;
  if (d?.on && (d.day || d.night)) {
    const want = inWindow(mins, d.from ?? 19 * 60, d.to ?? 7 * 60) ? (d.night || s.wallpaper) : (d.day || s.wallpaper);
    if (want && s.wallpaper !== want) settings.set({ wallpaper: want });
  }
}

export function startSmooth() {
  // login chime — once, in the user's session (the login screen stays quiet)
  const greeter = typeof insane !== 'undefined' && typeof insane.greeter !== 'undefined';
  if (!greeter) { try { sound.play('chime'); } catch { /* sound may not be up yet */ } }

  // hot corners
  addListener('pointermove', (e) => {
    const c = corners();
    if (!c.on) return;
    const corner = whichCorner(e.x, e.y);
    if (!corner) {
      if (fired) {
        const W = screen.width, H = screen.height;
        const away = (corner === 'tl' || corner === 'bl' ? e.x > LEAVE : e.x < W - 1 - LEAVE)
                  && (corner === 'tl' || corner === 'tr' ? e.y > LEAVE : e.y < H - 1 - LEAVE);
        if (away) fired = '';
      }
      enteredAt = 0;
      return;
    }
    if (fired === corner) return;                  // already fired; wait until the pointer leaves
    const now = Date.now();
    if (!enteredAt) { enteredAt = now; return; }   // just arrived: start the dwell
    if (now - enteredAt >= DWELL) { fired = corner; enteredAt = 0; runAction(c[corner]); }
  });

  // appearance + wallpaper schedule: check once a minute (and right away)
  tick();
  setInterval(tick, 60000);

  // Automatic power mode: on battery → power-saver, back on AC → balanced
  // (settings.autoPowerProfile.on, default on; the user's own choice through the Control
  // Center still applies — this only follows the plug, like macOS does).
  let lastAC = null;
  battery.subscribe(() => {
    const cfg = settings.get().autoPowerProfile;
    if (cfg && cfg.on === false) { lastAC = null; return; }
    const b = battery.get();
    if (!b) return;
    const ac = b.onAC !== false;
    if (lastAC === null) { lastAC = ac; return; }     // never switch at startup
    if (ac === lastAC) return;
    lastAC = ac;
    try { insane.power.setProfile(ac ? 'balanced' : 'power-saver'); } catch { /* ppd missing */ }
  });
}
