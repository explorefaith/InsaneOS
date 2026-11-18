// ThemeWidgets.jsx — the Theme Studio's desktop widgets (branch feature/theme-studio).
//
// Every Theme Studio kind draws here, through one registered type ('ts-widget') so the
// composition's z-order is the paint order and the pinned split rides the same DesktopWidgets
// layer the classic widgets use. The look is the theme's style schema: the active theme's
// `style` baseline merges under each kind's defaults and over that every instance's own patch —
// font, size, weight, italic, tracking, ink, alignment, surface (paper/alpha/blur), radius,
// border, padding, shadow (sdk/themestudio-model.js resolveStyle). Real data only: the clock,
// calendar, agenda (Calendar events), to-dos (Reminders), weather (the consent-gated source),
// stats/network/storage/battery (the monitor and the disks), media (the playing app), the
// Pomodoro (the Clock's timer) — a kind without its data draws its quiet state, never a fake.
//
// While a Theme Studio theme is active the classic widget layout stands down (see the guard in
// DesktopWidgets.jsx): one composition on the desktop at a time, both kept underneath.
import { createElement as h, useRef, useEffect } from 'react';
import {
  View, Text, Image, addListener, useStore, sharedTicker, settings, battery, useBattery,
  nowPlaying, calendarEvents, reminders, usePim, weather, useWeather, weatherConsent, weatherGroup,
  clockTimer, timerStart, timerPause, timerResume, timerReset, timerLeft, formatBytes,
  weekdayName, monthName, tOptional, tsLive, resolveStyle, withAlpha,
  registerWidgetType, setWidgets, tsByZ,
} from '@insaneos/sdk';

const hex = (rgb) => (Array.isArray(rgb) ? `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}` : null);

// ---------------------------------------------------------------- the shared tickers

const tsClock = sharedTicker((d) => d.getTime(), 1000);                 // the clocks, the calendar
const tsStats = sharedTicker((d) => Math.floor(d.getTime() / 3000), 3000);   // monitor-driven kinds

// ---------------------------------------------------------------- the style chain

// The kinds' own defaults over the theme's baseline. Sizes are the design-space px the catalog
// composes with; every one of them is overridable per instance.
const KIND_STYLE = {
  'clock-digital': { size: 56, weight: 700 },
  'clock-analog': {},
  'clock-world': { size: 20, weight: 600 },
  'calendar': { size: 12, weight: 500 },
  'agenda': { size: 13, weight: 500 },
  'weather': { size: 30, weight: 600 },
  'stats': { size: 12, weight: 600 },
  'battery': { size: 30, weight: 700 },
  'media': { size: 13, weight: 600 },
  'notes': { size: 13, weight: 400 },
  'todo': { size: 13, weight: 500 },
  'quote': { size: 17, weight: 400, italic: true },
  'pomodoro': { size: 26, weight: 700 },
  'network': { size: 12, weight: 600 },
  'storage': { size: 12, weight: 600 },
  'label': { size: 24, weight: 600 },
  'headline': { size: 40, weight: 800 },
  'gauge': { size: 12, weight: 600 },
};

// The effective style of an instance: the bridge pre-merges the active theme's baseline into
// widget.style, so both the desktop and the Settings previews land here the same way.
const eff = (widget) => resolveStyle(KIND_STYLE[widget.kind] || {}, widget.style || {});

// A text style from the schema; `over` patches per line (the dim ink, the size steps).
const tx = (st, over = {}) => ({
  fontFamily: st.font || 'sans-serif',
  fontSize: over.size ?? st.size ?? 14,
  fontWeight: over.weight ?? st.weight ?? 500,
  fontStyle: (over.italic ?? st.italic) ? 'italic' : 'normal',
  color: over.color ?? st.color ?? '#1d1d1f',
  letterSpacing: over.tracking ?? st.tracking,
  textAlign: st.align || 'left',
  lineHeight: over.lineHeight || 1.18,
});

