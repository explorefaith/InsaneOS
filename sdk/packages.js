// packages.js — native Insane OS apps installed as a package (.lpk; see docs/NATIVE-APPS.md).
//
// A package brings its app already bundled (tools/lpk.mjs) without React or the SDK inside: it uses
// the theme's, which are shared here through globalThis.__insaneos.require(). The app is only loaded
// when its first window opens.
//
//   packages.list()                 → [{ id, name, version, description, permissions, size… }]
//   await packages.inspect(path)    → { manifest, files, size }   (before installing, to confirm)
//   packages.install(path) / packages.remove(id)
//   const { instance } = await loadWasm('fractal', 'mandel.wasm', imports)   // from the app
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import * as runtime from '@insaneos/runtime';
import * as sdk from './index.js';
import { createStore } from './store.js';
import { locale } from './i18n.js';
import { setPackageApps, windows, wm, appIdOf } from './windows.js';
import { iconFromFile, refreshApps } from './apps.js';
import { admin } from './admin.js';
import { forgetShareGrants } from './share.js';
import { settings } from './settings.js';
import { perms } from './privacy.js';

const h = React.createElement;
const shared = {
  react: React, 'react/jsx-runtime': jsxRuntime, '@insaneos/runtime': runtime, '@insaneos/sdk': sdk,
};
globalThis.__insaneos = {
  require(name) {
    if (!(name in shared)) throw new Error(`module not available to installed apps: ${name}`);
    return shared[name];
  },
};

const has = () => typeof insane.apps !== 'undefined' && typeof insane.apps.packages === 'function';
const loaded = new Map();               // id → { default, Icon } | { error }

function load(id) {
  if (!loaded.has(id)) {
    try {
      const mod = insane.apps.loadPackage(id);
      loaded.set(id, mod && typeof mod.default === 'function' ? mod : { error: 'app.js no exporta un componente' });
    } catch (e) { loaded.set(id, { error: String(e?.message || e) }); }
  }
  return loaded.get(id);
}

// With app mode (insane-server --app), an .lpk app is NEVER evaluated in the theme's context: if something
// opens its window in-process (wm.open, the Dock's «New window»…), the isolated process is launched and
// this empty window is closed. See docs/PRIVACY.md.
const isolated = () => typeof insane.apps !== 'undefined' && typeof insane.apps.launchPackage === 'function';

function Redirect({ id }) {
  const win = sdk.useAppWindow();
  React.useEffect(() => {
    // already running: a plain open focuses its window; «New window» (wm.open(id, { new: true }))
    // asks the running process for another window (insane-server forwards it over the broker)
    const running = windows.get().filter((w) => w.args?.pkg && w.args?.appId === id);
    const wantsNew = win && win.id && String(win.id).includes('#');
    if (running.length && !wantsNew) wm.focus(running[running.length - 1].id);
    else insane.apps.launchPackage(id);
    if (win && win.id) wm.close(win.id, true);
  }, []);
  return null;
}

// A built-in app that runs as its own sandboxed process (manifest "process": "isolated", shipped as
// <assets>/sysapps/<id>, see tools/build-theme.mjs): opening its window in the theme starts the
// process instead and closes this placeholder. Without app mode (or without the built system
// package) the app runs in-process as before.
export function isolatedApp(id, Fallback) {
  return function IsolatedApp(props) {
    const win = sdk.useAppWindow();
    const [inproc, setInproc] = React.useState(false);
    React.useEffect(() => {
      const running = windows.get().filter((w) => w.args?.pkg && w.args?.appId === id);
      // what the window was opened with (a notification's "Open", the Dock's "New message", another
      // app's link) goes to the app process: now if it runs, or when it starts (insane.broker.openArgs)
      // a single-window app (manifest "singleWindow": Passwords holds one vault view) only gets focused
      const wantsNew = !!(win && win.id && String(win.id).includes('#')) && !sdk.getApp(id)?.singleWindow;
      const { nonce, ...args } = win?.args || {};
      const hasArgs = Object.keys(args).length > 0;
      const forward = () => { if ((hasArgs || wantsNew) && insane.broker && typeof insane.broker.openArgs === 'function') insane.broker.openArgs(id, JSON.stringify(args), wantsNew); };
      if (globalThis.__insaneTiming && insane.now) {
        const t0 = sdk.openedAt?.get(win?.id);
        console.log(`timing: ${id} isolated launch at ${insane.now().toFixed(1)} ms (monotonic)${t0 != null ? `, ${(insane.now() - t0).toFixed(1)} ms after wm.open at ${t0.toFixed(1)}` : ''}`);
      }
      if (isolated() && running.length) {
        forward();
        if (!wantsNew) wm.focus(running[running.length - 1].id);
        if (win && win.id) wm.close(win.id, true);
      } else if (isolated() && insane.apps.launchPackage(id)) { forward(); if (win && win.id) wm.close(win.id, true); }
      else setInproc(true);
    }, []);
    React.useEffect(() => {               // developer timing of the in-process fallback
      const t0 = inproc && globalThis.__insaneTiming ? sdk.openedAt?.get(win?.id) : null;
      if (t0 != null) { sdk.openedAt.delete(win.id); console.log(`timing: ${id} in-process window committed ${(insane.now() - t0).toFixed(1)} ms after wm.open`); }
    }, [inproc]);
    return inproc && Fallback ? h(Fallback, props) : null;
  };
}

function lazyComponent(id) {
  return function PackageApp(props) {
    if (isolated()) return h(Redirect, { id });
    const mod = load(id);
    if (mod.error) {
      return h(runtime.View, { style: { flex: 1, padding: 20 } },
        h(runtime.Text, { style: { fontSize: 13, color: '#ff453a' } }, sdk.t('shell.packages.loadError', { error: mod.error })));
    }
    return h(mod.default, props);
  };
}

