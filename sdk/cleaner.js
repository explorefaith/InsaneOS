// cleaner.js — Cleaner's native API (insane.clean, docs/CLEANER-ARCHITECTURE.md).
//
//   cleaner.available()                  the sandboxed scanner is installed
//   cleaner.start(kind, opts)            a new scan ('rules', 'tree', 'dups' or 'images'): its id
//   cleaner.poll(kind)                   { job, state, error, scan, plan, emptied }: real counters
//   cleaner.volumes() / tree / groups    what a tree or a duplicates scan found
//   cleaner.restore(planId, id)          back from the Trash; history() / clearHistory(); emptyTrash()
//   cleaner.cancel(forget)               stops the job; forget also drops the results
//   cleaner.results(scanId | 'plan', offset, limit, filter) a page of { id, rule, path, size, allocated, … }
//   cleaner.plan(scanId, ids)            a plan, built and checked in insane-server: its id
//   cleaner.execute(planId)              runs it once
//   cleaner.status()                     { available, free, total }
//
// JS holds candidate ids and display paths only: authority stays in C and is never a path. Calls
// throw translated errors (sdk/errors.js).
const has = () => typeof insane !== 'undefined' && !!insane.clean;

export const cleaner = {
  available: () => {
    if (!has()) return false;
    try { return insane.clean.status().available; } catch (e) { return false; }
  },
  status: () => (has() ? insane.clean.status() : { available: false, free: -1, total: -1 }),
  start: (kind, opts) => (kind ? insane.clean.start(kind, opts || {}) : insane.clean.start()),
  poll: (kind) => (has() ? insane.clean.poll(kind) : null),
  volumes: () => (has() ? insane.clean.volumes() : []),
  tree: (scanId, node, limit) => insane.clean.tree(scanId, node, limit),
  groups: (scanId, offset, limit) => insane.clean.groups(scanId, offset, limit),
  restore: (planId, id) => insane.clean.restore(planId, id),
  history: () => (has() ? insane.clean.history() : []),
  clearHistory: () => insane.clean.clearHistory(),
  noteSystem: (name, before) => insane.clean.noteSystem(name, before),
  saved: () => (has() ? insane.clean.saved() : null),
  forgetSaved: () => insane.clean.forgetSaved(),
  emptyTrash: () => insane.clean.emptyTrash(),
  cancel: (forget) => { if (has()) insane.clean.cancel(!!forget); },
  results: (source, offset, limit, filter) => insane.clean.results(source, offset, limit, filter),
  plan: (scanId, ids) => insane.clean.plan(scanId, ids),
  execute: (planId) => insane.clean.execute(planId),
};
