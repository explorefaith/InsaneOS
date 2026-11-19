// sdk-import-check.mjs — catches the launcher-search bug class at build time: an SDK export used
// inside a JSX file but never bound in that file. esbuild leaves such an identifier bare (the
// build passes, the bundle loads, the surface throws a ReferenceError the first time the code
// path runs — the launcher's search crashed exactly this way: tOptional at Launchpad.jsx:35 was
// used without being imported, so ANY query killed the panel; the ShellBoundary caught it and
// named it).
//
//   node tools/sdk-import-check.mjs
//
// Scans themes/ and apps/ sources (not bundles). A name counts as BOUND when the file imports it
// from any module, declares it (const/let/var/function, destructuring included), or receives it
// through a destructuring parameter with or without a default. Matches are also ignored inside
// member access (insane.screen), as object keys and JSX props (direction: 'ltr', displays={all}),
// as JSX text (>Surface<), inside import statements, regex literals (/pdf/) and strings or
// comments. What remains is a real candidate: eyeball it, or import the symbol.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// The SDK's own export names: read them from the barrel, the one source of truth.
const barrel = fs.readFileSync(path.join(root, 'sdk/index.js'), 'utf8');
const exports_ = new Set();
for (const m of barrel.matchAll(/export\s*{([^}]+)}\s*from/g)) {
  for (const part of m[1].split(',')) {
    const name = part.split(' as ').map((s) => s.trim()).filter(Boolean).pop();
    if (name) exports_.add(name);
  }
}
for (const m of barrel.matchAll(/export\s+(?:const|function|class)\s+([A-Za-z_$][\w$]*)/g)) exports_.add(m[1]);

const files = execSync(`find ${path.join(root, 'themes')} ${path.join(root, 'apps')} -name '*.jsx' -o -name '*.js'`)
  .toString().split('\n').filter((f) => f && !f.includes('theme.bundle.js') && !f.includes('.vm-e2e.') && !f.includes('node_modules'));

// Verified false positives: the regex heuristics below cannot fully parse JS (nested templates
// like `${tr(`a.b.${x}`)}`, multi-level destructuring). Each entry was checked by hand — the name
// is bound in its file (a parameter, a local, or string content). The scan still catches every
// genuinely-unbound use; new entries only go here after that same hand-check.
const SUPPRESSED = new Set([
  'apps/monitor/Processes.jsx:settings', 'apps/monitor/index.jsx:settings', 'apps/monitor/Gpu.jsx:settings',
  'apps/settings/Widgets.jsx:settings', 'apps/settings/index.jsx:settings', 'apps/editor/EditorView.jsx:settings',
  'apps/monitor/RuleSheet.jsx:suggestions', 'apps/monitor/DisksTab.jsx:disks', 'apps/disks/health.jsx:disks',
  'apps/notes/index.jsx:emoji', 'apps/photos/index.jsx:toast', 'apps/files/dialogs.jsx:help',
  'apps/cleaner/dashboard.jsx:cleaner', 'apps/cleaner/ui.jsx:cleaner', 'apps/cleaner/storage.jsx:share',
  'apps/cleaner/duplicates.jsx:smart', 'apps/cleaner/index.jsx:emptyTrash',
]);
let problems = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  if (!/from\s+'@insaneos\/sdk'/.test(src)) continue;     // not an SDK consumer
  const bound = new Set();
  // imports from any module (the SDK, the runtime, a relative file that re-exports)
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from/g)) {
    for (const part of m[1].split(',')) {
      const name = part.split(' as ').map((s) => s.trim()).filter(Boolean).pop();
      if (name) bound.add(name);
      else {
        const first = part.trim();                        // `nextAlarm as nextAlarmStore`: bind both
        if (/^[A-Za-z_$][\w$]*$/.test(first)) bound.add(first);
      }
    }
  }
  let code = src.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))   // keep line numbers honest
    .replace(/'[^'\n]*'/g, "''").replace(/"[^"\n]*"/g, '""');
  {   // templates innermost-first (a ${…} may hold its own template): iterate until no pair remains
    for (;;) {   // each pair becomes exactly two backticks (even parity) plus its newlines
      const next = code.replace(/`[^`]*`/g, (m) => '\n'.repeat((m.match(/\n/g) || []).length));   // the pair is gone: nothing can re-pair
      if (next === code) break;
      code = next;
    }
  }
  // bindings: const/let/var (plain or destructured), function names, destructured parameters
  for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) bound.add(m[1]);
  for (const m of [...code.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}/g), ...code.matchAll(/\b(?:const|let|var)\s*\[([^\]]*)\]/g)]) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/[=\s]/)[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) bound.add(name);
    }
  }
  for (const m of code.matchAll(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)/g)) bound.add(m[1]);
  for (const m of code.matchAll(/\(\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/[=\s]/)[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) bound.add(name);
    }
  }
  for (const m of code.matchAll(/\(\s*([A-Za-z_$][\w$]*)\s*\)\s*=>/g)) bound.add(m[1]);   // (x) => …
  for (const m of code.matchAll(/\(\s*\[([^\[\]]*)\]\s*\)?\s*=>/g)) {                      // ([a, b]) => …
    for (const part of m[1].split(',')) {
      const nm = part.trim().split(/[=\s]/)[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(nm)) bound.add(nm);
    }
  }
  for (const m of code.matchAll(/\bfunction\s*[\w$]*\s*\(([^)]*)\)/g)) {                  // function f(a, b) { …
    for (const part of m[1].split(',')) {
      const nm = part.trim().split(/[=\s]/)[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(nm)) bound.add(nm);
    }
  }
  for (const m of code.matchAll(/\(([^(){}]*?)\)\s*=>/g)) {                                  // (a, b) => …
    for (const part of m[1].split(',')) {
      const nm = part.trim();
      if (/^[A-Za-z_$][\w$]*$/.test(nm)) bound.add(nm);
    }
  }
  // what remains as scan surface: no imports, no JSX text runs, no regex literals
  code = code.replace(/import\s*\{[^}]*\}\s*from[^;\n]*;?/g, '').replace(/export\s*\{[^}]*\}\s*from[^;\n]*;?/g, '').replace(/>[^<>{}\n]*</g, '><').replace(/(?<!=)\/[^/\n]*\//g, '//');
  const lines = code.split('\n');
  for (const name of exports_) {
    if (bound.has(name) || name.length <= 2) continue;      // `t` and friends: locals everywhere
    // not member access (insane.screen), not a key/prop (direction: 'ltr', displays={all}),
    // not a method definition (Layer() {)
    const rx = new RegExp(`(?<![\\w$./])${name.replace(/\$/g, '\\$')}\\b(?![\\w$]*\\s*[:=])(?!\\s*\\(\\s*\\)\\s*\\{)`);
    const hit = lines.findIndex((l) => rx.test(l));
    if (hit >= 0 && !SUPPRESSED.has(`${path.relative(root, file)}:${name}`)) {
      console.log(`${path.relative(root, file)}:${hit + 1}: uses SDK export '${name}' without binding it`);
      problems++;
    }
  }
}
console.log(problems ? `\n${problems} problem(s)` : 'sdk-import-check: clean');
process.exit(problems ? 1 : 0);
