// fs.js — files in the home folder and on the user's mounted disks (/media/$USER,
// /run/media/$USER); the server rejects paths outside them. Writing is atomic and cannot touch
// ~/.local/share/applications, ~/.config/autostart, ~/.local/share/insaneos/apps or
// ~/.config/insaneos/settings.json (see server/src/ui/js_sys.c and server/src/fsops.c).
import { useEffect, useState } from 'react';
import { codeError } from './errors.js';
import { remoteOf } from './mountmodel.js';

export const home = () => insane.fs.home();

export function list(path, { hidden = false } = {}) {
  const entries = insane.fs.list(path).filter((e) => hidden || !e.name.startsWith('.'));
  return entries.sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name));
}

export const join = (...parts) => parts.filter(Boolean).join('/').replace(/\/+/g, '/');
export const parent = (path) => path.split('/').slice(0, -1).join('/');
export const basename = (path) => String(path).split('/').filter(Boolean).pop() || '/';

// Paths relative to the home folder: '' = home.
export function useDirectory(path, options) {
  const [state, setState] = useState({ entries: [], error: null });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    try { setState({ entries: list(path || '.', options), error: null }); }
    catch (e) { setState({ entries: [], error: e.message }); }
  }, [path, version, options?.hidden]);
  return { ...state, reload: () => setVersion((v) => v + 1) };
}

// Contents of a file (max. 8 MB): UTF-8 text or, with { binary: true }, an ArrayBuffer.
export const read = (path, { binary = false } = {}) => insane.fs.read(path, binary ? 'binary' : 'text');

// Creates or replaces a file (text or ArrayBuffer, up to 32 MB). Keeps the permissions.
export const write = (path, data) => insane.fs.write(path, data);
export const mkdir = (path) => insane.fs.mkdir(path);
// Move or rename on the same disk (doesn't overwrite). Across disks, move() with a job.
export const rename = (from, to) => insane.fs.rename(from, to);

// Copy and move in the background (a server thread): they return the job id; the
// progress is read with jobs() → [{ id, src, dst, move, done, failed, error, bytes, total, files }].
// Recursive, keeps permissions and dates, doesn't overwrite and copies links as links.
export const copy = (from, to) => insane.fs.copy(from, to, false);
export const move = (from, to) => insane.fs.copy(from, to, true);
export const jobs = () => insane.fs.jobs();
export const cancelJob = (id) => insane.fs.jobCancel(id);
export const forgetJob = (id) => insane.fs.jobForget(id);

// Trash (freedesktop: ~/.local/share/Trash, and $mount/.Trash-$uid on disks).
// Permanent deletion is only possible inside the Trash.
export const trash = (path) => insane.fs.trash(path);
export const trashList = () => insane.fs.trashList();          // [{ id, name, original, deleted, dir, size }]
export const restore = (id) => insane.fs.restore(id);
export const removeFromTrash = (id) => insane.fs.removeFromTrash(id);
export const emptyTrash = () => insane.fs.emptyTrash();

// Info: { name, path, dir, link, target, size, mode, user, group, mtime, atime, ctime, btime, writable }
export const stat = (path) => insane.fs.stat(path);
export const du = (path, ms) => insane.fs.du(path, ms);          // { size, files, dirs, complete } (bounded)
export const free = (path) => insane.fs.free(path);              // { total, free } of the disk
export const search = (dir, text, opts) => insane.fs.search(dir, text, opts);   // by name, no hidden files
export const recent = (limit = 60, days = 30) => insane.fs.recent(limit, days);
export const volumes = () => insane.fs.volumes();                // [{ path, name, fs, total, free }]

// ---- off the interface's thread (server/src/fsasync.c, 0.8.8.7) ----
// A folder on a Cloud account (rclone), a Connect to Server or SMB/NFS share answers when its server does: the calls
// above would hold the whole desktop until then. These run on insane-server's workers, with the same checks, and answer
// with a Promise; an error is an Error with `code` and `params` (errors.js). isRemote(path) says which folders need
// them (from the mount table, without touching the path). Isolated apps without them fall back to the calls above.
const waiting = new Map();          // req → settle(answer)
globalThis.__insaneFsReply = (req, res) => {
  const done = waiting.get(req);
  if (done) { waiting.delete(req); done(res); }
};
function later(fn, sync, path) {
  if (typeof insane.fs[fn] !== 'function') return Promise.resolve().then(() => sync(path));
  let req;
  try { req = insane.fs[fn](path); } catch (e) { return Promise.reject(e); }
  return new Promise((resolve, reject) => waiting.set(req, (r) => (r && r.error ? reject(codeError(r.error)) : resolve(r || {}))));
}
// [{ name, link, dir, locked?, size, mtime, mode, user, group, atime, ctime }] (as insane.fs.list, with what the list
// view's columns would ask insane.fs.stat for)
export const listAsync = (path) => later('listAsync', (p) => ({ entries: insane.fs.list(p) }), path).then((r) => r.entries || []);
export const statAsync = (path) => later('statAsync', (p) => ({ stat: insane.fs.stat(p) }), path).then((r) => r.stat);
export const trashAsync = (path) => later('trashAsync', (p) => ({ ok: insane.fs.trash(p) }), path).then(() => true);
export const freeAsync = (path) => later('freeAsync', (p) => insane.fs.free(p), path).then((r) => ({ total: r.total, free: r.free }));
export const mkdirAsync = (path) => later('mkdirAsync', (p) => ({ ok: insane.fs.mkdir(p) }), path).then(() => true);
export function renameAsync(from, to) {
  if (typeof insane.fs.renameAsync !== 'function') return Promise.resolve().then(() => insane.fs.rename(from, to));
  let req;
  try { req = insane.fs.renameAsync(from, to); } catch (e) { return Promise.reject(e); }
  return new Promise((resolve, reject) => waiting.set(req, (r) => (r && r.error ? reject(codeError(r.error)) : resolve(true))));
}
// the mount table, read at most once a second (a string match per question after that: Files asks per row)
let mounts = null, mountsAt = 0;
export function isRemote(path) {
  if (!path || typeof path !== 'string' || typeof insane.fs.mounts !== 'function') return false;
  const now = Date.now();
  if (!mounts || now - mountsAt > 1000) {
    try { mounts = insane.fs.mounts(); } catch (e) { mounts = []; }
    mountsAt = now;
  }
  const full = path.startsWith('/') ? path : `${home()}/${path}`;
  return remoteOf(full, mounts);
}
