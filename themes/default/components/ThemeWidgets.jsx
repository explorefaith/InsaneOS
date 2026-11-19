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
  registerWidgetType, setWidgets, tsByZ, tsArranging, tsDesktopUndo, tsSelected, tsMove, tsPersistFlush, tsInit, specOf, createStore, tsHistory, TS_VARIANTS, TS_KINDS, TS_WIDGET_SPECS, TS_PROVIDERS, soundState, defaultSink, sound,
  nowPlaying as npStore, weather as weatherStore, bluetooth as btStore,
  setBluetoothPower, nightActive, setNightManual, sunTimes, useBattery as useBatt, usePim as usePimDep,
  nextAlarm as nextAlarmStore, qualityProfile,
  stopwatch as swStore, swStart, swStop, swReset, swElapsed, tsRichSegments, tsRichTokens, parseColor, ShellBoundary,
} from '@insaneos/sdk';

const hex = (rgb) => (Array.isArray(rgb) ? `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}` : null);
// The kind's name in the interface language, with the spec's English as the fallback.
const kindLabel = (id) => tOptional(`settings.kind.${id}`) || (TS_KINDS[id] || {}).label || id;

// ---------------------------------------------------------------- the shared tickers

const tsClock = sharedTicker((d) => d.getTime(), 1000);                 // the clocks, the calendar
const tsStats = sharedTicker((d) => Math.floor(d.getTime() / 3000), 3000);   // monitor-driven kinds
const tsSlow = sharedTicker((d) => Math.floor(d.getTime() / 60000), 60000);  // moon, year, week, countdown

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

// The desktop-arrange drag: live tsMove per frame, one store commit at the end. The pre-drag
// snapshot travels in a module ref — the Themes page pushes it into its history when it opens.
const arrangeDrag = { current: null };

function TSCard({ widget, children, st }) {
  const style = eff(widget);
  const s = { ...style, ...st };
  const blurPx = s.blur ? Math.round(Math.max(0, Math.min(1, s.blur)) * 28) : 0;
  const effectsOn = settings.get().effects !== false;
  const arranging = useStore(tsArranging);
  const picked = useStore(tsSelected) === widget.id;
  const down = (e) => {
    if (!arranging || widget.locked) { if (arranging) tsSelected.set(null); return; }
    e.stopPropagation?.();
    tsSelected.set(widget.id);
    arrangeDrag.current = { id: widget.id, x: e.x, y: e.y, ox: widget.x, oy: widget.y, moved: false, pre: tsLive.get().widgets.map((w) => ({ ...w })) };
    const move = (ev) => {
      const d = arrangeDrag.current;
      if (!d) return;
      d.moved = true;
      try { tsMove(d.id, d.ox + (ev.x - d.x), d.oy + (ev.y - d.y)); } catch (err) { /* clamped */ }
    };
    const up = () => {
      const d = arrangeDrag.current;
      arrangeDrag.current = null;
      offMove(); offUp();
      if (d && d.moved) {
        tsPersistFlush();
        tsHistory.beginDrag(d.pre);
        tsHistory.endDrag(tsLive.get().widgets.map((w) => ({ ...w, cfg: JSON.parse(JSON.stringify(w.cfg || {})), style: JSON.parse(JSON.stringify(w.style || {})) })));
      }
    };
    const offMove = addListener('pointermove', move);
    const offUp = addListener('pointerup', up);
  };
  const dark = s.modeDark ?? (s.paper ? (() => { const c = parseColor(s.paper); return c ? (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) < 140 : false; })() : false);
  return (
    <View onMouseDown={down} style={[{
      position: 'absolute', left: widget.x, top: widget.y, width: widget.w, height: widget.h,
      padding: s.pad ?? 18, borderRadius: s.radius ?? 16, gap: 6, overflow: 'hidden',
      backgroundColor: s.paper ? withAlpha(s.paper, s.alpha ?? 0.7) : 'transparent',
      backdropFilter: effectsOn && blurPx ? `blur(${blurPx}px) saturate(1.15)` : undefined,
      border: arranging ? `1.5px dashed ${s.accent || '#7ab2ff'}`
        : s.border && s.border !== 'none' ? `1px solid ${s.border}`
        : `1px solid rgba(${dark ? '255,255,255,0.16' : '20,20,30,0.14'})`,
      cursor: arranging && !widget.locked ? 'move' : undefined,
      boxShadow: s.shadow === 'lift' ? '0 18px 44px rgba(8,8,14,0.4)'
        : s.shadow === 'soft' ? '0 10px 30px rgba(12,12,20,0.18)'
        : undefined,
    }, widget._extra]}>
      {/* the top light edge: a 1 px line that makes the surface read as glass */}
      <View style={{ position: 'absolute', left: 8, right: 8, top: 0, height: 1,
        backgroundColor: `rgba(${dark ? '255,255,255,0.22' : '255,255,255,0.5'})`, borderRadius: 1 }} />
      {children}
    </View>
  );
}

// The one-line label above a card's content (the quiet uppercase micro-label — a structural
// device: it names the real thing underneath).
const Eyebrow = ({ st, text, tick = true }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5,
    justifyContent: st.align === 'center' ? 'center' : st.align === 'right' ? 'flex-end' : 'flex-start' }}>
    {tick && text ? <View style={{ width: 8, height: 2, borderRadius: 1, backgroundColor: st.accent || st.color, opacity: 0.85 }} /> : null}
    <Text style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: st.dim || st.color, opacity: 0.72, textAlign: st.align || 'left' }}>
      {(text || '').toUpperCase()}
    </Text>
  </View>
);