const dim = (st, over = {}) => tx(st, { ...over, color: over.color ?? st.dim ?? st.color });

// ---------------------------------------------------------------- the surface

function TSCard({ widget, children, st }) {
  const style = eff(widget);
  const s = { ...style, ...st };
  const blurPx = s.blur ? Math.round(Math.max(0, Math.min(1, s.blur)) * 28) : 0;
  const effectsOn = settings.get().effects !== false;
  return (
    <View style={[{
      position: 'absolute', left: widget.x, top: widget.y, width: widget.w, height: widget.h,
      padding: s.pad ?? 18, borderRadius: s.radius ?? 16, gap: 6, overflow: 'hidden',
      backgroundColor: s.paper ? withAlpha(s.paper, s.alpha ?? 0.7) : 'transparent',
      backdropFilter: effectsOn && blurPx ? `blur(${blurPx}px) saturate(1.15)` : undefined,
      border: s.border && s.border !== 'none' ? `1px solid ${s.border}` : undefined,
      boxShadow: s.shadow === 'lift' ? '0 18px 44px rgba(8,8,14,0.4)'
        : s.shadow === 'soft' ? '0 10px 30px rgba(12,12,20,0.18)'
        : undefined,
    }, widget._extra]}>
      {children}
    </View>
  );
}

// The one-line label above a card's content (the quiet uppercase micro-label — a structural
// device: it names the real thing underneath).
const Eyebrow = ({ st, text }) => (
  <Text style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: st.dim || st.color, opacity: 0.7, textAlign: st.align || 'left' }}>
    {(text || '').toUpperCase()}
  </Text>
);

const Bar = ({ st, pct, color }) => (
  <View style={{ height: 4, borderRadius: 2, backgroundColor: withAlpha(st.color || '#888888', 0.14) }}>
    <View style={{ width: `${Math.max(2, Math.min(100, Math.round(pct * 100)))}%`, height: 4, borderRadius: 2, backgroundColor: color || st.accent || st.color }} />
  </View>
);

// ---------------------------------------------------------------- the kinds

function ClockDigital({ widget, st }) {
  const now = useStore(tsClock);
  const d = new Date(now || Date.now());
  const cfg = widget.cfg || {};
  const h24 = cfg.h24 !== false;
  let hh = d.getHours();
  const ampm = h24 ? '' : hh < 12 ? ' AM' : ' PM';
  if (!h24) hh = hh % 12 || 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = cfg.seconds ? String(d.getSeconds()).padStart(2, '0') : '';
  return (
    <TSCard widget={widget} st={{ justifyContent: 'center' }}>
      <View>
        <Text style={tx(st, { size: st.size, lineHeight: 1.04 })}>{`${hh}:${mm}${ss ? `:${ss}` : ''}`}</Text>
        <Text style={dim(st, { size: Math.max(12, Math.round((st.size || 56) * 0.22)), weight: 600 })}>
          {`${weekdayName(d.getDay(), false)}${ampm}`}
        </Text>
      </View>
    </TSCard>
  );
}

