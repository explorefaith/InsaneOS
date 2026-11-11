// powerbox.jsx — the open/save file dialog is drawn by insane-server (not the app), as
// a «powerbox»: the isolated app doesn't see the home folder; it only receives the fd
// of the file the user picks here. See docs/PRIVACY.md and server/src/sec/brokersrv.c.
//
// In the theme (compositor) process: insane-server notifies with __insaneBrokerPick(reqid, app, save,
// suggest); the dialog is shown and, with the choice, insane.broker.pickResult(reqid,
// path) is called. In the app process: the SDK offers fs.openFile()/fs.saveFile().
import { createElement as h } from 'react';
import { View, Text, mainBox } from '@insaneos/runtime';
import { createStore, useStore } from './store.js';
import { useLocale, appName } from './i18n.js';
import { FilePicker } from './filepicker.jsx';
import { getApp } from './windows.js';

const queue = createStore([]);           // [{ reqid, app, save, suggest }]
let seq = 1;

if (typeof globalThis !== 'undefined') {
  globalThis.__insaneBrokerPick = (reqid, app, save, suggest) => {
    queue.set((q) => [...q, { key: seq++, reqid, app, save: !!save, suggest: suggest || '' }]);
  };
}

function finish(item, path) {
  queue.set((q) => q.filter((x) => x.key !== item.key));
  try { insane.broker.pickResult(item.reqid, path || ''); } catch (e) { /* server without broker */ }
}

// The same dialog as everywhere else (filepicker.jsx, drawn like Files): the home folder and the local disks
// mounted for the user. Saving asks before replacing a file, since insane-server opens it with O_TRUNC.
function Picker({ item }) {
  const { t: tr } = useLocale();
  const app = appName(getApp(item.app)) || item.app;
  const title = item.save ? tr('powerbox.saveTitle', { app }) : tr('powerbox.openTitle', { app });
  return (
    h(View, { style: { position: 'absolute', ...mainBox(), alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 100000 } },
    h(View, { style: { position: 'relative', width: 920, maxWidth: '96%', height: 620, maxHeight: '94%' } },
      h(FilePicker, { modal: true, mode: item.save ? 'save' : 'open', name: item.save ? (item.suggest || '') : '', title,
        onClose: () => finish(item, ''), onPick: (path) => finish(item, Array.isArray(path) ? path[0] : path) })))
  );
}

// Mounted in the shell (LocaleRoot). Shows one dialog at a time.
export function Powerbox() {
  const q = useStore(queue);
  if (!q.length) return null;
  return h(Picker, { item: q[0], key: q[0].key });
}

// ---- app side: fs.openFile() / fs.saveFile() ----
const inApp = () => typeof insane !== 'undefined' && insane.broker && typeof insane.broker.pick === 'function';

export async function openFile() {
  if (!inApp()) throw new Error('the file dialog only exists in an isolated app');
  const r = insane.broker.pick(false, '');          // blocks until the user chooses (system modal)
  if (!r) return null;
  const data = insane.broker.fdRead(r.fd);
  insane.broker.fdClose(r.fd);
  return { name: r.name, arrayBuffer: () => data, text: () => new TextDecoder().decode(data) };
}

export async function saveFile(suggestedName, data) {
  if (!inApp()) throw new Error('the file dialog only exists in an isolated app');
  const r = insane.broker.pick(true, suggestedName || 'untitled.txt');
  if (!r) return false;
  const buf = typeof data === 'string' ? new TextEncoder().encode(data).buffer : data;
  const ok = insane.broker.fdWrite(r.fd, buf);
  insane.broker.fdClose(r.fd);
  return { name: r.name, ok };
}