const Bar = ({ st, pct, color }) => (
  <View style={{ height: 5, borderRadius: 3, backgroundColor: withAlpha(st.color || '#888888', 0.13), overflow: 'hidden' }}>
    <View style={{ width: `${Math.max(2, Math.min(100, Math.round(pct * 100)))}%`, height: 5, borderRadius: 3, backgroundColor: color || st.accent || st.color }} />
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
      <View style={{ gap: 2 }}>
        <Text style={tx(st, { size: st.size, lineHeight: 1.02, tracking: typeof st.tracking === 'number' ? st.tracking : -1 })}>{`${hh}:${mm}${ss ? `:${ss}` : ''}`}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text style={dim(st, { size: Math.max(12, Math.round((st.size || 56) * 0.22)), weight: 600 })}>
            {weekdayName(d.getDay(), false)}
          </Text>
          {ampm ? <Text style={dim(st, { size: Math.max(10, Math.round((st.size || 56) * 0.18)), weight: 700 })}>{ampm}</Text> : null}
        </View>
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
            <Text style={dim(st, { size: Math.max(10, (st.size || 12) - 2), weight: 700 })}>{n}</Text>
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
  usePimCache();                                // redraws when calendars change; fills the cache
  const evs = (pimCache.get().events || []).filter((e) => e && e.title);
  const st0 = eff(widget);
  return (
    <TSCard widget={widget} st={{ gap: 6 }}>
      <Eyebrow st={st0} text={kindLabel(widget.kind)} />
      {evs.length ? evs.slice(0, 3).map((e, i) => (
        <View key={e.uid || i} style={{ flexDirection: 'row', gap: 8, alignItems: 'baseline' }}>
          <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: st0.accent || st0.color, opacity: 0.8 }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={tx(st, { size: st.size , whiteSpace: 'nowrap', textOverflow: 'ellipsis', numberOfLines: 1 })}>{e.title}</Text>
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
          <View onClick={() => weatherConsent(true)} style={{ alignSelf: st.align === 'center' ? 'center' : 'flex-start', borderBottomWidth: 1, borderBottomColor: st0.accent || st0.color }}>
            <Text style={dim(st, { size: 11, color: st0.accent || st0.color })}>
              {tOptional('shell.weather.allow') || 'Allow'}
            </Text>
          </View>
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
          <Text style={tx(st, { size: st.size , whiteSpace: 'nowrap', textOverflow: 'ellipsis', numberOfLines: 1 })}>{np.title}</Text>
          {np.artist ? <Text style={dim(st, { size: Math.max(10, (st.size || 13) - 2) , whiteSpace: 'nowrap', textOverflow: 'ellipsis', numberOfLines: 1 })}>{np.artist}</Text> : null}
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
  const cfg = widget.cfg || {};
  const rich = tsRichSegments(cfg, cfg.text);
  return (
    <TSCard widget={widget} st={{ gap: 8 }}>
      <Eyebrow st={eff(widget)} text={kindLabel(widget.kind)} />
      {rich && rich.length ? <RichFlow widget={widget} st={st} cfg={cfg} />
        : <Text style={tx(st, { size: st.size, lineHeight: 1.4 })}>{tOptional('shell.widgets.note.empty') || 'A quiet place for a thought.'}</Text>}
    </TSCard>
  );
}

function TodoW({ widget, st }) {
  usePimCache();
  const st0 = eff(widget);
  const items = pimCache.get().todos || [];
  const toggle = (it) => { try { reminders.toggle(it); } catch (e) { /* gone */ } };
  return (
    <TSCard widget={widget} st={{ gap: 6 }}>
      <Eyebrow st={st0} text={kindLabel(widget.kind)} />
      {items.length ? items.slice(0, 5).map((it) => (
        <View key={it.uid} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View onClick={() => toggle(it)} style={{ width: 14, height: 14, borderRadius: 4, border: `1.5px solid ${st0.accent || st0.color}` }} />
          <Text style={tx(st, { size: st.size , whiteSpace: 'nowrap', textOverflow: 'ellipsis', numberOfLines: 1 })}>{it.title}</Text>
        </View>
      )) : (
        <Text style={dim(st, { size: st.size })}>{tOptional('shell.widgets.todo.none') || 'All clear'}</Text>
      )}
    </TSCard>
  );
}

function QuoteW({ widget, st }) {
  const cfg = widget.cfg || {};
  const rich = tsRichSegments(cfg, cfg.text);
  return (
    <TSCard widget={widget} st={{ justifyContent: 'center', gap: 6 }}>
      {rich && rich.length ? <RichFlow widget={widget} st={st} cfg={{ ...cfg, rich: [{ ...rich[0], t: `“${rich[0].t}` }, ...rich.slice(1)] }} />
        : <Text style={tx(st, { size: st.size, lineHeight: 1.35 })}>“{cfg.text || ''}”</Text>}
      {cfg.by ? <Text style={dim(st, { size: Math.max(10, Math.round((st.size || 17) * 0.7)), weight: 600 })}>{`— ${cfg.by}`}</Text> : null}
    </TSCard>
  );
}

function PomodoroW({ widget, st }) {
  const t = useStore(clockTimer);
  useStore(tsClock);                            // the countdown re-renders each second while it runs
  const st0 = eff(widget);
  const left = timerLeft(t);                    // ms
  const mm = String(Math.floor(left / 60000)).padStart(2, '0');
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
  const running = t.state === 'running';
  const Btn = ({ label, onClick }) => (
    <Text onClick={onClick} style={{ ...tx(st, { size: 12, weight: 700 }), color: st0.accent || st0.color, padding: 4 }}>{label}</Text>
  );
  return (
    <TSCard widget={widget} st={{ justifyContent: 'center', gap: 8, alignItems: 'center' }}>
      <Eyebrow st={st0} text={kindLabel(widget.kind)} />
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
  const rich = tsRichSegments(cfg, cfg.text);
  return (
    <TSCard widget={widget} st={{ justifyContent: 'center', gap: 2 }}>
      {rich && rich.length ? <RichFlow widget={widget} st={st} cfg={cfg} />
        : <Text style={tx(st, { size: st.size, whiteSpace: 'nowrap', textOverflow: 'ellipsis', numberOfLines: 1, overflow: 'hidden' })}>{cfg.text || ''}</Text>}
      {cfg.sub ? <Text style={dim(st, { size: Math.max(10, Math.round((st.size || 24) * 0.5)), weight: 500 })}>{cfg.sub}</Text> : null}
    </TSCard>
  );
}

function HeadlineW({ widget, st }) {
  const cfg = widget.cfg || {};
  const rich = tsRichSegments(cfg, cfg.text);
  return (
    <TSCard widget={widget} st={{ justifyContent: 'center' }}>
      {rich && rich.length ? <RichFlow widget={widget} st={st} cfg={cfg} />
        : <Text style={tx(st, { size: st.size, lineHeight: 1.05, whiteSpace: 'nowrap', textOverflow: 'ellipsis', numberOfLines: 2, overflow: 'hidden' })}>{cfg.text || ''}</Text>}
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


// ---------------------------------------------------------------- the providers
// Every src in sdk/ts-widget-specs.js resolves here — real data only, read defensively: a source
// this machine lacks (no sensor, no GPU, no voltage chip, no swap, no battery) yields null and
// the variant draws its quiet state. Field shapes verified against the C that serves them
// (docs/INSANE-DESKTOP-PERSONALIZATION-PROGRESS.md, "Architecture findings").

const tryDo = (fn) => { try { return fn(); } catch (e) { return null; } };
const monSample = () => tryDo(() => { insane.monitor?.start?.(); return insane.monitor?.sample?.() || null; });
const sysInfo = () => tryDo(() => insane.system?.info?.() || null);

// Client-side ring buffers of real samples (the monitor keeps no long history; these grow only
// while a history widget is mounted — 60 points at the 3 s tick is three minutes).
const HIST = {};
const pushHist = (key, v) => {
  const a = (HIST[key] ||= []);
  const win = Math.floor(Date.now() / 3000);
  if (a.win === win) return a;               // already sampled this window (any number of renders)
  if (Number.isFinite(v)) {
    a.win = win;
    a.push(v);
    if (a.length > 60) a.shift();
  }
  return a;
};

// The sources the monitor publishes only while wanted (voltage, gpu, connections): ask once per
// read and keep the last good answer — the first ticks render quiet, then the data arrives.
const LASTGOOD = {};
const wantAndTake = (src, want, take) => {
  tryDo(want);
  const v = tryDo(take);
  if (v != null) LASTGOOD[src] = v;
  return LASTGOOD[src] || null;
};
const netHist = () => {
  const s = monSample();
  if (!s) return pushHist('net', NaN);
  return pushHist('net', ((s.net?.rx || 0) + (s.net?.tx || 0)) / 1048576);   // MB/s, like ioHistory
};

const pctOf = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && b > 0 ? Math.max(0, Math.min(1, a / b)) : null);
const kb = (v) => (Number.isFinite(v) ? formatBytes(v * 1024) : null);
const pctStr = (p) => (Number.isFinite(p) ? `${Math.round(p * 100)}%` : null);
const p100 = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v <= 1 ? v : v / 100)) : null);
const hms = (sec) => {
  if (!Number.isFinite(sec) || sec < 0) return null;
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
};
const clockNow = () => new Date();
const isoWeek = (d) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil((((t - y0) / 86400000) + 1) / 7);
};
const moonAge = (d) => {
  // a real derivation: the moon's age in days from a known new moon (2000-01-06 18:14 UTC)
  const synodic = 29.530588853;
  const known = Date.UTC(2000, 0, 6, 18, 14);
  const days = (d.getTime() - known) / 86400000;
  return ((days % synodic) + synodic) % synodic;
};
const moonName = (age) => {
  const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  return names[Math.round((age / 29.530588853) * 8) % 8];
};
const eventCount = () => tryDo(() => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return (calendarEvents.range(start.getTime(), end.getTime()) || []).length;
});
const openTodos = () => tryDo(() => (reminders.items() || []).filter((x) => x && !x.done)) || [];