function ClockAnalog({ widget, st }) {
  const now = useStore(tsClock);
  const d = new Date(now || Date.now());
  const ink = st.color || '#1d1d1f';
  const accent = st.accent || ink;
  const face = Math.min(widget.w, widget.h) - (st.pad ?? 18) * 2;
  const hand = (ang, len, wdt, col, op) => (
    <View style={{ position: 'absolute', left: 0, top: 0, width: face, height: face, transform: `rotate(${ang}deg)` }}>
      <View style={{ position: 'absolute', left: face / 2 - wdt / 2, top: face / 2 - len, width: wdt, height: len,
        borderTopLeftRadius: wdt / 2, borderTopRightRadius: wdt / 2, backgroundColor: col, opacity: op }} />
    </View>
  );
  const secs = (widget.cfg || {}).seconds !== false;
  return (
    <TSCard widget={widget} st={{ alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: face, height: face }}>
        <View style={{ position: 'absolute', left: 0, top: 0, width: face, height: face, borderRadius: face / 2, border: `2px solid ${ink}` }} />
        {[0, 90, 180, 270].map((a) => (
          <View key={a} style={{ position: 'absolute', left: 0, top: 0, width: face, height: face, transform: `rotate(${a}deg)` }}>
            <View style={{ position: 'absolute', left: face / 2 - 1, top: 3, width: 2, height: 6, borderRadius: 1, backgroundColor: st.dim || ink, opacity: 0.7 }} />
          </View>
        ))}
        {hand(((d.getHours() % 12) + d.getMinutes() / 60) * 30, face * 0.26, 3.5, ink, 1)}
        {hand(d.getMinutes() * 6, face * 0.38, 2.5, ink, 1)}
        {secs ? hand(d.getSeconds() * 6, face * 0.4, 1.4, accent, 0.85) : null}
        <View style={{ position: 'absolute', left: face / 2 - 2.5, top: face / 2 - 2.5, width: 5, height: 5, borderRadius: 2.5, backgroundColor: accent }} />
      </View>
    </TSCard>
  );
}

// A zone's time through Intl (the tz database the engine's libc carries); the city is the tail
// of the zone name. A zone the runtime doesn't know renders its quiet dash — never a wrong time.
const zoneTime = (tz, d) => {
  try { return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d); }
  catch (e) { return null; }
};
const zoneCity = (tz) => String(tz || '').split('/').pop().replace(/_/g, ' ');

function ClockWorld({ widget, st }) {
  const now = useStore(tsClock);
  const d = new Date(now || Date.now());
  const zones = (widget.cfg || {}).zones || ['Europe/London', 'Asia/Tokyo'];
  return (
    <TSCard widget={widget} st={{ justifyContent: 'center', gap: 8 }}>
      {zones.slice(0, 3).map((tz) => {
        const time = zoneTime(tz, d);
        return (
          <View key={tz} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={dim(st, { size: Math.max(10, Math.round((st.size || 20) * 0.55)), weight: 600 })}>{zoneCity(tz)}</Text>
            <Text style={tx(st, { size: st.size })}>{time || '—'}</Text>
          </View>
        );
      })}
    </TSCard>
  );
}

function CalendarW({ widget, st }) {
  const now = useStore(tsClock);
  const d = new Date(now || Date.now());
  const accent = st.accent || st.color;
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const lead = first.getDay();
  const cells = [...Array(lead).fill(null), ...Array(days).fill(0).map((_, i) => i + 1)];
  const names = [0, 1, 2, 3, 4, 5, 6].map((i) => weekdayName(i, true).slice(0, 2));
  return (
    <TSCard widget={widget} st={{ gap: 8 }}>
      <Text style={tx(st, { size: Math.max(13, Math.round((st.size || 12) * 1.2)), weight: 700 })}>
        {monthName(d.getMonth())} {d.getFullYear()}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
        {names.map((n, i) => (
          <View key={`h${i}`} style={{ width: `${100 / 7}%`, alignItems: 'center' }}>
            <Text style={dim(st, { size: Math.max(9, (st.size || 12) - 2), weight: 700 })}>{n}</Text>
          </View>
        ))}
        {cells.map((n, i) => n === null ? <View key={`e${i}`} style={{ width: `${100 / 7}%` }} /> : (
          <View key={n} style={{ width: `${100 / 7}%`, alignItems: 'center' }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
              backgroundColor: n === d.getDate() ? accent : 'transparent' }}>
              <Text style={tx(st, { size: st.size, weight: n === d.getDate() ? 700 : 400, color: n === d.getDate() ? (st.paper || '#ffffff') : st.color })}>{n}</Text>
            </View>
          </View>
        ))}
      </View>
    </TSCard>
  );
}

