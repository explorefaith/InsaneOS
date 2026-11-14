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
import { registerWidgetType, setWidgets, BatteryGlyph, useStore, sharedTicker, wallpaperMedia, useSettings, createStore, weekdayName, monthName, tOptional, settings, widgetLayout, widgetsEditing, loadWidgets, addWidget, removeWidget, moveWidget, WIDGET_CATALOG, battery, useBattery, nowPlaying } from '@insaneos/sdk';
export { widgetsEditing, widgetLayout };
import { View, Text, addListener } from '@insaneos/sdk';
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
  const editing = useStore(widgetsEditing);
  const layout = useStore(widgetLayout);
  const lw = layout ? layout.find((w) => String(w.id) === String(widget.id)) : null;
  const at = lw || widget;                       // saved layout wins; the theme default before it
  const drag = useRef(null);
  const start = (e) => {
    if (!editing || !lw) return;
    e.stopPropagation();
    drag.current = { dx: e.x - lw.x, dy: e.y - lw.y };
    const move = (ev) => { if (drag.current) moveWidget(lw.id, ev.x - drag.current.dx, ev.y - drag.current.dy, useWorkArea()); };
    const offMove = addListener('pointermove', move);
    const offUp = addListener('pointerup', () => { drag.current = null; offMove(); offUp(); });
  };
  return (
    <View onMouseDown={start} style={[{
      position: 'absolute', left: at.x, top: at.y, width: at.w,
      padding: 20, borderRadius: 18, gap: 4,
      backgroundColor: `rgba(252,251,247,${alpha.toFixed(3)})`,
      backdropFilter: blur > 0 ? `blur(${blur}px) saturate(${sat})` : undefined,
      border: `1px solid rgba(20,20,30,${(0.08 + 0.06 * t + (editing ? 0.1 : 0)).toFixed(3)})`,
      boxShadow: '0 10px 30px rgba(20,20,40,0.14)',
      cursor: editing ? 'move' : undefined,
    }, widget.style]}>
      {editing && lw ? (
        <View onClick={(e) => { e.stopPropagation(); removeWidget(lw.id); }}
          style={{ position: 'absolute', top: -9, right: -9, width: 22, height: 22, borderRadius: 11,
            backgroundColor: '#1d1d1f', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
          <Text style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>×</Text>
        </View>
      ) : null}
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

// The user's saved layout (settings.desktopWidgets) drives every card; the two originals below are
// the fallback when nothing was saved yet (loadWidgets(null)). In edit mode (right-click the
// desktop → Edit Widgets) cards drag, every card has a remove button, and the gallery adds new
// ones. A drag does not fight the compositor: the pointer moves arrive already coalesced once per
// frame, and each move ends in one store write.
loadWidgets(settings.get().desktopWidgets);   // widgetmodel validates the list; nothing saved yet → the defaults below

function useWorkArea() {
  return { x: 0, y: 30, w: insane.screen.width, h: insane.screen.height - 30 - 96 };   // bar + dock strip
}

// place them on the main display, right side under the menu bar (behind every window)
const X = () => Math.max(40, insane.screen.width - 342);

registerWidgetType('insane-clock', ClockCard);
registerWidgetType('insane-stats', StatsCard);
setWidgets('insane-clock', [{ id: 'clock', x: X(), y: 104, w: 300, h: 132 }]);
setWidgets('insane-stats', [{ id: 'stats', x: X(), y: 252, w: 300, h: 158 }]);

// ---- round 4 widgets ----

function CalendarCard({ widget }) {
  const now = useStore(clockTicker);
  const p = useStore(palette);
  const ink = hex(p.ink);
  const d = new Date(now || Date.now());
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const off = (first.getDay() + 6) % 7;                    // Monday first, like the Clock's panel
  const cells = [];
  for (let i = 0; i < off; i++) cells.push(null);
  for (let i = 1; i <= days; i++) cells.push(i);
  return (
    <Card widget={widget}>
      <Text style={{ fontSize: 13, fontWeight: 700, color: INK_DIM }}>{monthName(d.getMonth())} {d.getFullYear()}</Text>
      <View style={{ flexDirection: 'row', gap: 3, marginTop: 8 }}>
        {[1, 2, 3, 4, 5, 6, 0].map((w) => (
          <Text key={w} style={{ width: 32, textAlign: 'center', fontSize: 10, fontWeight: 700, color: INK_FAINT }}>{weekdayName(w, true).slice(0, 2)}</Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
        {cells.map((n, i) => (
          <View key={i} style={{ width: 32, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 8,
            backgroundColor: n === d.getDate() ? ink : 'transparent' }}>
            <Text style={{ fontSize: 12, fontWeight: n === d.getDate() ? 700 : 500, color: n === d.getDate() ? '#fff' : n ? INK : 'transparent' }}>{n || '·'}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function BatteryCard({ widget }) {
  const b = useBattery();
  if (!b || !b.hasBattery) return null;
  const p = useStore(palette);
  const ink = hex(p.ink);
  const status = b.charging ? 'Charging' : b.onAC ? 'On power' : 'On battery';
  const left = !b.charging && b.minutesLeft > 0 ? ` · ${Math.floor(b.minutesLeft / 60)}h ${Math.round(b.minutesLeft % 60)}m left` : '';
  return (
    <Card widget={widget} style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <BatteryGlyph percent={b.percent} charging={b.charging} color={INK} width={34} />
        <View style={{ gap: 1 }}>
          <Text style={{ fontSize: 26, fontWeight: 800, color: INK, lineHeight: 1.1 }}>{b.percent >= 0 ? `${b.percent}%` : '—'}</Text>
          <Text style={{ fontSize: 12, fontWeight: 600, color: INK_DIM }}>{status}{left}</Text>
        </View>
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(29,29,31,0.08)' }}>
        <View style={{ width: `${Math.max(2, Math.min(100, b.percent))}%`, height: 4, borderRadius: 2, backgroundColor: b.charging ? ink : INK_DIM }} />
      </View>
    </Card>
  );
}

function MediaCard({ widget }) {
  const np = useStore(nowPlaying);
  if (!np || !np.title) return null;
  return (
    <Card widget={widget} style={{ gap: 8 }}>
      <Text style={{ fontSize: 11, fontWeight: 700, color: INK_FAINT, letterSpacing: 1.2 }}>{(tOptional('shell.widgets.playing') || 'NOW PLAYING').toUpperCase()}</Text>
      <Text style={{ fontSize: 15, fontWeight: 700, color: INK, whiteSpace: 'nowrap', overflow: 'hidden' }}>{np.title}</Text>
      {np.artist ? <Text style={{ fontSize: 12, color: INK_DIM, whiteSpace: 'nowrap', overflow: 'hidden' }}>{np.artist}</Text> : null}
    </Card>
  );
}

// ---- edit mode: the gallery and the persistence ----

const saveTimer = useRef2(null);
function useRef2(v) { return { current: v }; }

widgetLayout.subscribe(() => {
  const list = widgetLayout.get();                       // subscribers get no argument (store.js)
  if (!list) return;                                     // not loaded yet
  clearTimeout(saveTimer.current);
  saveTimer.current = setTimeout(() => settings.set({ desktopWidgets: list }), 400);
});

const EDITING = { clock: 'Clock', calendar: 'Calendar', battery: 'Battery', stats: 'System', media: 'Media' };
export function WidgetGallery({ workArea, onClose }) {
  const editing = useStore(widgetsEditing);
  if (!editing) return null;
  return (
    <View style={{ position: 'absolute', left: workArea.x, top: workArea.y + 8, width: 260, padding: 14, gap: 8, borderRadius: 16,
      backgroundColor: 'rgba(252,251,247,0.97)', border: '1px solid rgba(20,20,30,0.1)', boxShadow: '0 12px 34px rgba(20,20,40,0.2)', zIndex: 900 }}>
      <Text style={{ fontSize: 13, fontWeight: 700, color: INK }}>{tOptional('shell.widgets.gallery') || 'Widgets'}</Text>
      {WIDGET_CATALOG.map((c) => (
        <View key={c.type} onClick={() => addWidget(c.type, workArea)}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 10,
            backgroundColor: 'rgba(29,29,31,0.05)' }}>
          <Text style={{ fontSize: 13, fontWeight: 600, color: INK }}>{EDITING[c.type.slice(7)] || c.type}</Text>
          <Text style={{ fontSize: 15, fontWeight: 700, color: ink2() }}>+</Text>
        </View>
      ))}
      <View onClick={onClose} style={{ alignItems: 'center', padding: 8, borderRadius: 10, backgroundColor: '#1d1d1f', marginTop: 2 }}>
        <Text style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{tOptional('shell.widgets.done') || 'Done'}</Text>
      </View>
    </View>
  );
}
function ink2() { return hex(palette.get().ink); }

registerWidgetType('insane-calendar', CalendarCard);
registerWidgetType('insane-battery', BatteryCard);
registerWidgetType('insane-media', MediaCard);
