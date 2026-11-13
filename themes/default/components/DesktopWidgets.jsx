// DesktopWidgets.jsx — the Insane OS desktop widgets.
//
// Design language (v2, "classic premium"): warm white cards, elegant black typography,
// hairline borders, soft shadows, one restrained accent. No neon, no heavy glass — the
// cards sit on the wallpaper like paper.
//
// The accent still follows the wallpaper: every six seconds the playing live wallpaper's
// pixels are sampled (wallpaperMedia → insane.media.pixels) and the most saturated block is
// desaturated and darkened into an ink colour, so the accent always belongs to the picture
// without ever shouting. Fallback: the OS violet, muted.
import { registerWidgetType, setWidgets, useStore, sharedTicker, wallpaperMedia, useSettings, createStore, weekdayName, monthName, tOptional } from '@insaneos/sdk';
import { View, Text } from '@insaneos/sdk';
import { useEffect, useRef } from 'react';
const INK = '#1d1d1f';
const INK_DIM = 'rgba(29,29,31,0.55)';
const INK_FAINT = 'rgba(29,29,31,0.38)';

const clockTicker = sharedTicker(() => Date.now(), 1000);
const statsTicker = sharedTicker(() => Date.now(), 3000);

// muted palette: what the sampler found, pulled towards ink so it stays premium
const palette = createStore({ ink: [96, 74, 140], changed: 0 });   // default: muted OS violet

const hex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const desat = (c) => {
  const l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const s = 0.42;                                    // keep 42 % of the saturation
  const r = l + (c[0] - l) * s, g = l + (c[1] - l) * s, b = l + (c[2] - l) * s;
  // darken towards ink so text and bars stay legible on a warm white card
  return [r, g, b].map((v) => Math.round(v * 0.72 + 29 * 0.28));
};

// Sample the playing wallpaper: three 16×16 blocks across the middle; the most saturated
// becomes the muted accent. Three cheap reads, every second stats tick.
function samplePalette() {
  const id = wallpaperMedia.get();
  if (!id) return;
  let info = null;
  try { info = insane.media.info(id); } catch { return; }
  if (!info?.width) return;
  const w = info.width, h = info.height;
  let best = null, bestSat = -1;
  for (const fx of [0.16, 0.5, 0.84]) {
    let buf = null;
    try { buf = insane.media.pixels(id, Math.round(w * fx) - 8, Math.round(h * 0.5) - 8, 16, 16); } catch { buf = null; }
    if (!buf) continue;
    const px = new Uint8Array(buf);
    let sr = 0, sg = 0, sb = 0;
    const count = px.length / 4;
    for (let i = 0; i < px.length; i += 4) { sr += px[i]; sg += px[i + 1]; sb += px[i + 2]; }
    sr /= count; sg /= count; sb /= count;
    const mx = Math.max(sr, sg, sb), mn = Math.min(sr, sg, sb);
    const sat = (mx - mn) / Math.max(1, mx);
    if (sat > bestSat) { bestSat = sat; best = [sr, sg, sb]; }
  }
  if (!best) return;
  const ink = desat(best);
  const cur = palette.get();
  const d = Math.abs(ink[0] - cur.ink[0]) + Math.abs(ink[1] - cur.ink[1]) + Math.abs(ink[2] - cur.ink[2]);
  if (d < 18) return;                                  // ignore small drifts
  palette.set({ ink, changed: cur.changed + 1 });
}

function Card({ widget, children }) {
  // Glass (0.8.8.8): the wallpaper shows through a semi-transparent card with a real backdrop
  // blur of it (the video frame below is in the same canvas this blurs, insane-server paint.c).
  // The two sliders live in Settings → Wallpaper → Glass (settings.glassBlur/glassTransparency);
  // with transparency 0 this is the paper card the v2 design shipped.
  const [s] = useSettings();
  const on = s.effects !== false;
  const t = on ? Math.max(0, Math.min(1, Number.isFinite(s.glassTransparency) ? s.glassTransparency : 0.3)) : 0;
  const alpha = Math.max(0.04, 0.92 + (0.24 - 0.92) * t);    // paper white, pulled towards glass
  const blur = on ? Math.max(0, Math.min(64, Number.isFinite(s.glassBlur) ? Math.round(s.glassBlur) : 24)) : 0;
  const sat = on && blur ? Math.max(1, Math.min(2, Number.isFinite(s.glassSaturate) ? s.glassSaturate : 1.2)) : 1;
  return (
    <View style={[{
      position: 'absolute', left: widget.x, top: widget.y, width: widget.w,
      padding: 20, borderRadius: 18, gap: 4,
      backgroundColor: `rgba(252,251,247,${alpha.toFixed(3)})`,
      backdropFilter: blur > 0 ? `blur(${blur}px) saturate(${sat})` : undefined,
      border: `1px solid rgba(20,20,30,${(0.08 + 0.06 * t).toFixed(3)})`,
      boxShadow: '0 10px 30px rgba(20,20,40,0.14)',
    }, widget.style]}>
      {children}
    </View>
  );
}