function AgendaW({ widget, st }) {
  usePim();                                     // redraws when calendars change
  const list = useRef([]);
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    list.current = calendarEvents.range(start.getTime(), end.getTime()) || [];
  } catch (e) { list.current = []; }            // no calendar service: the quiet line
  const evs = list.current.filter((e) => e && e.title);
  const st0 = eff(widget);
  return (
    <TSCard widget={widget} st={{ gap: 6 }}>
      <Eyebrow st={st0} text={tOptional('shell.widgets.agenda') || 'Agenda'} />
      {evs.length ? evs.slice(0, 3).map((e, i) => (
        <View key={e.uid || i} style={{ flexDirection: 'row', gap: 8, alignItems: 'baseline' }}>
          <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: st0.accent || st0.color, opacity: 0.8 }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={tx(st, { size: st.size })} ellipsizeMode="tail" numberOfLines={1}>{e.title}</Text>
            <Text style={dim(st, { size: Math.max(10, (st.size || 13) - 2) })}>
              {new Date(e.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      )) : (
        <Text style={dim(st, { size: st.size })}>{tOptional('shell.widgets.agenda.none') || 'Nothing scheduled today'}</Text>
      )}
    </TSCard>
  );
}

function WeatherW({ widget, st }) {
  const w = useWeather();
  const st0 = eff(widget);
  const body = (() => {
    if (w.state === 'ok' && w.data?.current) {
      const t = Math.round(w.data.current.temperature_2m);
      const word = tOptional(`shell.weather.cond.${weatherGroup(w.data.current.weather_code)}`) || '';
      return (
        <View style={{ gap: 4 }}>
          <Text style={tx(st, { size: st.size })}>{`${t}°`}</Text>
          <Text style={dim(st, { size: Math.max(11, Math.round((st.size || 30) * 0.34)), weight: 600 })}>{word}</Text>
          {w.stale ? <Text style={dim(st, { size: 10 })}>{tOptional('shell.weather.stale') || 'cached'}</Text> : null}
        </View>
      );
    }
    if (w.state === 'consent' || w.state === 'idle') {
      return (
        <View style={{ gap: 4 }}>
          <Text style={dim(st, { size: Math.max(11, Math.round((st.size || 30) * 0.4)), weight: 600 })}>
            {tOptional('shell.weather.title') || 'Weather'}
          </Text>
          <Text onClick={() => weatherConsent(true)} style={{ ...dim(st, { size: 11 }), color: st0.accent || st0.color, textDecoration: 'underline' }}>
            {tOptional('shell.weather.allow') || 'Allow'}
          </Text>
        </View>
      );
    }
    if (w.state === 'loading') return <Text style={dim(st, { size: st.size })}>…</Text>;
    return <Text style={dim(st, { size: Math.max(11, Math.round((st.size || 30) * 0.4)) })}>{tOptional('shell.weather.unavailable') || 'Unavailable'}</Text>;
  })();
  return <TSCard widget={widget} st={{ justifyContent: 'center', gap: 4 }}>{body}</TSCard>;
}

