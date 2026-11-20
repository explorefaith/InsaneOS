// crypto.js — the Binance market data for the widgets (phase 4, M5): one fetch per pair shared
// between every widget showing it, through the closed C actions (crypto-ticker / crypto-klines —
// the allowlist and the caps live in server/src/hw/crypto_admin.c). The shell makes no direct
// network calls, and the fetch runs only while at least one crypto widget is placed.
//
//   cryptoData    SYMBOL → { price, change, changePct, high, low, volume, at, stale }
//   cryptoCloses  SYMBOL → { closes: [[ms, close], …], sig }   (the 24 h sparkline)
//
// Refresh every REFRESH_MS, backing off on failures; when a fetch fails the last good data stays
// with stale: true. Never a store write without a real change (the React #185 lesson).
import { createStore } from './store.js';
import { widgetLayout } from './widgetmodel.js';
import { tsLive } from './themestudio.js';
import { admin } from './admin.js';

export const REFRESH_MS = 15000;

export const cryptoData = createStore({});
export const cryptoCloses = createStore({});

export function cryptoPairs() {
  const classic = (widgetLayout.get() || []).filter((w) => w.type === 'crypto').map((w) => (w.cfg && w.cfg.pair) || '');
  const studio = (tsLive.get().widgets || []).filter((w) => w.kind === 'crypto-price' || w.kind === 'crypto-ticker').map((w) => (w.cfg && w.cfg.pair) || '');
  return [...new Set([...classic, ...studio].filter(Boolean))];
}

let iv = 0, want = 0, fails = 0, skip = 0;
const busy = {};

function markStale(sym) {
  const d = cryptoData.get()[sym];
  if (d && !d.stale) cryptoData.set((s) => ({ ...s, [sym]: { ...d, stale: true } }));
}

function refreshData(pairs) {
  for (const sym of pairs) {
    if (busy[sym]) continue;
    busy[sym] = 1;
    admin.run('crypto-ticker', sym).then((ans) => {
      delete busy[sym];
      fails = 0; skip = 0;
      try {
        const d = JSON.parse(ans);
        const prev = cryptoData.get()[sym] || {};
        if (prev.price === d.price && prev.at && Date.now() - prev.at < REFRESH_MS * 2) return;   // no change, no write
        cryptoData.set((s) => ({ ...s, [sym]: { ...d, at: Date.now(), stale: false } }));
      } catch { /* an unreadable answer: the next tick retries */ }
    }, () => {
      delete busy[sym];
      fails++; skip = Math.min(fails, 4);            // the backoff: 15 s, 30 s, 45 s, 60 s
      markStale(sym);
    });
  }
}

function refreshCloses(sym) {
  admin.run('crypto-klines', sym).then((ans) => {
    try {
      const d = JSON.parse(ans);
      const prev = cryptoCloses.get()[sym];
      const sig = JSON.stringify(d.closes || []);
      if (prev && prev.sig === sig) return;          // no change, no write
      cryptoCloses.set((s) => ({ ...s, [sym]: { closes: d.closes || [], sig } }));
    } catch { /* retry next cycle */ }
  }, () => { /* the rates above carry the failure */ });
}

function tick() {
  if (skip > 0) { skip--; return; }                  // the backoff
  const pairs = cryptoPairs();
  if (!pairs.length) return;
  refreshData(pairs);
  refreshCloses(pairs[0]);                           // the closes: the first pair per cycle
}

export function cryptoStart() {
  want++;
  if (iv) return;
  iv = setInterval(tick, REFRESH_MS);
  tick();
}
export function cryptoStop() {
  want = Math.max(0, want - 1);
  if (!want && iv) { clearInterval(iv); iv = 0; }
}