function Row({ label, value, pct, ink }) {
  if (!Number.isFinite(pct)) pct = 0;                      // never put NaN on the card
  return (
    <View style={{ gap: 5 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 12, fontWeight: 600, color: INK }}>{label}</Text>
        <Text style={{ fontSize: 12, color: INK_DIM }}>{value}</Text>
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(29,29,31,0.08)' }}>
        <View style={{ width: `${Math.max(2, Math.min(100, Math.round(pct * 100)))}%`, height: 4, borderRadius: 2, backgroundColor: ink }} />
      </View>
    </View>
  );
}

function ClockCard({ widget }) {
  const now = useStore(clockTicker);
  const p = useStore(palette);
  const ink = hex(p.ink);
  const d = new Date(now || Date.now());
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return (
    <Card widget={widget}>
      <Text style={{ fontSize: 52, fontWeight: 800, color: INK, letterSpacing: -1.2, lineHeight: 1.05 }}>
        {hh}:{mm}</Text>
      <Text style={{ fontSize: 15, fontWeight: 600, color: INK_DIM, marginTop: 2 }}>
        {weekdayName(d.getDay(), false)}, {d.getDate()} {monthName(d.getMonth())}</Text>
      <View style={{ marginTop: 10, height: 2, width: 34, borderRadius: 1, backgroundColor: ink, opacity: 0.8 }} />
    </Card>
  );
}

function StatsCard({ widget }) {
  const tick = useStore(statsTicker);
  const p = useStore(palette);
  const ink = hex(p.ink);
  const stats = useRef({ cpu: null, temp: null, ram: null });
  useEffect(() => { try { insane.monitor?.start?.(); } catch { /* not available */ } }, []);
  useEffect(() => { samplePalette(); }, [tick]);
  try {
    const smp = insane.monitor?.sample?.();
    if (smp) {
      const cpu = Array.isArray(smp.cpu) ? smp.cpu[smp.cpu.length - 1] : smp.cpu;
      if (cpu != null && isFinite(cpu)) stats.current.cpu = Math.max(0, Math.min(1, cpu));
      if (smp.temp != null && isFinite(smp.temp)) stats.current.temp = Math.round(smp.temp);
      // the monitor's field is "avail" (server/src/monitor/mon.c); read it defensively so a
      // missing field can never put NaN on the card again (was: mem.available → NaN %)
      const m = smp.mem || {};
      const avail = Number.isFinite(m.avail) ? m.avail : Number.isFinite(m.available) ? m.available : NaN;
      if (Number.isFinite(m.total) && m.total > 0 && Number.isFinite(avail)) {
        stats.current.ram = Math.max(0, Math.min(1, 1 - avail / m.total));
      }
    }
  } catch { /* monitor asleep */ }
  const s = stats.current;
  if (s.cpu == null) return null;
  return (
    <Card widget={widget} style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 11, fontWeight: 700, color: INK_FAINT, letterSpacing: 1.2 }}>{(tOptional('shell.widgets.system') || 'SYSTEM').toUpperCase()}</Text>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ink, opacity: 0.85 }} />
      </View>
      <Row label="CPU" value={`${Math.round((s.cpu || 0) * 100)}%`} pct={s.cpu || 0} ink={ink} />
      {s.ram != null ? <Row label="Memory" value={`${Math.round(s.ram * 100)}%`} pct={s.ram} ink={ink} /> : null}
      {s.temp != null ? <Row label="Temperature" value={`${s.temp}°C`} pct={Math.max(0, Math.min(1, (s.temp - 35) / 55))} ink={ink} /> : null}
    </Card>
  );
}

// place them on the main display, right side under the menu bar (behind every window)
const X = () => Math.max(40, insane.screen.width - 342);

registerWidgetType('insane-clock', ClockCard);
registerWidgetType('insane-stats', StatsCard);
setWidgets('insane-clock', [{ id: 'clock', x: X(), y: 104, w: 300, h: 132 }]);
setWidgets('insane-stats', [{ id: 'stats', x: X(), y: 252, w: 300, h: 158 }]);