function StatsW({ widget, st }) {
  const tick = useStore(tsStats);
  const ref = useRef({ cpu: null, ram: null, temp: null });
  useEffect(() => { try { insane.monitor?.start?.(); } catch { /* not available */ } }, []);
  try {
    const smp = insane.monitor?.sample?.();
    if (smp) {
      const cpu = Array.isArray(smp.cpu) ? smp.cpu[smp.cpu.length - 1] : smp.cpu;
      if (cpu != null && isFinite(cpu)) ref.current.cpu = Math.max(0, Math.min(1, cpu));
      if (smp.temp != null && isFinite(smp.temp)) ref.current.temp = Math.round(smp.temp);
      const m = smp.mem || {};
      const avail = Number.isFinite(m.avail) ? m.avail : Number.isFinite(m.available) ? m.available : NaN;
      if (Number.isFinite(m.total) && m.total > 0 && Number.isFinite(avail)) ref.current.ram = Math.max(0, Math.min(1, 1 - avail / m.total));
    }
  } catch { /* monitor asleep */ }
  const s = ref.current;
  if (s.cpu == null) return null;
  const st0 = eff(widget);
  const hot = s.temp != null ? s.temp >= 70 : false;
  const warm = s.temp != null ? s.temp >= 55 : false;
  const tcol = hot ? '#ff453a' : warm ? '#f5a623' : (st0.accent || st0.color);
  return (
    <TSCard widget={widget} st={{ gap: 8 }}>
      <Eyebrow st={st0} text={tOptional('shell.widgets.system') || 'System'} />
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={dim(st, { size: st.size })}>CPU</Text>
          <Text style={tx(st, { size: st.size })}>{`${Math.round((s.cpu || 0) * 100)}%`}</Text>
        </View>
        <Bar st={st0} pct={s.cpu || 0} color={st0.accent || st0.color} />
      </View>
      {s.ram != null ? (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={dim(st, { size: st.size })}>RAM</Text>
            <Text style={tx(st, { size: st.size })}>{`${Math.round(s.ram * 100)}%`}</Text>
          </View>
          <Bar st={st0} pct={s.ram} color={st0.accent || st0.color} />
        </View>
      ) : null}
      {s.temp != null ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={dim(st, { size: st.size })}>Temp</Text>
          <Text style={tx(st, { size: st.size, color: tcol })}>{`${s.temp}°C`}</Text>
        </View>
      ) : null}
    </TSCard>
  );
}