const PROV = {
  clockTime: () => ({ text: '' }),
  clockDate: () => ({ text: '' }),
  weekNumber: () => ({ value: `${isoWeek(clockNow())}`, sub: 'ISO week' }),
  nextAlarm: () => {
    const a = nextAlarmStore.get();
    return a && a.at ? { value: new Date(a.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), sub: a.label || '' } : null;
  },
  eventsCount: () => { const c = pimCache.get(); if (!c || !Array.isArray(c.events)) return null; return { value: `${c.events.length}`, sub: 'today' }; },
  sunTimes: () => {
    const s = sunTimes();
    if (!s) return null;
    const hm = (m) => (Number.isFinite(m) ? `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}` : '—');
    return { rows: [['Sunrise', hm(s.sunrise)], ['Sunset', hm(s.sunset)]] };
  },
  cpu: () => { const s = monSample(); return s && Number.isFinite(s.cpu) ? { value: pctStr(s.cpu), pct: s.cpu } : null; },
  cpuCores: () => { const s = monSample(); return s && Array.isArray(s.cores) && s.cores.length ? { series: s.cores.map((v) => Math.max(0, Math.min(1, v))) } : null; },
  cpuHistory: () => { const s = monSample(); const raw = s?.cpu; const a = pushHist('cpu', Array.isArray(raw) ? raw[raw.length - 1] : raw); return a.length > 1 ? { series: a.slice(), value: pctStr(a[a.length - 1]), max: 1 } : null; },
  loadAvg: () => { const s = monSample(); return s?.load ? { rows: [['1 min', s.load[0].toFixed(2)], ['5 min', s.load[1].toFixed(2)], ['15 min', s.load[2].toFixed(2)]] } : null; },
  load1: () => { const s = monSample(); return s?.load ? { value: s.load[0].toFixed(2), sub: `of ${sysInfo()?.cores || '?'} cores` } : null; },
  cpuModel: () => { const i = sysInfo(); return i?.cpu ? { text: i.cpu, sub: `${i.cores || '?'} cores` } : null; },
  cpuCoresCount: () => { const i = sysInfo(); return i?.cores ? { value: `${i.cores}`, sub: 'cores' } : null; },
  ram: () => { const s = monSample(); const m = s?.mem; if (!m) return null; const p = pctOf(m.used, m.total); return p == null ? null : { value: pctStr(p), pct: p, sub: kb(m.used / 1024) }; },
  ramApps: () => { const s = monSample(); return s?.mem && Number.isFinite(s.mem.apps) ? { value: kb(s.mem.apps / 1024), sub: 'apps hold' } : null; },
  ramCache: () => { const s = monSample(); return s?.mem && Number.isFinite(s.mem.cache) ? { value: kb(s.mem.cache / 1024), sub: 'cached' } : null; },
  ramHistory: () => { const s = monSample(); const p = s?.mem ? pctOf(s.mem.used, s.mem.total) : NaN; const a = pushHist('ram', p); return a.length > 1 ? { series: a.slice(), value: pctStr(a[a.length - 1]), max: 1 } : null; },
  ramRows: () => {
    const s = monSample(); const m = s?.mem;
    if (!m) return null;
    return { rows: [['Used', kb(m.used / 1024)], ['Apps', kb(m.apps / 1024)], ['System', kb(m.system / 1024)], ['Cache', kb(m.cache / 1024)], ['Swap', m.swapTotal ? kb(m.swapUsed / 1024) : 'none']] };
  },
  swap: () => { const s = monSample(); const m = s?.mem; if (!m || !m.swapTotal) return null; const p = pctOf(m.swapUsed, m.swapTotal); return p == null ? null : { value: pctStr(p), pct: p, sub: kb(m.swapUsed / 1024) }; },
  tasksRunning: () => { const s = monSample(); return s?.tasks ? { value: `${s.tasks.running}`, sub: `of ${s.tasks.total}` } : null; },
  tasksTotal: () => { const s = monSample(); return s?.tasks ? { value: `${s.tasks.total}`, sub: 'tasks' } : null; },
  temp: () => { const s = monSample(); return s && Number.isFinite(s.temp) ? { value: `${Math.round(s.temp)}°C`, pct: Math.max(0, Math.min(1, (s.temp - 30) / 60)), hot: s.temp >= 70 } : null; },
  diskTemp: () => {
    const d = tryDo(() => insane.monitor?.diskTemps?.());
    const t = d?.disks?.find((x) => Number.isFinite(x.temp))?.temp;
    return Number.isFinite(t) ? { value: `${Math.round(t)}°C`, sub: d.disks[0].name } : null;
  },
  pressure: () => {
    const p = tryDo(() => insane.system?.pressure?.());
    const some = Number.isFinite(p?.some60) && p.some60 >= 0 ? p.some60 / 100 : NaN;   // -1: no PSI
    return Number.isFinite(some) ? { value: pctStr(some), pct: some, sub: 'PSI 60 s' } : null;
  },
  voltage: () => {
    const v = wantAndTake('voltage', () => insane.monitor?.wantVoltage?.(true), () => insane.monitor?.voltage?.());
    const val = v?.chips?.[0]?.in?.find((x) => Number.isFinite(x.v))?.v;
    return Number.isFinite(val) ? { value: `${val.toFixed(2)} V`, sub: v.chips[0].name || '' } : null;
  },
  gpuName: () => { const g = wantAndTake('gpu', () => insane.monitor?.wantGpu?.(true), () => insane.monitor?.gpu?.()); const c = g?.cards?.[0]?.name || g?.cards?.[0]?.card; return c ? { text: c } : null; },
  gpuBusy: () => { const g = wantAndTake('gpu', () => insane.monitor?.wantGpu?.(true), () => insane.monitor?.gpu?.()); const p = Number(g?.cards?.[0]?.busy); return Number.isFinite(p) && p >= 0 ? { value: pctStr(p / 100), pct: Math.max(0, Math.min(1, p / 100)) } : null; },
  gpuClients: () => { const g = wantAndTake('gpu', () => insane.monitor?.wantGpu?.(true), () => insane.monitor?.gpu?.()); const n = g?.clients?.length; return Number.isFinite(n) ? { value: `${n}`, sub: 'using the GPU' } : null; },
  diskUsed: () => {
    const list = tryDo(() => insane.disks?.list?.()) || [];
    const root = list.find((d) => d.system && Number.isFinite(d.fssize) && d.fssize > 0) || list.find((d) => Number.isFinite(d.fssize) && d.fssize > 0);
    if (!root) return null;
    const p = pctOf(root.used, root.fssize);
    return p == null ? null : { value: pctStr(p), pct: p, sub: `${formatBytes(root.used)} / ${formatBytes(root.fssize)}` };
  },
  diskFree: () => {
    const list = tryDo(() => insane.disks?.list?.()) || [];
    const root = list.find((d) => d.system && Number.isFinite(d.fssize) && d.fssize > 0) || list.find((d) => Number.isFinite(d.fssize) && d.fssize > 0);
    return root ? { value: formatBytes(root.avail), sub: 'free' } : null;
  },
  diskList: () => {
    const list = tryDo(() => insane.disks?.list?.()) || [];
    const disks = list.filter((d) => Number.isFinite(d.fssize) && d.fssize > 0).slice(0, 4);
    return disks.length ? { rows: disks.map((d) => [d.name || d.device || 'disk', `${pctStr(pctOf(d.used, d.fssize)) || '—'} · ${formatBytes(d.used)}`]) } : null;
  },
  ioRead: () => { const s = monSample(); return s?.disk ? { value: formatBytes(s.disk.read) + '/s', sub: 'read' } : null; },
  ioWrite: () => { const s = monSample(); return s?.disk ? { value: formatBytes(s.disk.write) + '/s', sub: 'write' } : null; },
  ioHistory: () => { const s = monSample(); const v = s?.disk ? (s.disk.read + s.disk.write) / 1048576 : NaN; const a = pushHist('io', v); return a.length > 1 ? { series: a.slice(), value: `${formatBytes(a[a.length - 1] * 1048576)}/s` } : null; },
  battery: () => {
    const b = useBattRef();
    if (!b || !b.hasBattery) return null;
    return { value: b.percent >= 0 ? `${b.percent}%` : '—', pct: Number.isFinite(b.percent) ? b.percent / 100 : null, sub: b.charging ? 'charging' : b.onAC ? 'on power' : 'on battery' };
  },
  batteryTime: () => {
    const b = useBattRef();
    if (!b || !b.hasBattery || !(b.minutesLeft > 0)) return null;
    return { value: hms(b.minutesLeft * 60), sub: b.charging ? 'to full' : 'left' };
  },
  batteryState: () => {
    const b = useBattRef();
    if (!b || !b.hasBattery) return null;
    return { text: b.charging ? 'Charging' : b.onAC ? 'On power' : 'On battery', sub: b.percent >= 0 ? `${b.percent}%` : '' };
  },
  powerMode: () => ({ text: (qualityProfile() || 'auto').replace(/^./, (c) => c.toUpperCase()) }),
  nightLight: () => ({ on: !!nightActive() }),
  mediaTitle: () => { const np = npStore.get(); return np?.title ? { text: np.title, sub: np.artist || '' } : null; },
  mediaProgress: () => {
    const np = npStore.get();
    if (!np?.duration) return null;
    const p = Math.max(0, Math.min(1, (np.pos || 0) / np.duration));
    const mmss = (x) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;
    return { pct: p, value: mmss(np.pos || 0), sub: mmss(np.duration) };
  },
  mediaCover: () => { const np = npStore.get(); return np?.cover ? { src: np.cover } : null; },
  volume: () => { const out = defaultSink(soundState.get()); if (!out || !Number.isFinite(out.level)) return null; return { value: `${Math.round(out.level * 100)}%`, pct: out.level, sub: out.mute ? 'muted' : '' }; },
  mute: () => { const out = defaultSink(soundState.get()); if (!out) return null; return { on: !!out.mute || out.level === 0 }; },
  audioOutput: () => { const out = defaultSink(soundState.get()); const name = out?.description || out?.name; return name ? { text: name, sub: out.activePort || '' } : null; },
  netDown: () => { const s = monSample(); return s?.net ? { value: `${formatBytes(s.net.rx)}/s`, sub: 'down' } : null; },
  netUp: () => { const s = monSample(); return s?.net ? { value: `${formatBytes(s.net.tx)}/s`, sub: 'up' } : null; },
  netTotalDown: () => { const s = monSample(); return s?.net && Number.isFinite(s.net.rxTotal) ? { value: formatBytes(s.net.rxTotal), sub: 'received' } : null; },
  netTotalUp: () => { const s = monSample(); return s?.net && Number.isFinite(s.net.txTotal) ? { value: formatBytes(s.net.txTotal), sub: 'sent' } : null; },
  netHistory: () => { const a = netHist(); return a.length > 1 ? { series: a.slice(), value: `${formatBytes(a[a.length - 1] * 1048576)}/s` } : null; },
  netIfs: () => {
    const ifs = tryDo(() => insane.net?.interfaces?.()) || [];
    const rows = ifs.filter((x) => x.up).slice(0, 4).map((x) => [x.name, x.carrier ? 'connected' : 'no carrier']);
    return rows.length ? { rows } : null;
  },
  connCount: () => { const c = wantAndTake('conns', () => insane.monitor?.want?.(true, true, false), () => insane.monitor?.connections?.()); const n = c?.list?.length; return Number.isFinite(n) ? { value: `${n}`, sub: 'connections' } : null; },
  wifiState: () => {
    const ifs = tryDo(() => insane.net?.interfaces?.()) || [];
    const wifi = ifs.find((x) => x.type === 'wifi' || /wl|ath|wlan/.test(x.name || ''));
    if (!wifi) return null;
    return { value: wifi.carrier ? 'Connected' : wifi.up ? 'Ready' : 'Off', sub: wifi.name, pct: wifi.carrier ? 1 : wifi.up ? 0.5 : 0 };
  },
  bluetooth: () => { const b = btStore.get(); if (!b) return null; return { on: !!b.adapter?.powered, sub: (b.devices || []).some((d) => d.connected) ? 'connected' : '' }; },
  todoCount: () => { const c = pimCache.get(); if (!c || !Array.isArray(c.todos)) return null; return { value: `${c.todos.length}`, sub: 'open' }; },
  todoFlagged: () => {
    const c = pimCache.get();
    if (!c || !Array.isArray(c.todos)) return null;
    const items = c.todos.filter((x) => x.flag);
    return items.length ? { rows: items.slice(0, 4).map((x) => [x.title, x.listName || '']) } : { rows: [] };
  },
  osVersion: () => { const i = sysInfo(); return i?.os ? { text: i.os, sub: i.version ? `Insane OS ${i.version}${i.channel ? ` · ${i.channel}` : ''}` : '' } : null; },
  kernel: () => { const i = sysInfo(); return i?.kernel ? { text: i.kernel, sub: i.arch } : null; },
  hostname: () => { const i = sysInfo(); return i?.hostname ? { text: i.hostname } : null; },
  userName: () => { const i = sysInfo(); return i?.fullName || i?.user ? { text: i.fullName || i.user, sub: i.admin ? 'administrator' : '' } : null; },
  arch: () => { const i = sysInfo(); return i?.arch ? { text: i.arch } : null; },
  board: () => { const i = sysInfo(); return i?.board ? { text: i.board } : null; },
  build: () => { const i = sysInfo(); return i?.build ? { text: `${i.version || ''} ${i.build}`, sub: i.channel || '' } : null; },
  bootTime: () => { const i = sysInfo(); return i && Number.isFinite(i.bootSeconds) ? { value: `${Math.round(i.bootSeconds)}s`, sub: 'to first frame' } : null; },
  uptime: () => { const s = monSample(); const u = s?.uptime ?? sysInfo()?.uptime; const v = hms(u); return v ? { value: v, sub: 'uptime' } : null; },
  timezone: () => { const tz = tryDo(() => Intl.DateTimeFormat().resolvedOptions().timeZone); return tz ? { text: tz.replace(/_/g, ' ') } : null; },
  displayInfo: () => {
    const d = tryDo(() => insane.screen || null);
    if (!d?.width) return null;
    return { text: `${d.width}×${d.height}`, sub: `${d.scale ? `${d.scale}× ` : ''}scale` };
  },
  weatherTemp: () => { const w = weatherStore.get(); const t = w?.data?.current?.temperature_2m; return Number.isFinite(t) ? { value: `${Math.round(t)}°`, sub: 'outside' } : null; },
  weatherCond: () => {
    const w = weatherStore.get();
    const code = w?.data?.current?.weather_code;
    if (code == null) return null;
    return { text: tOptional(`shell.weather.cond.${weatherGroup(code)}`) || '', sub: w.stale ? 'cached' : '' };
  },
  weatherHumidity: () => { const w = weatherStore.get(); const h = w?.data?.current?.relative_humidity_2m; return Number.isFinite(h) ? { value: `${Math.round(h)}%`, sub: 'humidity' } : null; },
  weatherWind: () => { const w = weatherStore.get(); const v = w?.data?.current?.wind_speed_10m; return Number.isFinite(v) ? { value: `${Math.round(v)} km/h`, sub: 'wind' } : null; },
  weatherRange: () => {
    const w = weatherStore.get();
    const d0 = w?.data?.daily?.temperature_2m_max?.[0], n0 = w?.data?.daily?.temperature_2m_min?.[0];
    return Number.isFinite(d0) && Number.isFinite(n0) ? { value: `${Math.round(n0)}° / ${Math.round(d0)}°`, sub: 'today' } : null;
  },
  weatherForecast: () => {
    const w = weatherStore.get();
    const d = w?.data?.daily;
    if (!d?.temperature_2m_max?.length) return null;
    return { forecast: d.time.slice(0, 7).map((day, i) => ({ day, hi: d.temperature_2m_max[i], lo: d.temperature_2m_min[i], code: d.weather_code?.[i] })) };
  },
  dayProgress: () => { const d = clockNow(); const p = (d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()) / 86400; return { pct: p, value: pctStr(p) }; },
  yearProgress: () => { const d = clockNow(); const y0 = new Date(d.getFullYear(), 0, 1), y1 = new Date(d.getFullYear() + 1, 0, 1); const p = (d - y0) / (y1 - y0); return { pct: p, value: pctStr(p) }; },
  modeBadge: () => { const m = settings.get().mode; return { text: m === 'light' ? 'Light' : 'Dark', sub: '' }; },
};

