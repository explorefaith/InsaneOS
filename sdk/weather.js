// weather.js — the desktop's weather: real data from Open-Meteo through the weather-get admin
// action (server/src/hw/weather_admin.c), never invented numbers.
//
// Consent first: the tile asks once (settings.weatherConsent: null = not asked, true, false) — the
// mission's rule for anything online. The last answer is cached for 30 minutes in
// settings.weatherCache and shown while a refresh runs, so an offline moment degrades to the cached
// truth or to "unavailable" — never to fake states. The place is a fixed default (Dhaka) until
// Settings → Weather offers editing; the fetch itself is one closed root action with the host
// hard-coded on the C side.
import { createStore, useStore } from './store.js';
import { settings } from './settings.js';
import { admin } from './admin.js';
import { read } from './fs.js';

export const WEATHER_PLACE_DEFAULT = { name: 'Dhaka', lat: 23.8103, lon: 90.4125 };
const WEATHER_TTL = 30 * 60 * 1000;

// open-meteo's WMO codes folded into the six words the tile knows (i18n keys shell.weather.cond.*)
export function weatherGroup(code) {
  if (code == null) return 'clear';
  if (code <= 1) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  return 'storm';                                       // 95–99
}

export const weather = createStore({ state: 'idle' });  // idle | consent | loading | ok | error
let fetching = null;                                    // one fetch at a time

function applyCache(stale = false) {
  const c = settings.get().weatherCache;
  if (c?.data) weather.set({ state: 'ok', data: c.data, stale });
  else weather.set({ state: stale ? 'error' : 'loading' });
}

export async function weatherRefresh(force = false) {
  const s = settings.get();
  if (s.weatherConsent !== true) { weather.set({ state: 'consent' }); return; }
  const c = s.weatherCache;
  if (!force && c && Date.now() - c.ts < WEATHER_TTL) { weather.set({ state: 'ok', data: c.data }); return; }
  if (c?.data) weather.set({ state: 'ok', data: c.data, stale: true });
  else weather.set({ state: 'loading' });
  if (fetching) return;
  fetching = (async () => {
    try {
      const p = s.weatherPlace || WEATHER_PLACE_DEFAULT;
      const name = await admin.run('weather-get', `${p.lat},${p.lon}`, null, { quiet: true });
      if (name !== 'weather.json') throw new Error('weather.badReply');
      const txt = await read(`.cache/insaneos/${name}`);
      const data = JSON.parse(txt);
      if (!data || !data.current || !Number.isFinite(data.current.temperature_2m)) throw new Error('weather.badData');
      settings.set({ weatherCache: { ts: Date.now(), data } });
      weather.set({ state: 'ok', data });
    } catch {
      const c2 = settings.get().weatherCache;
      weather.set(c2?.data ? { state: 'ok', data: c2.data, stale: true } : { state: 'error' });
    } finally {
      fetching = null;
    }
  })();
}

// the tile's choice: allow (fetches now) or decline (never fetches; the tile stays quiet)
export function weatherConsent(on) {
  settings.set({ weatherConsent: !!on });
  if (on) weatherRefresh();
  else weather.set({ state: 'idle' });
}

export function useWeather() {
  return useStore(weather);
}