function BatteryW({ widget, st }) {
  const b = useBattery();
  if (!b || !b.hasBattery) return null;
  const st0 = eff(widget);
  const status = b.charging ? (tOptional('shell.widgets.charging') || 'Charging') : b.onAC ? (tOptional('shell.widgets.onAC') || 'On power') : (tOptional('shell.widgets.onBattery') || 'On battery');
  const left = !b.charging && b.minutesLeft > 0 ? ` · ${Math.floor(b.minutesLeft / 60)}h ${Math.round(b.minutesLeft % 60)}m` : '';
  return (
    <TSCard widget={widget} st={{ justifyContent: 'center', gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={tx(st, { size: st.size })}>{b.percent >= 0 ? `${b.percent}%` : '—'}</Text>
        <Text style={dim(st, { size: Math.max(10, Math.round((st.size || 30) * 0.32)), weight: 600 })}>{status}</Text>
      </View>
      <Bar st={st0} pct={(b.percent || 0) / 100} color={st0.accent || st0.color} />
      {left ? <Text style={dim(st, { size: 10 })}>{left.replace(' · ', '')}</Text> : null}
    </TSCard>
  );
}

function MediaW({ widget, st }) {
  const np = useStore(nowPlaying);
  if (!np || !np.title) {
    if ((widget.cfg || {}).idle === 'hide') return null;
    return (
      <TSCard widget={widget} st={{ justifyContent: 'center' }}>
        <Eyebrow st={eff(widget)} text={tOptional('media.nowPlaying.title') || 'Now playing'} />
        <Text style={dim(st, { size: st.size })}>{tOptional('media.nowPlaying.nothing') || 'Nothing playing'}</Text>
      </TSCard>
    );
  }
  const st0 = eff(widget);
  const mmss = (s) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '');
  const pct = np.duration > 0 ? Math.max(0, Math.min(1, (np.pos || 0) / np.duration)) : 0;
  return (
    <TSCard widget={widget} st={{ gap: 6, justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        {np.cover ? <Image src={np.cover} style={{ width: 40, height: 40, borderRadius: 8 }} /> : null}
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <Text style={tx(st, { size: st.size })} ellipsizeMode="tail" numberOfLines={1}>{np.title}</Text>
          {np.artist ? <Text style={dim(st, { size: Math.max(10, (st.size || 13) - 2) })} ellipsizeMode="tail" numberOfLines={1}>{np.artist}</Text> : null}
        </View>
      </View>
      <Bar st={st0} pct={pct} color={st0.accent || st0.color} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={dim(st, { size: 10 })}>{mmss(np.pos)}</Text>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <Text onClick={() => np.prev?.()} style={tx(st, { size: 14 })}>⏮</Text>
          <Text onClick={() => np.toggle?.()} style={tx(st, { size: 14 })}>{np.playing ? '⏸' : '▶'}</Text>
          <Text onClick={() => np.next?.()} style={tx(st, { size: 14 })}>⏭</Text>
        </View>
        <Text style={dim(st, { size: 10 })}>{mmss(np.duration)}</Text>
      </View>
    </TSCard>
  );
}

function NotesW({ widget, st }) {
  const text = (widget.cfg || {}).text || '';
  return (
    <TSCard widget={widget} st={{ gap: 8 }}>
      <Eyebrow st={eff(widget)} text={tOptional('shell.widgets.note') || 'Note'} />
      <Text style={tx(st, { size: st.size, lineHeight: 1.4 })}>{text || (tOptional('shell.widgets.note.empty') || 'A quiet place for a thought.')}</Text>
    </TSCard>
  );
}

function TodoW({ widget, st }) {
  const rev = usePim();
  const st0 = eff(widget);
  let items = [];
  try { items = (reminders.items() || []).filter((x) => x && !x.done); } catch (e) { items = []; }
  const toggle = (it) => { try { reminders.toggle(it); } catch (e) { /* gone */ } };
  return (
    <TSCard widget={widget} st={{ gap: 6 }}>
      <Eyebrow st={st0} text={tOptional('shell.widgets.todo') || 'Tasks'} />
      {items.length ? items.slice(0, 5).map((it) => (
        <View key={it.uid} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View onClick={() => toggle(it)} style={{ width: 14, height: 14, borderRadius: 4, border: `1.5px solid ${st0.accent || st0.color}` }} />
          <Text style={tx(st, { size: st.size })} ellipsizeMode="tail" numberOfLines={1}>{it.title}</Text>
        </View>
      )) : (
        <Text style={dim(st, { size: st.size })}>{tOptional('shell.widgets.todo.none') || 'All clear'}</Text>
      )}
    </TSCard>
  );
}

function QuoteW({ widget, st }) {
  const cfg = widget.cfg || {};
  return (
    <TSCard widget={widget} st={{ justifyContent: 'center', gap: 6 }}>
      <Text style={tx(st, { size: st.size, lineHeight: 1.35 })}>“{cfg.text || ''}”</Text>
      {cfg.by ? <Text style={dim(st, { size: Math.max(10, Math.round((st.size || 17) * 0.7)), weight: 600 })}>{`— ${cfg.by}`}</Text> : null}
    </TSCard>
  );
}

function PomodoroW({ widget, st }) {
  const t = useStore(clockTimer);
  const st0 = eff(widget);
  const left = timerLeft(t);
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(Math.floor(left % 60)).padStart(2, '0');
  const running = t.state === 'running';
  const Btn = ({ label, onClick }) => (
    <Text onClick={onClick} style={{ ...tx(st, { size: 12, weight: 700 }), color: st0.accent || st0.color, padding: 4 }}>{label}</Text>
  );
  return (
    <TSCard widget={widget} st={{ justifyContent: 'center', gap: 8, alignItems: 'center' }}>
      <Text style={tx(st, { size: st.size, lineHeight: 1.1 })}>{left > 0 ? `${mm}:${ss}` : '25:00'}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {!running ? <Btn label={t.state === 'paused' ? '▶' : 'Start'} onClick={() => (t.state === 'paused' ? timerResume() : timerStart(1500))} /> : null}
        {running ? <Btn label="⏸" onClick={() => timerPause()} /> : null}
        {t.state !== 'idle' ? <Btn label="Reset" onClick={() => timerReset()} /> : null}
      </View>
    </TSCard>
  );
}

function NetworkW({ widget, st }) {
  const tick = useStore(tsStats);
  const ref = useRef(null);
  useEffect(() => { try { insane.monitor?.start?.(); } catch { /* not available */ } }, []);
  try {
    const smp = insane.monitor?.sample?.();
    if (smp && smp.net && isFinite(smp.net.rx)) ref.current = { rx: smp.net.rx, tx: smp.net.tx };
  } catch { /* monitor asleep */ }
  const r = ref.current;
  if (!r) return null;
  const st0 = eff(widget);
  const fmt = (b) => (!isFinite(b) ? '—' : b < 1024 ? `${Math.round(b)} B/s` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB/s` : `${(b / 1048576).toFixed(1)} MB/s`);
  return (
    <TSCard widget={widget} st={{ gap: 8 }}>
      <Eyebrow st={st0} text={tOptional('shell.widgets.network') || 'Network'} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={dim(st, { size: st.size })}>↓</Text>
        <Text style={tx(st, { size: st.size })}>{fmt(r.rx)}</Text>
      </View>
      <Bar st={st0} pct={Math.max(0, Math.min(1, r.rx / 10485760))} color={st0.accent || st0.color} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={dim(st, { size: st.size })}>↑</Text>
        <Text style={tx(st, { size: st.size })}>{fmt(r.tx)}</Text>
      </View>
      <Bar st={st0} pct={Math.max(0, Math.min(1, r.tx / 10485760))} color={st0.accent || st0.color} />
    </TSCard>
  );
}

function StorageW({ widget, st }) {
  const tick = useStore(tsStats);
  const ref = useRef(null);
  try {
    const list = insane.disks?.list?.() || [];
    const root = list.find((d) => d.system && isFinite(d.fssize) && d.fssize > 0) || list.find((d) => isFinite(d.fssize) && d.fssize > 0);
    if (root) ref.current = root;
  } catch { /* no disks api */ }
  const d = ref.current;
  if (!d) return null;
  const st0 = eff(widget);
  return (
    <TSCard widget={widget} st={{ gap: 8 }}>
      <Eyebrow st={st0} text={tOptional('shell.widgets.storage') || 'Storage'} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={tx(st, { size: st.size })}>{`${formatBytes(d.used)} / ${formatBytes(d.fssize)}`}</Text>
      </View>
      <Bar st={st0} pct={Math.max(0, Math.min(1, d.used / d.fssize))} color={st0.accent || st0.color} />
    </TSCard>
  );
}

function LabelW({ widget, st }) {
  const cfg = widget.cfg || {};
  return (
    <TSCard widget={widget} st={{ justifyContent: 'center', gap: 2 }}>
      <Text style={tx(st, { size: st.size })}>{cfg.text || ''}</Text>
      {cfg.sub ? <Text style={dim(st, { size: Math.max(10, Math.round((st.size || 24) * 0.5)), weight: 500 })}>{cfg.sub}</Text> : null}
    </TSCard>
  );
}

function HeadlineW({ widget, st }) {
  const cfg = widget.cfg || {};
  return (
    <TSCard widget={widget} st={{ justifyContent: 'center' }}>
      <Text style={tx(st, { size: st.size, lineHeight: 1.05 })}>{cfg.text || ''}</Text>
    </TSCard>
  );
}

function GaugeW({ widget, st }) {
  const tick = useStore(tsStats);
  const ref = useRef(null);
  useEffect(() => { try { insane.monitor?.start?.(); } catch { /* not available */ } }, []);
  try {
    const smp = insane.monitor?.sample?.();
    const cpu = smp ? (Array.isArray(smp.cpu) ? smp.cpu[smp.cpu.length - 1] : smp.cpu) : null;
    if (cpu != null && isFinite(cpu)) ref.current = Math.max(0, Math.min(1, cpu));
  } catch { /* monitor asleep */ }
  const v = ref.current;
  if (v == null) return null;
  const st0 = eff(widget);
  const face = Math.min(widget.w, widget.h) - (st0.pad ?? 18) * 2 - 8;
  const r = face / 2, cx = face / 2, cy = face / 2;
  const arc = (from, to, col, wdt) => {
    // a drawn ring out of two half-turns: the engine rotates wrapper views around the centre
    const seg = (ang, len) => (
      <View key={`${ang}`} style={{ position: 'absolute', left: 0, top: 0, width: face, height: face, transform: `rotate(${ang}deg)` }}>
        <View style={{ position: 'absolute', left: cx - wdt / 2, top: 2, width: wdt, height: len,
          borderBottomLeftRadius: wdt / 2, borderBottomRightRadius: wdt / 2, backgroundColor: col }} />
      </View>
    );
    const deg = Math.round((to - from) * 360);
    const parts = [];
    for (let a = 0; a < deg; a += 6) parts.push(seg(from * 360 + a, wdt + 2));
    return parts;
  };
  return (
    <TSCard widget={widget} st={{ alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <View style={{ width: face, height: face }}>
        {arc(0, 1, withAlpha(st0.color || '#888888', 0.15), 5)}
        {arc(0.75, 0.75 + v, st0.accent || st0.color, 5)}
        <View style={{ position: 'absolute', left: 0, top: 0, width: face, height: face, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={tx(st, { size: Math.max(13, Math.round(face * 0.26)), weight: 700 })}>{`${Math.round(v * 100)}%`}</Text>
        </View>
      </View>
      <Text style={dim(st, { size: 10 })}>{(tOptional('shell.widgets.cpu') || 'CPU')}</Text>
    </TSCard>
  );
}

// ---------------------------------------------------------------- registration + the bridge

const KINDS = {
  'clock-digital': ClockDigital, 'clock-analog': ClockAnalog, 'clock-world': ClockWorld,
  calendar: CalendarW, agenda: AgendaW, weather: WeatherW, stats: StatsW, battery: BatteryW,
  media: MediaW, notes: NotesW, todo: TodoW, quote: QuoteW, pomodoro: PomodoroW,
  network: NetworkW, storage: StorageW, label: LabelW, headline: HeadlineW, gauge: GaugeW,
};

function TsWidget({ widget }) {
  const C = KINDS[widget.kind];
  if (!C) return null;
  return h(C, { widget, st: eff(widget), key: widget.id });
}

registerWidgetType('ts-widget', TsWidget);

// The store → layer bridge: the live list ordered by z, each instance carrying the theme's style
// baseline pre-merged (the Settings previews compute the same merge for their own theme).
let bridgeInstalled = false;
export function installThemeWidgetBridge() {
  if (bridgeInstalled) return;
  bridgeInstalled = true;
  const bridge = () => {
    const st = tsLive.get();
    if (!st.active || !st.def) { setWidgets('ts-widget', []); return; }
    const list = tsByZ(st.widgets).map((w) => ({ ...w, style: resolveStyle(st.def.style || {}, w.style || {}) }));
    setWidgets('ts-widget', list);
  };
  tsLive.subscribe(bridge);
  bridge();
}

// Boot: resolve the active theme's composition for this work area (the island bar above, the
// Dock strip below — the same area the Widgets page clamps into). A theme that no longer
// resolves degrades to no theme inside tsInit; the desktop keeps exactly what it shows.
try {
  tsInit({ x: 0, y: 28, w: insane.screen.width, h: Math.max(200, insane.screen.height - 28 - 80) });
  installThemeWidgetBridge();
} catch (e) { /* a broken screen probe never blanks the desktop */ }

export { TsWidget, eff as tsEffStyle, KIND_STYLE as TS_KIND_STYLE };