// battery reads through the hook's store; the providers are plain functions, so the hook value
// arrives via a ref the battery variant keeps (the hook itself runs in useProviderDeps).
let battNow = null;
function useBattRef() { return battNow; }

// Calendar/Reminders are async (maild round-trips) — no provider may call them in render (a
// Promise.filter is the fake-empty bug). One cache, filled by an effect keyed on the PIM
// revision; until the first fetch lands the providers answer null (quiet), never a fake 0.
const pimCache = createStore({ events: null, todos: null });
function usePimCache() {
  const rev = usePimDep();
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const end = new Date(start); end.setDate(end.getDate() + 1);
        const evs = await calendarEvents.range(start.getTime(), end.getTime());
        const todos = await reminders.items();
        if (alive) pimCache.set({ events: evs || [], todos: (todos || []).filter((x) => x && !x.done) });
      } catch (e) { if (alive) pimCache.set({ events: [], todos: null }); }
    })();
    return () => { alive = false; };
  }, [rev]);
}


// ---------------------------------------------------------------- the provider deps + generic variants

// The hooks a generic widget's provider may need. The tick follows the kind's category: the
// time and ambient kinds breathe once a second, the measured ones on the shared 3 s tick —
// never both. The push stores (nowPlaying, weather, sound, bluetooth, night, PIM) subscribe
// always; they notify only on a real change.
function useProviderDeps(kind) {
  battNow = useBatt();
  const fam = familyOf(specOf(kind)?.src);
  if (fam.np) useStore(npStore);
  if (fam.weather) useStore(weatherStore);
  if (fam.bt) useStore(btStore);
  if (fam.sound) useStore(soundState);
  if (fam.sw) useStore(swStore);
  if (fam.pim) usePimCache();
  const cat = specOf(kind)?.cat;
  useStore(cat === 'time' ? tsClock : cat === 'ambient' ? tsSlow : tsStats);
}

