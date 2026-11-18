#!/usr/bin/env node
// Builds the Insane OS wallpaper collection (assets/wallpapers/) from the original PNGs.
//
// Usage: node tools/gen-wallpapers.mjs <source dir>
//   <source dir>/<category>/insaneos-<name>.png              (category: signature, lumo, cosmos)
//   <source dir>/<category>/insaneos-<name>@<W>x<H>.png      optional higher-resolution variant
//
// For each original it writes, with ffmpeg (decode, Lanczos scaling) and cjpeg (libjpeg-turbo):
//   assets/wallpapers/<category>/insaneos-<name>.jpg            same size and name as the original
//   assets/wallpapers/<category>/insaneos-<name>@<W>x<H>.jpg    each variant, at its own size
//   assets/wallpapers/thumbs/<category>/insaneos-<name>.jpg     320×180 (cover crop) for Settings
// and assets/wallpapers/index.json, which the SDK bundles (sdk/wallpapers.js) to pick, for each
// screen, the smallest variant that covers it (or the largest one). To add a 4K version later,
// drop insaneos-<name>@3840x2160.png next to the original and run this again.
//
// JPEG at quality 90 with 4:4:4 chroma (the art has fine violet and gold detail that 4:2:0 blurs),
// baseline + optimized Huffman tables. stb_image (insane-server) decodes it; WebP isn't supported.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = process.argv[2];
if (!src || !fs.statSync(src, { throwIfNoEntry: false })?.isDirectory()) {
  console.error('usage: node tools/gen-wallpapers.mjs <source dir with signature/ lumo/ cosmos/ …>');
  process.exit(2);
}
const CATEGORIES = ['signature', 'lumo', 'cosmos', 'anime', 'wallpaper', 'sanime'];
const THUMB = [320, 180];
const out = path.join(root, 'assets', 'wallpapers');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'insaneos-wp-'));

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
function size(file) {
  const [w, h] = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
    '-of', 'csv=p=0', file]).trim().split(',').map(Number);
  return { w, h };
}
// ffmpeg → PPM (with an optional filter) → cjpeg; without cjpeg the ffmpeg mjpeg encoder does the
// same job (yuvj444p keeps the 4:4:4 chroma, -q:v 3 lands at the same visual quality as cjpeg 90)
const hasCjpeg = (() => { try { execFileSync('cjpeg', ['-version'], { stdio: 'ignore' }); return true; } catch (e) { return false; } })();
function jpeg(input, output, vf, quality, sample) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  if (hasCjpeg) {
    const ppm = path.join(tmp, 'frame.ppm');
    run('ffmpeg', ['-loglevel', 'error', '-y', '-i', input, ...(vf ? ['-vf', vf] : []), '-pix_fmt', 'rgb24', ppm]);
    run('cjpeg', ['-quality', String(quality), '-sample', sample, '-optimize', '-outfile', output, ppm]);
  } else {
    const q = Math.max(2, Math.round(34 - (quality / 100) * 32));    // 90 → q:v 3, 85 → q:v 6
    run('ffmpeg', ['-loglevel', 'error', '-y', '-i', input, ...(vf ? ['-vf', vf] : []),
      '-pix_fmt', 'yuvj444p', '-q:v', String(q), '-huffman', 'optimal', output]);
  }
}

const index = [];
const IMG = /\.(png|jpe?g)$/;
for (const cat of CATEGORIES) {
  const dir = path.join(src, cat);
  if (!fs.existsSync(dir)) continue;
  const pngs = fs.readdirSync(dir).filter((n) => IMG.test(n)).sort();
  for (const name of pngs.filter((n) => !n.includes('@'))) {
    const base = name.replace(IMG, '');
    if (!/^insaneos-[a-z0-9-]+$/.test(base)) throw new Error(`bad wallpaper name: ${name}`);
    const id = base.replace(/^insaneos-/, '');
    const entry = { id, category: cat, thumb: `thumbs/${cat}/${base}.jpg`, variants: [] };
    const variants = [name, ...pngs.filter((n) => n.startsWith(`${base}@`) && /@\d+x\d+\.(png|jpe?g)$/.test(n))];
    for (const v of variants) {
      const file = `${cat}/${v.replace(IMG, '.jpg')}`;
      jpeg(path.join(dir, v), path.join(out, file), null, 90, '1x1');
      const { w, h } = size(path.join(dir, v));
      entry.variants.push({ w, h, file });
      console.log(`${file}  ${w}×${h}  ${(fs.statSync(path.join(out, file)).size / 1024).toFixed(0)} KB`);
    }
    entry.variants.sort((a, b) => a.w - b.w);
    entry.file = entry.variants[0].file;
    const [tw, th] = THUMB;
    jpeg(path.join(dir, name), path.join(out, entry.thumb),
      `scale=${tw}:${th}:force_original_aspect_ratio=increase:flags=lanczos,crop=${tw}:${th}`, 85, '2x2');
    index.push(entry);
  }
}
// Merge: the originals of an earlier collection may not be on this machine, so entries that were
// not regenerated keep their place (an id present in both sides takes the fresh build).
const keep = [];
try {
  const prev = JSON.parse(fs.readFileSync(path.join(out, 'index.json'), 'utf8'));
  const fresh = new Set(index.map((e) => e.id));
  for (const e of prev) if (e && e.id && !fresh.has(e.id)) keep.push(e);
} catch (e) { /* first build */ }
const all = [...keep, ...index];
all.sort((a, b) => (CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category)) || a.id.localeCompare(b.id));
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(all, null, 1) + '\n');
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${all.length} wallpapers → assets/wallpapers/index.json (${keep.length} kept, ${index.length} fresh)`);
