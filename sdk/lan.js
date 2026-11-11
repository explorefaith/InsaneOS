// lan.js — Files → Network (docs/FILES.md, "Network"). insane.lan runs one bounded pass over the local
// network, off until the page opens; JS names no address, port or socket there. Mounting a share is
// the closed share-mount action: everything in it is validated again as root.
//
//   lan.available()                              a build with insane.lan
//   lan.start(asked) / lan.stop()                start(): false while one runs or the last is recent
//   lan.poll()                                   { state, running, probed, total, hosts: [...] }
//   lan.mount({ kind, addr, share, user, domain, password })    → the folder it was mounted on
//   lan.unmount(path)
//   lan.saved(kind, addr, share) / lan.remember(...) / lan.forget(...)      the password, in the keyring only
import { admin } from './admin.js';
import { keyring } from './vault.js';

const OWNER = 'files';
const service = (kind, addr, share) => `${kind}://${addr}/${share}`;

export const lan = {
  available: () => typeof insane !== 'undefined' && !!insane.lan,
  start: (asked = false) => insane.lan.start(asked),
  stop: () => insane.lan.stop(),
  poll: () => { try { return JSON.parse(insane.lan.poll()); } catch (e) { return { state: 'idle', running: false, probed: 0, total: 0, hosts: [] }; } },
  // the shares a server shows this user: { state: 'done' | 'denied' | 'off-link' | …, shares }
  async listShares({ addr, user = '', domain = '', password = '' }) {
    if (!insane.lan.listShares(addr, domain, user, password)) return { state: 'failed', shares: [] };
    for (;;) {
      await new Promise((r) => setTimeout(r, 150));
      const s = JSON.parse(insane.lan.listPoll());
      if (s.state !== 'running') return s;
    }
  },
  // sftp, ftp, ftps and WebDAV as a folder, rdp and vnc as a window: { state, package, path }
  // onConfirm(fingerprint) → Promise<bool>: a key or certificate seen for the first time
  async connect({ kind, host, port = 0, user = '', domain = '', password = '', path = '' }, onConfirm) {
    if (!insane.lan.connect(kind, host, port, user, domain, password, path)) return { state: 'refused', package: '', path: '' };
    for (;;) {
      await new Promise((r) => setTimeout(r, 150));
      const s = JSON.parse(insane.lan.connectPoll());
      if (s.state === 'confirm') { insane.lan.connectTrust(s.print, onConfirm ? await onConfirm(s.print) : false); await new Promise((r) => setTimeout(r, 200)); continue; }
      if (s.state !== 'running') return s;
    }
  },
  disconnect: (path) => insane.lan.disconnect(path),
  mount: ({ kind, addr, share, user = '', domain = '', password = '' }) => admin.run('share-mount', [kind, addr, share, user, domain, password].join('\n'), null, { quiet: true }).then((p) => String(p || '').trim()),
  unmount: (path) => admin.run('share-unmount', path, null, { quiet: true }),
  // what was remembered for this share: { user, password }, or null (no keyring, locked, nothing saved)
  async saved(kind, addr, share) {
    try {
      const it = (await keyring.list(OWNER)).find((x) => x.service === service(kind, addr, share));
      if (!it) return null;
      const full = await keyring.get(OWNER, { service: it.service, account: it.account });
      return full ? { user: it.account, password: full.secret } : null;
    } catch (e) { return null; }
  },
  remember: (kind, addr, share, user, password, label) => keyring.set(OWNER, { service: service(kind, addr, share), account: user, secret: password, label }),
  forget: (kind, addr, share, user) => keyring.remove(OWNER, { service: service(kind, addr, share), account: user }).catch(() => {}),
};