// The push stores a widget's src actually needs — hooks stay stable per instance because a
// widget's kind (and therefore its family) never changes after mount.
const familyOf = (src) => ({
  np: !!src && src.startsWith('media'),
  weather: !!src && src.startsWith('weather'),
  bt: src === 'bluetooth',
  sound: src === 'volume' || src === 'mute' || src === 'audioOutput',
  pim: src === 'todoCount' || src === 'todoFlagged' || src === 'eventsCount',
});

const quiet = (widget, st, text) => (
  <TSCard widget={widget} st={{ justifyContent: 'center' }}>
    <Text style={dim(st, { size: Math.max(11, Math.round((st.size || 14) * 0.8)) })}>{text || '—'}</Text>
  </TSCard>
);

function ValueW({ widget, st }) {
  useProviderDeps(widget.kind);
  const d = PROV[specOf(widget.kind)?.src]?.(widget);
  if (!d) return quiet(widget, st, tOptional('shell.widgets.noData') || 'No data');
  return (
    <TSCard widget={widget} st={{ justifyContent: 'center', gap: 4 }}>
      {d.sub && d.sub.length <= 12 ? <Eyebrow st={st} text={d.sub} /> : null}
      <Text style={tx(st, { size: st.size || 30, lineHeight: 1.05, color: d.hot ? '#ff453a' : undefined, whiteSpace: 'nowrap', textOverflow: 'ellipsis', numberOfLines: 1, overflow: 'hidden' })}>{d.value}</Text>
      {d.pct != null ? <Bar st={st} pct={d.pct} color={st.accent || st.color} /> : null}
      {d.sub && d.sub.length > 12 ? <Text style={dim(st, { size: 10 })}>{d.sub}</Text> : null}
    </TSCard>
  );
}