const localized = (v, lang) => (v && typeof v === 'object' ? v[lang] || v[lang.split('-')[0]] || v.en || Object.values(v)[0] : v) || '';

export const packageList = createStore([]);

function read() {
  if (!has()) return [];
  const lang = locale.get().lang;
  const out = [];
  for (const p of insane.apps.packages()) {
    let m;
    try { m = JSON.parse(p.manifest); } catch (e) { continue; }
    if (m.id !== p.id) continue;
    const name = localized(m.name, lang) || p.id;
    out.push({
      id: p.id, name, version: String(m.version || ''), description: localized(m.description, lang),
      permissions: Array.isArray(m.permissions) ? m.permissions.map(String) : [],
      size: Array.isArray(m.size) ? m.size : [640, 420], minSize: Array.isArray(m.minSize) ? m.minSize : undefined,
      transparent: !!m.transparent, dock: false, package: true, packaged: !!p.packaged, dir: p.dir, category: typeof m.category === 'string' ? m.category : undefined,
      Icon: iconFromFile(m.icon ? `${p.dir}/${m.icon}` : '', name), Component: lazyComponent(p.id),
    });
  }
  return out;
}

export function refreshPackages() {
  const list = read();
  packageList.set(list);
  setPackageApps(list);
}

export const packages = {
  list: () => packageList.get(),
  inspect: (path) => insane.apps.inspectPackage(path),
  install(path) {
    const r = insane.apps.installPackage(path);
    loaded.delete(r.manifest.id);       // a new version is reloaded when opened
    for (const w of windows.get()) if (appIdOf(w.id) === r.manifest.id) wm.close(w.id, true);
    refreshPackages();
    return r;
  },
  remove(id) {
    for (const w of windows.get()) if (appIdOf(w.id) === id) wm.close(w.id, true);
    const ok = insane.apps.removePackage(id);
    loaded.delete(id);
    refreshPackages();
    if (ok) forgetShareGrants(id);      // a reinstalled app asks again
    return ok;
  },
};

// Uninstall from the shell (the launcher's context menu). A .lpk package removes itself
// (packages.remove — its windows close with it); a Linux app removes the Debian package that
// brought it, through the administration helper, with progress. The built-in apps are part of
// Insane OS: never removable (docs/SIGNING.md, "Verified system code"). A .lpk that arrived
// inside a Debian package is that package's business — the Store draws the same line. A Linux
// app without a package behind it (a bare .desktop) has no uninstall path here.
const owningPackage = (a) => {
  if (typeof insane.pkg === 'undefined' || !insane.pkg.available()) return null;
  const want = new Set([a.desktopId, `${a.desktopId}.desktop`]);
  try { return insane.pkg.installed({}).find((p) => p.app && want.has(p.app.id))?.name || null; }
  catch (e) { return null; }
};

// 'package' | 'linux' | null — what the context menu may offer for this launcher entry.
export function canUninstall(a) {
  if (a.kind === 'package') return a.packaged ? null : 'package';
  if (a.kind === 'linux') return owningPackage(a) ? 'linux' : null;
  return null;
}

// Removes the app without blocking the interface: resolves { ok, error } when finished.
// onProgress({ phase, done, total }) rides the helper's "progress <phase> <done> <total>" lines
// (server/src/pkg/pkg.c) — the same lines the Store's job view shows.
export function uninstallApp(a, onProgress) {
  return new Promise((resolve) => {
    const kind = canUninstall(a);
    if (!kind) return resolve({ ok: false, error: 'uninstall.unsupported' });
    if (kind === 'package') {
      try { packages.remove(a.id); } catch (e) { return resolve({ ok: false, error: String(e?.message || e) }); }
      return resolve({ ok: true });
    }
    const name = owningPackage(a);
    if (!name) return resolve({ ok: false, error: 'uninstall.unsupported' });
    const onLog = (line) => {
      const m = /^progress (\w+) (\d+) (\d+)$/.exec(line);
      if (m && onProgress) onProgress({ phase: m[1], done: Number(m[2]), total: Number(m[3]) });
    };
    admin.run('pkg-remove', name, onLog).then(
      () => { refreshApps(); refreshPackages(); resolve({ ok: true }); },
      (e) => resolve({ ok: false, error: String(e?.message || e) }),
    );
  });
}

// dpkg removes a packaged app behind the shell's back, so the shell keeps the ids it has seen and forgets the permissions
// of those gone (a grant is forgotten by the share sweep). The app's data stays, as it does for every app.
export function forgetGonePackaged() {
  const now = packageList.get().filter((p) => p.packaged).map((p) => p.id);
  const seen = Array.isArray(settings.get().packagedSeen) ? settings.get().packagedSeen : [];
  for (const id of seen) {
    if (now.includes(id)) continue;
    for (const row of perms.list()) if (row.app === id && row.state !== 'ask') perms.set(id, row.perm, 'ask');
  }
  const next = [...now].sort();
  if (JSON.stringify(next) !== JSON.stringify(seen)) settings.set({ packagedSeen: next });
}

// File of an installed app (ArrayBuffer) and its already instantiated WebAssembly module.
export const packageFile = (appId, path) => insane.apps.packageFile(appId, path);
export function loadWasm(appId, path, imports = {}) {
  if (typeof WebAssembly === 'undefined') return Promise.reject(new Error('WebAssembly is not available'));
  return WebAssembly.instantiate(packageFile(appId, path), imports);
}

locale.subscribe(refreshPackages);
