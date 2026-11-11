// updates.js — updating Insane OS in place (docs/UPDATES.md).
//
//   insaneosUpdate(lang)   { installed, version, available, size, notes } of the insaneos package, or null
//   insaneosUpdateWaiting() true when the last check found a newer insaneos package
//   restartNeeded()      null, or { packages: [...] } when an installed update needs a restart
//   updatePrefs()        { autoCheck } (settings.json "updates"); setUpdatePrefs({ autoCheck })
//
// The packages come from the signed Insane OS repository on insaneos.org (and Debian's), through our own
// package engine (insane.pkg, admin.run('pkg-update' | 'pkg-install' | 'pkg-upgrade')). The optional
// daily check only downloads the signed lists and notifies; it never installs anything.
import { settings } from './settings.js';
import { admin } from './admin.js';
import { notify } from './notify.js';
import { t } from './i18n.js';
import { wm } from './windows.js';
import { insaneosVersion } from './system.js';

const has = () => typeof insane !== 'undefined' && !!insane.pkg && typeof insane.pkg.rebootRequired === 'function';

export const UPDATE_DEFAULTS = { autoCheck: true, notified: '' };
export const updatePrefs = (s = settings.get()) => ({ ...UPDATE_DEFAULTS, ...(s.updates || {}) });
export function setUpdatePrefs(patch) {
  settings.set((s) => ({ ...s, updates: { ...updatePrefs(s), ...patch } }));
}

// The insaneos package: what is installed, the newest version offered and its release notes.
export function insaneosUpdate(lang) {
  if (!has() || !insane.pkg.available()) return null;
  const info = insane.pkg.info('insaneos', { lang });
  if (!info || !info.installed) return null;
  const offered = (info.versions || []).find((v) => v.version === info.version);
  return {
    installed: info.installed,
    version: info.version,
    available: !!info.upgradable,
    size: offered ? offered.size : info.size,
    notes: info.upgradable ? insane.pkg.releaseNotes('insaneos', info.version) : null,
  };
}

// Is a newer insaneos package waiting? The signed lists' last check, read when asked: nothing is fetched here.
export function insaneosUpdateWaiting() {
  if (!has() || !insane.pkg.available()) return false;
  const info = insane.pkg.info('insaneos');
  return !!(info && info.installed && info.upgradable);
}

// A restart is needed when a package asked for one (/run/reboot-required: a new kernel, or the
// insaneos postinst) or when the installed Insane OS is not the one running in this session.
export function restartNeeded() {
  if (!has()) return null;
  const asked = insane.pkg.rebootRequired() || null;
  let changed = false;
  if (insane.pkg.available()) {
    const installed = insane.pkg.info('insaneos')?.installed;
    const running = insaneosVersion().version;
    changed = !!installed && !!running && installed !== running;
  }
  if (!asked && !changed) return null;
  const packages = [...new Set([...(asked || []), ...(changed ? ['insaneos'] : [])])];
  return { packages };
}

// ---- the daily check (on by default, Store → Updates turns it off) ----

const DAY = 24 * 3600;
// A short fingerprint of what can be upgraded, to notify once per new set of updates.
function fingerprint(ups) {
  let h = 5381;
  for (const s of ups.map((u) => `${u.name}=${u.to}`).sort().join(',')) h = ((h * 33) ^ s.charCodeAt(0)) >>> 0;
  return ups.length ? `${ups.length}:${h.toString(36)}` : '';
}

function maybeNotify() {
  const ups = insane.pkg.upgrades();
  const key = fingerprint(ups);
  if (!key || key === updatePrefs().notified) return;
  setUpdatePrefs({ notified: key });
  const own = ups.find((u) => u.name === 'insaneos');
  const open = [{ id: 'open', label: t('store.notify.open'), run: () => wm.open('store', { args: { page: 'updates' } }) }];
  notify({
    app: 'store',
    title: own ? t('store.notify.insaneosTitle', { version: own.to }) : t('store.notify.title', { count: ups.length }),
    body: own ? t('store.notify.insaneosBody') : t('store.notify.body'),
    actions: open,
  });
}

let checking = false;
function check() {
  // No readable package list (a new install, or an update that changed its format): build it now,
  // even with the daily check off, or the Store shows only the Insane OS catalog until someone checks.
  const missing = !insane.pkg.available();
  if (checking || !admin.available() || (!missing && !updatePrefs().autoCheck)) return;
  const last = insane.pkg.available() ? insane.pkg.lastUpdate() : 0;
  if (Date.now() / 1000 - last < DAY - 600) return;
  checking = true;
  admin.run('pkg-update', '', null, { quiet: true })
    .then(maybeNotify, () => { /* offline or busy: the next hour tries again */ })
    .finally(() => { checking = false; });
}

// Only in a user's desktop session (not the login screen or an isolated app's process).
if (has() && typeof insane.admin !== 'undefined' && typeof insane.greeter === 'undefined') {
  setTimeout(() => { check(); setInterval(check, 3600 * 1000); }, insane.pkg.available() ? 5 * 60 * 1000 : 20 * 1000);
}
