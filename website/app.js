/* Insane OS site — interactions
   1. hero desktop mockup: 3D tilt that follows the pointer
   2. boot demo: a canvas particle field mirroring the real Plymouth splash
      (48 particles, three depth layers, drift/sway/twinkle), eased progress,
      then the login glass card. Reduced motion: everything settles instantly. */

(() => {
'use strict';
try {
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- 1. the 3D tilt ---------- */
const stage = document.getElementById('stage');
const desk = document.getElementById('desk');
if (stage && desk && !reduced) {
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;    // -0.5 … 0.5
    const py = (e.clientY - r.top) / r.height - 0.5;
    desk.style.transform =
      `rotateY(${(px * 10).toFixed(2)}deg) rotateX(${(-py * 7).toFixed(2)}deg) translateZ(0)`;
  });
  stage.addEventListener('pointerleave', () => { desk.style.transform = 'rotateY(0) rotateX(0)'; });
}

/* ---------- 2. the boot demo ---------- */
const canvas = document.getElementById('bootCanvas');
const power = document.getElementById('powerBtn');
const fill = document.getElementById('bootFill');
const bootUI = document.getElementById('bootUI');
const loginCard = document.getElementById('loginCard');
const stateLine = document.getElementById('bootState');
if (!canvas || !power) return;

const ctx = canvas.getContext('2d');
const TINTS = [[168, 85, 247], [255, 64, 160], [235, 235, 255]];

let running = false, raf = 0, particles = [], t = 0;
let progress = 0, target = 0, phase = 'off';   // off → boot → login → desktop

function sizeCanvas() {
  const r = canvas.getBoundingClientRect();
  canvas.width = r.width * devicePixelRatio;
  canvas.height = r.height * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
addEventListener('resize', sizeCanvas);

/* Park–Miller, same seeding story as the Plymouth script */
let seed = 20261111;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

function makeParticles(W, H) {
  const arr = [];
  for (let i = 0; i < 48; i++) {
    const layer = i % 3;
    arr.push({
      x: rnd() * W,
      y: rnd() * H,
      v: (layer === 0 ? 0.14 + rnd() * 0.1 : layer === 1 ? 0.28 + rnd() * 0.16 : 0.5 + rnd() * 0.22) * 1.4,
      size: layer === 0 ? 3 + rnd() * 3 : layer === 1 ? 5 + rnd() * 4 : 8 + rnd() * 7,
      amp: 8 + rnd() * 26,
      freq: 0.4 + rnd() * 1.1,
      phase: rnd() * 6.283,
      tw: 0.6 + rnd() * 1.6,
      base: layer === 0 ? 0.25 + rnd() * 0.1 : layer === 1 ? 0.4 + rnd() * 0.14 : 0.55 + rnd() * 0.18,
      tint: TINTS[i % 3],
    });
  }
  return arr;
}

function frame() {
  if (!running) return;
  const W = canvas.width / devicePixelRatio, H = canvas.height / devicePixelRatio;
  ctx.clearRect(0, 0, W, H);
  t += 0.02;
  for (const p of particles) {
    p.y -= p.v;
    if (p.y < -12) { p.y = H + 10; p.x = rnd() * W; }
    const sway = Math.sin(t * p.freq + p.phase) * p.amp;
    const tw = 0.62 + 0.38 * Math.sin(t * p.tw + p.phase * 1.7);
    const a = p.base * tw;
    const g = ctx.createRadialGradient(p.x + sway, p.y, 0, p.x + sway, p.y, p.size);
    g.addColorStop(0, `rgba(${p.tint[0]},${p.tint[1]},${p.tint[2]},${a})`);
    g.addColorStop(1, `rgba(${p.tint[0]},${p.tint[1]},${p.tint[2]},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x + sway, p.y, p.size, 0, 6.283);
    ctx.fill();
  }
  /* progress: eased, never backwards — like Plymouth's */
  if (phase === 'boot' && progress < target) {
    progress = Math.min(target, progress + (target - progress) * 0.06 + 0.0008);
    fill.style.width = `${(progress * 100).toFixed(1)}%`;
    if (progress >= 0.999) toLogin();
  }
  raf = requestAnimationFrame(frame);
}

function bootStart() {
  document.getElementById('bootState').textContent = 'bootStart: entered, running=' + running;
  if (running) return;
  running = true;
  phase = 'boot';
  const S = (m) => { document.getElementById('bootState').textContent = m; };
  power.style.display = 'none';
  bootUI.style.opacity = '1';
  sizeCanvas();
  particles = makeParticles(canvas.width / devicePixelRatio, canvas.height / devicePixelRatio);
  stateLine.textContent = 'booting insane os…';
  target = 0;
  /* the bar follows the same time-curve as Plymouth: half at 8 s, 95 % ceiling */
  const timer = setInterval(() => {
    if (phase !== 'boot') { clearInterval(timer); return; }
    target = Math.max(target, Math.min(0.95, (0.95 * elapsed) / (elapsed + 8)));
  }, 500);
  let elapsed = 0;
  const tick = setInterval(() => { elapsed += 0.5; }, 500);
  setTimeout(() => { target = 1; }, 5200);          // the machine is "ready"
  raf = requestAnimationFrame(frame);
}

function toLogin() {
  phase = 'login';
  stateLine.textContent = 'login';
  bootUI.style.transition = 'opacity .5s ease';
  bootUI.style.opacity = '0';
  setTimeout(() => { bootUI.style.pointerEvents = 'none'; }, 500);
  loginCard.classList.add('show');
  const go = () => toDesktop();
  loginCard.addEventListener('click', go, { once: true });
  addEventListener('keydown', (e) => { if (phase === 'login' && e.key === 'Enter') go(); }, { once: true });
}

function toDesktop() {
  phase = 'desktop';
  loginCard.classList.remove('show');
  stateLine.textContent = 'welcome to insane os';
  /* the particles keep drifting — this is the live wallpaper now */
  const hello = document.createElement('div');
  hello.className = 'login-card show';
  hello.style.background = 'rgba(8,8,20,.5)';
  hello.innerHTML = '<div class="login-name" style="font-family:Fraunces,serif;font-size:22px">Welcome to Insane OS</div>' +
    '<div class="login-hint">the desktop is yours — this is where the site ends and the machine begins</div>';
  canvas.parentElement.appendChild(hello);
}

power.addEventListener('click', bootStart);
if (!reduced) requestAnimationFrame(function idle() {
  /* idle drift even before power on: a hint of the field at 12 % opacity */
  if (!running) {
    if (canvas.width === 0) sizeCanvas();
    if (!particles.length) particles = makeParticles(canvas.width / devicePixelRatio, canvas.height / devicePixelRatio);
    const W = canvas.width / devicePixelRatio, H = canvas.height / devicePixelRatio;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = 0.16;
    t += 0.02;
    for (const p of particles) {
      p.y -= p.v * 0.5;
      if (p.y < -12) { p.y = H + 10; p.x = rnd() * W; }
      const sway = Math.sin(t * p.freq + p.phase) * p.amp;
      const g = ctx.createRadialGradient(p.x + sway, p.y, 0, p.x + sway, p.y, p.size);
      g.addColorStop(0, `rgba(${p.tint[0]},${p.tint[1]},${p.tint[2]},${p.base})`);
      g.addColorStop(1, `rgba(${p.tint[0]},${p.tint[1]},${p.tint[2]},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x + sway, p.y, p.size, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(idle);
  }
});
else { sizeCanvas(); }
} catch (err) {
  const el = document.getElementById('bootState');
  if (el) el.textContent = 'site error: ' + err.message;
  console.error(err);
}
})();
