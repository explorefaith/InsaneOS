// soundfx.js — the system sound effects layer (round 4): short synthesized feedback for desktop
// events, played through the compositor's own samples (server/src/sound/snd.c: shutter, trash,
// plug, unplug, plus the older pop/notify/error/chime). Every play goes through here so the
// settings gate sits in one place:
//
//   settings.soundFx = {
//     on: true,          // the master switch (Settings → Sound → Sound Effects)
//     volume: 0.7,       // the effects' own level against the system volume
//     screenshot: true, trash: true, power: true, notify: true, startup: true,
//     minimize: false, launch: false,      // the chatty ones: opt-in
//   }
//
// Mute and the output device are PulseAudio's own (media.role=event); a failed play never
// throws into the caller — the desktop keeps working without sound.
import { settings } from './settings.js';

const DEFAULTS = { on: true, volume: 0.7, screenshot: true, trash: true, power: true, notify: true, startup: true, minimize: false, launch: false };

export function soundFxPrefs() {
  const fx = settings.get().soundFx;
  return { ...DEFAULTS, ...(fx && typeof fx === 'object' ? fx : {}) };
}

export function playFx(name) {
  const fx = soundFxPrefs();
  if (!fx.on) return false;
  if (name in DEFAULTS && name !== 'on' && name !== 'volume' && fx[name] === false) return false;
  try { return !!insane.sound.play(name, fx.volume); } catch (e) { return false; }   // an older server or no sound yet
}

// Minimize and restore (opt-in: soundFx.minimize): one watcher over the windows store, started by
// the shell only (smooth.js's startShell) — an isolated app's own store never plays these, so a
// window change is one sound, not one per process. "pop", the softest sample there is.
import { windows } from './windows.js';
let watched = false;
export function watchWindowFx() {
  if (watched) return;
  watched = true;
  const prev = new Map();
  windows.subscribe(() => {
    const ws = windows.get();                            // subscribers get no argument (store.js)
    const fx = soundFxPrefs();
    if (!fx.minimize) { for (const w of ws) prev.set(w.id, !!w.minimized); return; }
    for (const w of ws) {
      const was = prev.get(w.id);
      prev.set(w.id, !!w.minimized);
      if (was !== undefined && was !== !!w.minimized) playFx('pop');
    }
    for (const id of [...prev.keys()]) if (!ws.some((w) => w.id === id)) prev.delete(id);
  });
}