function RingW({ widget, st }) {
  useProviderDeps(widget.kind);
  const d = PROV[specOf(widget.kind)?.src]?.(widget);
  if (!d || d.pct == null) return quiet(widget, st, tOptional('shell.widgets.noData') || 'No data');
  const face = Math.min(widget.w, widget.h) - (st.pad ?? 18) * 2 - (d.sub ? 18 : 6);
  const seg = (ang, col, len) => (
    <View key={`${ang}`} style={{ position: 'absolute', left: 0, top: 0, width: face, height: face, transform: `rotate(${ang}deg)` }}>
      <View style={{ position: 'absolute', left: face / 2 - 2.5, top: 3, width: 5, height: len,
        borderBottomLeftRadius: 2.5, borderBottomRightRadius: 2.5, backgroundColor: col }} />
    </View>
  );
  const parts = [];
  for (let a = 0; a < 360; a += 4.5) parts.push(seg(a, withAlpha(st.color || '#888888', 0.13), 4));
  const filled = Math.round((d.pct || 0) * 80);
  for (let i = 0; i < filled; i++) parts.push(seg(i * 4.5, d.hot ? '#ff453a' : (st.accent || st.color || '#888888'), 4));
  return (
    <TSCard widget={widget} st={{ alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <View style={{ width: face, height: face }}>
        {parts}
        <View style={{ position: 'absolute', left: 0, top: 0, width: face, height: face, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={tx(st, { size: Math.max(13, Math.round(face * 0.26)), weight: 700 })}>{d.value}</Text>
        </View>
      </View>
      {d.sub ? <Text style={dim(st, { size: 10 })}>{d.sub}</Text> : null}
    </TSCard>
  );
}

function ChartW({ widget, st }) {
  useProviderDeps(widget.kind);
  const d = PROV[specOf(widget.kind)?.src]?.(widget);
  if (!d?.series?.length) return quiet(widget, st, tOptional('shell.widgets.noData') || 'No data');
  const bars = d.series.slice(-16);
  return (
    <TSCard widget={widget} st={{ justifyContent: 'flex-end', gap: 6 }}>
      <Eyebrow st={st} text={kindLabel(widget.kind)} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: Math.max(30, widget.h - (st.pad ?? 18) * 2 - 30) }}>
        {bars.map((v, i) => (
          <View key={i} style={{ flex: 1, height: `${Math.max(4, Math.round(v * 100))}%`, borderRadius: 2,
            backgroundColor: st.accent || st.color, opacity: 0.85 }} />
        ))}
      </View>
    </TSCard>
  );
}

function SparkW({ widget, st }) {
  useProviderDeps(widget.kind);
  const d = PROV[specOf(widget.kind)?.src]?.(widget);
  if (!d?.series?.length) return quiet(widget, st, tOptional('shell.widgets.noData') || 'No data');
  const max = d.max || Math.max(...d.series, 0.0001);
  const min = Math.min(...d.series, 0);
  const span = max - min || 1;
  const n = d.series.length;
  const w = widget.w - (st.pad ?? 18) * 2, h = Math.max(16, widget.h - (st.pad ?? 18) * 2 - 26);
  const pts = d.series.map((v, i) => ({ x: (i / Math.max(1, n - 1)) * w, y: h - ((v - min) / span) * h }));
  return (
    <TSCard widget={widget} st={{ justifyContent: 'flex-end', gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Eyebrow st={st} text={kindLabel(widget.kind)} />
        <Text style={tx(st, { size: Math.max(11, st.size || 12) })}>{d.value || ''}</Text>
      </View>
      <View style={{ width: w, height: h }}>
        {pts.map((p, i) => (i ? (
          <View key={i} style={{ position: 'absolute', left: pts[i - 1].x, top: Math.min(pts[i - 1].y, p.y),
            width: Math.max(2, p.x - pts[i - 1].x + 1.5), height: Math.max(2, Math.abs(p.y - pts[i - 1].y) + 1.5),
            backgroundColor: st.accent || st.color, opacity: 0.8 }} />
        ) : null))}
      </View>
    </TSCard>
  );
}

function RowsW({ widget, st }) {
  useProviderDeps(widget.kind);
  const d = PROV[specOf(widget.kind)?.src]?.(widget);
  if (!d?.rows?.length) return quiet(widget, st, tOptional('shell.widgets.noData') || 'No data');
  return (
    <TSCard widget={widget} st={{ justifyContent: 'center', gap: 5 }}>
      <Eyebrow st={st} text={kindLabel(widget.kind)} />
      {d.rows.slice(0, 5).map(([k, v], i) => (
        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={dim(st, { size: st.size || 12 , whiteSpace: 'nowrap', textOverflow: 'ellipsis', numberOfLines: 1 })}>{k}</Text>
          <Text style={tx(st, { size: st.size || 12 })}>{String(v)}</Text>
        </View>
      ))}
    </TSCard>
  );
}

function TextW({ widget, st }) {
  useProviderDeps(widget.kind);
  const d = PROV[specOf(widget.kind)?.src]?.(widget);
  if (!d?.text) return quiet(widget, st, tOptional('shell.widgets.noData') || 'No data');
  return (
    <TSCard widget={widget} st={{ justifyContent: 'center', gap: 3 }}>
      <Text style={tx(st, { size: st.size || 15, lineHeight: 1.25 , whiteSpace: 'nowrap', textOverflow: 'ellipsis', numberOfLines: 2 })}>{d.text}</Text>
      {d.sub ? <Text style={dim(st, { size: Math.max(10, Math.round((st.size || 15) * 0.72)) })}>{d.sub}</Text> : null}
    </TSCard>
  );
}

function BarW({ widget, st }) {
  useProviderDeps(widget.kind);
  const d = PROV[specOf(widget.kind)?.src]?.(widget);
  if (!d || d.pct == null) return quiet(widget, st, tOptional('shell.widgets.noData') || 'No data');
  return (
    <TSCard widget={widget} st={{ justifyContent: 'center', gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={dim(st, { size: Math.max(10, Math.round((st.size || 12) * 0.85)) })}>{d.sub || ''}</Text>
        <Text style={tx(st, { size: st.size || 12 })}>{d.value}</Text>
      </View>
      <Bar st={st} pct={d.pct} color={st.accent || st.color} />
    </TSCard>
  );
}

function ProgressW({ widget, st }) {
  useProviderDeps(widget.kind);
  const d = PROV[specOf(widget.kind)?.src]?.(widget);
  if (!d) return quiet(widget, st);
  return (
    <TSCard widget={widget} st={{ justifyContent: 'center', gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Eyebrow st={st} text={kindLabel(widget.kind)} />
        <Text style={tx(st, { size: st.size || 12 })}>{d.value}</Text>
      </View>
      <Bar st={st} pct={d.pct} color={st.accent || st.color} />
    </TSCard>
  );
}

function BinaryW({ widget, st }) {
  useProviderDeps(widget.kind);
  const d = clockNow();
  const cols = [[d.getHours(), 2], [d.getMinutes(), 3], [d.getSeconds(), 3]];
  const accent = st.accent || st.color;
  return (
    <TSCard widget={widget} st={{ alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {cols.map(([v, bits], ci) => (
          <View key={ci} style={{ flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            {Array.from({ length: bits }, (_, bi) => {
              const on = !!(v & (1 << (bits - 1 - bi)));
              return <View key={bi} style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: on ? accent : withAlpha(st.color || '#888888', 0.15) }} />;
            })}
          </View>
        ))}
      </View>
      <Text style={dim(st, { size: 10 })}>{`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`}</Text>
    </TSCard>
  );
}

function WeekW({ widget, st }) {
  useProviderDeps(widget.kind);
  const d = clockNow();
  const today = d.getDate();
  const dow = (d.getDay() + 6) % 7;                 // Monday-first
  const weekStart = today - dow;
  const monthLen = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const accent = st.accent || st.color;
  return (
    <TSCard widget={widget} st={{ justifyContent: 'center', gap: 6 }}>
      <Eyebrow st={st} text={monthName(d.getMonth())} />
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {Array.from({ length: 7 }, (_, i) => {
          const day = weekStart + i;
          const inMonth = day >= 1 && day <= monthLen;
          const isToday = day === today;
          const wd = weekdayName((i + 1) % 7, true).slice(0, 2);
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
              <Text style={dim(st, { size: 10 })}>{wd}</Text>
              <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: isToday ? accent : 'transparent' }}>
                <Text style={tx(st, { size: st.size || 12, weight: isToday ? 700 : 400, color: isToday ? (st.paper || '#fff') : inMonth ? st.color : st.dim })}>
                  {inMonth ? day : '·'}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </TSCard>
  );
}

function MoonW({ widget, st }) {
  useProviderDeps(widget.kind);
  const age = moonAge(clockNow());
  const phase = age / 29.530588853;
  const face = Math.min(widget.w, widget.h) - (st.pad ?? 18) * 2 - 10;
  const shift = (phase < 0.5 ? (0.5 - phase) * 2 : (phase - 0.5) * 2) * face;
  const waxing = phase < 0.5;
  const lit = phase > 0.02 && phase < 0.98;
  const ink = st.color || '#888888';
  return (
    <TSCard widget={widget} st={{ alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <View style={{ width: face, height: face, borderRadius: face / 2, backgroundColor: lit ? (st.accent || ink) : withAlpha(ink, 0.25), overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: waxing ? -shift : shift, top: 0, width: face, height: face, borderRadius: face / 2, backgroundColor: withAlpha(ink, 0.85) }} />
      </View>
      <Text style={dim(st, { size: Math.max(10, Math.round((st.size || 12) * 0.9)) })}>{moonName(age)}</Text>
    </TSCard>
  );
}

function CountdownW({ widget, st }) {
  useProviderDeps(widget.kind);
  const target = Date.parse((widget.cfg || {}).target || '');
  if (!Number.isFinite(target)) {
    return (
      <TSCard widget={widget} st={{ justifyContent: 'center', gap: 4 }}>
        <Eyebrow st={st} text={kindLabel(widget.kind)} />
        <Text style={dim(st, { size: 11 })}>Set a date in the customize panel.</Text>
      </TSCard>
    );
  }
  const left = Math.max(0, target - Date.now());
  const days = Math.floor(left / 86400000);
  const hours = Math.floor((left % 86400000) / 3600000);
  const mins = Math.floor((left % 3600000) / 60000);
  return (
    <TSCard widget={widget} st={{ justifyContent: 'center', gap: 4 }}>
      <Eyebrow st={st} text={kindLabel(widget.kind)} />
      <Text style={tx(st, { size: st.size || 30, lineHeight: 1.05 })}>{days > 0 ? `${days}d ${hours}h` : `${hours}h ${mins}m`}</Text>
      <Text style={dim(st, { size: 10 })}>{new Date(target).toLocaleDateString()}</Text>
    </TSCard>
  );
}

function ForecastW({ widget, st }) {
  useProviderDeps(widget.kind);
  const d = PROV[specOf(widget.kind)?.src]?.(widget);
  if (!d?.forecast?.length) return quiet(widget, st, tOptional('shell.widgets.noData') || 'No data');
  return (
    <TSCard widget={widget} st={{ gap: 8 }}>
      <Eyebrow st={st} text={kindLabel(widget.kind)} />
      <View style={{ flexDirection: 'row', flex: 1 }}>
        {d.forecast.slice(0, 7).map((f, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
            <Text style={dim(st, { size: 10 })}>{i === 0 ? 'Today' : weekdayName(new Date(f.day).getDay(), true).slice(0, 3)}</Text>
            <Text style={tx(st, { size: Math.max(12, st.size || 12) })}>{Number.isFinite(f.hi) ? `${Math.round(f.hi)}°` : '—'}</Text>
            <Text style={dim(st, { size: 10 })}>{Number.isFinite(f.lo) ? `${Math.round(f.lo)}°` : '—'}</Text>
          </View>
        ))}
      </View>
    </TSCard>
  );
}

function ImageW({ widget, st }) {
  useProviderDeps(widget.kind);
  const d = PROV[specOf(widget.kind)?.src]?.(widget);
  if (!d?.src) return quiet(widget, st);
  return (
    <TSCard widget={widget} st={{ padding: 8 }}>
      <Image src={d.src} style={{ width: '100%', height: '100%', borderRadius: Math.max(2, (st.radius ?? 12) - 6), objectFit: 'cover' }} />
    </TSCard>
  );
}

function ToggleW({ widget, st }) {
  useProviderDeps(widget.kind);
  const d = PROV[specOf(widget.kind)?.src]?.(widget);
  const label = kindLabel(widget.kind);
  const flip = () => {
    const src = specOf(widget.kind)?.src;
    if (src === 'nightLight') setNightManual(!nightActive());
    else if (src === 'bluetooth') setBluetoothPower(!(btStore.get()?.adapter?.powered));
    else if (src === 'mute') {
      const out = defaultSink(soundState.get());
      if (out) sound.setMute('sink', out.index ?? out.id ?? 0, !out.mute);
    }
  };
  if (!d) return quiet(widget, st);
  return (
    <TSCard widget={widget} st={{ justifyContent: 'center', gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={tx(st, { size: st.size || 12 })}>{label}</Text>
        <View onClick={flip} style={{ width: 38, height: 22, borderRadius: 11, padding: 2,
          backgroundColor: d.on ? (st.accent || st.color) : withAlpha(st.color || '#888888', 0.25), flexDirection: 'row' }}>
          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: st.paper || '#ffffff',
            transform: `translateX(${d.on ? 16 : 0}px)` }} />
        </View>
      </View>
      {d.sub ? <Text style={dim(st, { size: 10 })}>{d.sub}</Text> : null}
    </TSCard>
  );
}

function TimerW({ widget, st }) {
  const t = useStore(clockTimer);
  useStore(tsClock);
  const st0 = eff(widget);
  const left = timerLeft(t);                    // ms
  const mm = String(Math.floor(left / 60000)).padStart(2, '0');
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
  const running = t.state === 'running';
  const Btn = ({ label, onClick }) => (
    <Text onClick={onClick} style={{ ...tx(st, { size: 12, weight: 700 }), color: st0.accent || st0.color, padding: 4 }}>{label}</Text>
  );
  return (
    <TSCard widget={widget} st={{ justifyContent: 'center', gap: 8, alignItems: 'center' }}>
      <Eyebrow st={st0} text={kindLabel(widget.kind)} />
      <Text style={tx(st, { size: st.size || 30, lineHeight: 1.1 })}>{left > 0 ? `${mm}:${ss}` : '05:00'}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {!running ? <Btn label={t.state === 'paused' ? '▶' : '5:00'} onClick={() => (t.state === 'paused' ? timerResume() : timerStart(300))} /> : null}
        {running ? <Btn label="⏸" onClick={() => timerPause()} /> : null}
        {t.state !== 'idle' ? <Btn label="Reset" onClick={() => timerReset()} /> : null}
      </View>
    </TSCard>
  );
}

function StopwatchW({ widget, st }) {
  const sw = useStore(swStore);
  useStore(tsClock);
  const st0 = eff(widget);
  const ms = swElapsed(sw);
  const mm = String(Math.floor(ms / 60000)).padStart(2, '0');
  const ss = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  const ds = Math.floor((ms % 1000) / 100);
  return (
    <TSCard widget={widget} st={{ justifyContent: 'center', gap: 6, alignItems: 'center' }}>
      <Eyebrow st={st0} text={kindLabel(widget.kind)} />
      <Text style={tx(st, { size: st.size || 26, lineHeight: 1.1 })}>{`${mm}:${ss}.${ds}`}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Text onClick={() => (sw.running ? swStop() : swStart())}
          style={{ ...tx(st, { size: 12, weight: 700 }), color: st0.accent || st0.color, padding: 4 }}>
          {sw.running ? 'Stop' : 'Start'}</Text>
        {ms > 0 ? <Text onClick={() => swReset()} style={{ ...dim(st, { size: 12, weight: 700 }), padding: 4 }}>Reset</Text> : null}
      </View>
    </TSCard>
  );
}

// ---------------------------------------------------------------- registration + the bridge

// ---- rich text: a styled run drawn as word tokens in a wrapping row (the engine has no inline
// layout; word-splitting a segment keeps its style and reflows like a paragraph)
function RichFlow({ widget, st, cfg }) {
  const segs = tsRichSegments(cfg, (cfg || {}).text);
  if (!segs.length) return null;
  const tokens = tsRichTokens(segs);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline',
      justifyContent: st.align === 'center' ? 'center' : st.align === 'right' ? 'flex-end' : 'flex-start' }}>
      {tokens.map((tk, i) => {
        const seg = resolveStyle(st, tk.g || {});
        return <Text key={i} style={tx(seg, { size: seg.size ?? st.size })}>{tk.t}</Text>;
      })}
    </View>
  );
}

// Every renderer variant the spec table names, implemented once (sdk/ts-widget-specs.js).
const VARIANTS = {
  clock: ClockDigital, 'clock-analog': ClockAnalog, world: ClockWorld, binary: BinaryW,
  week: WeekW, calendar: CalendarW, agenda: AgendaW, countdown: CountdownW,
  value: ValueW, ring: RingW, chart: ChartW, spark: SparkW, rows: RowsW, text: TextW,
  bar: BarW, image: ImageW, progress: ProgressW, stats: StatsW, battery: BatteryW,
  storage: StorageW, network: NetworkW, gauge: GaugeW, weather: WeatherW, forecast: ForecastW,
  moon: MoonW, media: MediaW, todo: TodoW, notes: NotesW, quote: QuoteW, label: LabelW,
  headline: HeadlineW, pomodoro: PomodoroW, timer: TimerW, stopwatch: StopwatchW, toggle: ToggleW,
};

// Coverage at load: a variant or provider the specs name but this file does not implement is a
// loud console error (the lab's session log catches it), never a silent blank card.
for (const v of TS_VARIANTS) if (!VARIANTS[v]) console.error(`themestudio: variant '${v}' has no renderer`);
for (const p of TS_PROVIDERS) if (!PROV[p]) console.error(`themestudio: provider '${p}' has no data source`);

function TsWidget({ widget }) {
  const v = specOf(widget.kind)?.v;
  const C = (v && VARIANTS[v]) || null;
  if (!C) return null;
  // one broken card shows its own quiet notice; the other cards and the layer stay alive
  return h(ShellBoundary, { name: `widget ${widget.kind}`, key: widget.id }, h(C, { widget, st: eff(widget) }));
}

registerWidgetType('ts-widget', TsWidget);

// The store → layer bridge: the live list ordered by z, each instance carrying the theme's style
// baseline pre-merged (the Settings previews compute the same merge for their own theme).
let bridgeInstalled = false;
export function installThemeWidgetBridge() {
  if (bridgeInstalled) return;
  bridgeInstalled = true;
  let lastCount = -1;
  const bridge = () => {
    const st = tsLive.get();
    if (!st.active || !st.def) { setWidgets('ts-widget', []); return; }
    const list = tsByZ(st.widgets).map((w) => ({ ...w, style: resolveStyle(st.def.style || {}, w.style || {}) }));
    setWidgets('ts-widget', list);
    if (list.length !== lastCount) {
      lastCount = list.length;
      console.log(`themestudio: ${st.def.name} — ${list.length} widgets on the desktop`);
    }
  };
  tsLive.subscribe(bridge);
  bridge();
}

// Boot: resolve the active theme's composition for this work area (the island bar above, the
// Dock strip below — the same area the Widgets page clamps into). A theme that no longer
// resolves degrades to no theme inside tsInit; the desktop keeps exactly what it shows.
try {
  installThemeWidgetBridge();                 // first: every later apply reaches the desktop
} catch (e) { console.error('themestudio: bridge install failed:', e && e.message || e); }

// Esc leaves the desktop-arrange mode; a completed drag hands its pre-drag snapshot to the page
// (tsDesktopUndo) so the Themes page records ONE undo step per drag.
try {
  addListener('keydown', (e) => {
    if (e.key === 'Escape' && tsArranging.get()) tsArranging.set(false);
  });
} catch (e) { /* never block the shell */ }
try {
  tsInit({ x: 0, y: 28, w: insane.screen.width, h: Math.max(200, insane.screen.height - 28 - 80) });
  console.log(`themestudio: boot — ${tsLive.get().active || 'no theme'}, ${tsLive.get().widgets.length} widgets`);
} catch (e) { console.error('themestudio: boot init failed:', e && e.message || e); }

export { TsWidget, eff as tsEffStyle, KIND_STYLE as TS_KIND_STYLE };
