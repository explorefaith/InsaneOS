// IslandStrip.jsx — the desktop's island: a floating glass pill at the top centre, the way the
// reference video wears it. It auto-hides when an app opens (it slides up off the screen, leaving a
// small ear at the top edge) and comes back when the pointer touches the top edge — over the window,
// the way floating panels always have. With no windows on screen it simply stays.
//
// Its content is exactly the brief: the open apps on the left, then the battery percentage, a
// one-click screenshot, the time in 24-hour format, the notifications bell and the control button —
// no logo, no OS name, no menus, no junk. Every panel opens downward from the item that called it:
// an app icon opens the golden panel with that app's windows (a row brings it forward, × closes it),
// the bell opens the notifications and the calendar, the control button opens the Android-style
// quick settings (QuickSettings.jsx).
import {
  View, Text, useStore, sharedTicker, useBattery, runShortcut, notifyHistory, wm, getApp, windowTitle,
  appName, addListener, useTween, tOptional, formatDate,
} from '@insaneos/sdk';
import { useEffect, useRef, useState } from 'react';
import { NotificationCenter } from './NotificationCenter.jsx';
import { QuickSettings } from './QuickSettings.jsx';

// the 24-hour clock: one timer shared by the strip (sdk/ticker.js stops it with the last subscriber);
// the date rides a one-minute ticker — it changes once a day but the pill shows it always
const clockTicker = sharedTicker((d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, 1000);
const dateTicker = sharedTicker((d) => formatDate(d, 'numeric'), 60000);

const inside = (inst, ref) => { for (let n = inst; n; n = n.parent) if (n === ref.current) return true; return false; };

const PILL_TOP = 6, PILL_H = 32, PANEL_TOP = PILL_TOP + PILL_H + 6;   // panels open under the pill

// the strip's glyphs, drawn with views (no font dependency, like the old bar's)
function NetGlyph({ color }) {
  return (
    <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ position: 'absolute', bottom: 2 + i * 4, width: 12 - i * 4, height: 12 - i * 4,
          borderRadius: (6 - i * 2), borderWidth: 1.6, borderColor: color,
          borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: 'transparent' }} />
      ))}
      <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
    </View>
  );
}
function AudioGlyph({ color }) {
  return (
    <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 6, height: 8, borderTopWidth: 1.6, borderBottomWidth: 1.6, borderLeftWidth: 1.6, borderColor: color,
        borderTopRightRadius: 1, borderBottomRightRadius: 1, marginLeft: -5 }} />
      <View style={{ position: 'absolute', right: 3, top: 4, width: 4, height: 8, borderRadius: 2, borderWidth: 1.4, borderColor: color,
        borderLeftColor: 'transparent', borderTopColor: 'transparent', borderBottomColor: 'transparent' }} />
    </View>
  );
}
function BellGlyph({ color, dot }) {
  return (
    <View style={{ width: 16, height: 16, alignItems: 'center' }}>
      <View style={{ marginTop: 1, width: 11, height: 10, borderTopLeftRadius: 5, borderTopRightRadius: 5, border: `1.5px solid ${color}`, borderBottomWidth: 0 }} />
      <View style={{ width: 14, height: 1.5, borderRadius: 1, backgroundColor: color }} />
      <View style={{ marginTop: 1, width: 4, height: 2, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: color }} />
      {dot ? <View style={{ position: 'absolute', right: -1, top: -1, width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} /> : null}
    </View>
  );
}

function CameraGlyph({ color }) {
  const b = `1.5px solid ${color}`;
  return (
    <View style={{ width: 17, height: 13, position: 'relative' }}>
      <View style={{ position: 'absolute', left: 0, top: 2, width: 17, height: 11, borderRadius: 3, border: b }} />
      <View style={{ position: 'absolute', left: 5, top: 0, width: 7, height: 4, borderRadius: 2, border: b, borderBottomWidth: 0 }} />
      <View style={{ position: 'absolute', left: 5.5, top: 4.5, width: 6, height: 6, borderRadius: 3, border: b }} />
    </View>
  );
}

function ControlGlyph({ color }) {
  const bar = (top, knob) => (
    <View style={{ position: 'absolute', left: 0, top, width: 16, height: 6, borderRadius: 3, border: `1.5px solid ${color}` }}>
      <View style={{ position: 'absolute', left: knob, top: 0.5, width: 2, height: 2, borderRadius: 1, backgroundColor: color }} />
    </View>
  );
  return <View style={{ width: 16, height: 14 }}>{bar(0, 9)}{bar(8, 2)}</View>;
}

// The golden panel: one open app's windows, over the wallpaper in a gold-tinted glass. Click a row
// to bring that window forward, × closes it. It opens under the icon that called it (the brief's
// "নিচের দিকে"), clamped to the screen.
const GOLD_LINE = 'rgba(212,175,55,0.45)';
const GOLD_GLOW = 'rgba(212,175,55,0.14)';
function AppPanel({ t, app, wins, left, top, onClose }) {
  const ref = useRef(null);
  useEffect(() => addListener('pointerdown', (e) => { if (!inside(e.target, ref)) onClose(); }), [onClose]);
  return (
    <View ref={ref} style={{
      position: 'absolute', left, top, width: 260, padding: 10, gap: 4, borderRadius: 16,
      backgroundColor: 'rgba(34,28,12,0.88)', backdropFilter: t.glassFilter, border: `1px solid ${GOLD_LINE}`,
      boxShadow: `0 16px 40px rgba(0,0,0,0.45), 0 0 0 1px ${GOLD_GLOW}`,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 8px' }}>
        <Text style={{ fontSize: 12, fontWeight: 700, color: '#f2d488' }}>{appName(app) || (tOptional('shell.menu.window') || 'App')}</Text>
        <Text style={{ fontSize: 11, color: 'rgba(242,212,136,0.6)' }}>{wins.length}</Text>
      </View>
      {wins.map((w) => (
        <View key={w.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10 }}>
          <View onClick={() => { wm.focus(w.id); onClose(); }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 10 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: w.id === wm.focused() ? '#f2d488' : 'rgba(242,212,136,0.35)' }} />
            <Text style={{ fontSize: 12, fontWeight: 500, color: '#f5f0dd', whiteSpace: 'nowrap', overflow: 'hidden', flex: 1 }}>{windowTitle(w)}</Text>
          </View>
          <View onClick={(e) => { e.stopPropagation(); wm.close(w.id); }} style={{ width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginRight: 2 }}>
            <Text style={{ fontSize: 12, color: 'rgba(242,212,136,0.7)' }}>×</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// area: the display the island lives on; windows: the mounted windows; focused: the front window's id.
export function IslandStrip({ t, area, windows, focused }) {
  const clock = useStore(clockTicker);
  const date = useStore(dateTicker);
  const battery = useBattery();
  const [panel, setPanel] = useState(null);          // { kind, key, x, w, app?, wins? }
  const [revealed, setRevealed] = useState(false);
  const history = useStore(notifyHistory);
  const seen = useRef(0);
  const unread = history.some((n) => n.id > seen.current);

  // open apps in first-seen order, one icon per app with all its windows
  const groups = [];
  for (const w of windows) {
    const app = getApp(w.id);
    if (!app) continue;
    const g = groups.find((x) => x.app.id === app.id);
    if (g) g.wins.push(w);
    else groups.push({ app, wins: [w] });
  }

  // auto-hide: with apps on screen the island slides away; the pointer touching the top edge
  // (or an open panel) brings it back over the window. With an empty desktop it simply stays.
  const appsOpen = windows.length > 0;
  const shown = !appsOpen || revealed || !!panel;
  const lift = useTween(shown ? 1 : 0, { dur: 160 });
  useEffect(() => addListener('pointermove', (e) => {
    if (!appsOpen) return;
    if (e.y <= area.y + 4) setRevealed(true);
    else if (!panel && e.y > area.y + PANEL_TOP + PILL_H + 8) setRevealed(false);
  }), [appsOpen, panel, area.y]);

  // anchors: every item's absolute place, read the way the old bar read its items
  const refs = useRef({});
  const pillRef = useRef(null);
  const anchor = (key) => {
    const r = refs.current[key];
    if (!r?.current) return null;
    try {
      const [x, , w, h] = insane.getLayout(r.current.id);
      return { x, y: area.y + PANEL_TOP, w, h };
    } catch { return null; }
  };

  // the pill centres itself: after the first layout its width is known, so its left moves to the middle
  const [pillLeft, setPillLeft] = useState(null);
  useEffect(() => {
    try {
      const [x, , w] = insane.getLayout(pillRef.current.id);
      const want = area.x + Math.round((area.w - w) / 2);
      if (Math.abs(x - want) > 1) setPillLeft(want);
    } catch { /* not laid out yet */ }
  });

  // panels close on any click outside them and outside the pill
  useEffect(() => addListener('pointerdown', (e) => {
    if (panel && !inside(e.target, pillRef)) setPanel(null);
  }), [panel]);

  const openFor = (kind, key, estW, extra = {}) => {
    const a = anchor(key);
    if (!a) return;
    const x = Math.max(area.x + 8, Math.min(area.x + area.w - estW - 8, a.x + a.w / 2 - estW / 2));
    setPanel((p) => (p && p.kind === kind && p.key === key ? null : { kind, key, x, w: a.w, ...extra }));
  };

  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }}>
      {/* the ear: a small tab that stays at the top edge while the island is hidden */}
      {lift < 0.6 ? (
        <View style={{ position: 'absolute', left: area.x + Math.round(area.w / 2 - 22), top: 0, width: 44, height: 5,
          borderRadius: 3, backgroundColor: t.menuBg, border: `1px solid ${t.windowBorder}` }} />
      ) : null}
      <View ref={pillRef} style={{
        position: 'absolute', left: pillLeft == null ? area.x + Math.round(area.w / 2 - 170) : pillLeft,
        top: PILL_TOP, height: PILL_H, paddingHorizontal: 10, gap: 8, flexDirection: 'row', alignItems: 'center',
        borderRadius: 16, backgroundColor: t.menuBg, backdropFilter: t.glassFilter, border: `1px solid ${t.windowBorder}`,
        boxShadow: '0 10px 30px rgba(0,0,0,0.42)',
        transform: [{ translateY: Math.round(-(1 - lift) * (PILL_TOP + PILL_H + 8)) }],
      }}>
        {groups.map((g) => {
          const Icon = g.app.Icon;
          const active = g.wins.some((w) => w.id === focused);
          const isOpen = panel?.kind === 'app' && panel.key === g.app.id;
          return (
            <View key={g.app.id} ref={(inst) => { refs.current[g.app.id] = { current: inst }; }}
              onClick={() => openFor('app', g.app.id, 260, { app: g.app, wins: g.wins })}
              style={{ width: 28, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center',
                backgroundColor: isOpen ? t.menuHover : active ? t.menuHover : 'transparent' }}>
              {Icon ? <Icon size={20} color={t.menuText} /> : null}
            </View>
          );
        })}
        {groups.length ? <View style={{ width: 1, height: 16, backgroundColor: t.separator }} /> : null}

        {battery?.hasBattery ? (
          <View style={{ paddingHorizontal: 2 }}>
            <Text style={{ fontSize: 11, fontWeight: 600, color: battery.charging ? t.accent : t.menuText }}>{battery.percent >= 0 ? `${battery.percent}%` : '—'}</Text>
          </View>
        ) : null}
        <StripButton t={t} anchor={(inst) => { refs.current['shot'] = { current: inst }; }} onClick={() => runShortcut('capture.full')}>
          <CameraGlyph color={t.menuText} />
        </StripButton>
        <StripButton t={t} anchor={(inst) => { refs.current['net'] = { current: inst }; }} onClick={() => openFor('quick', 'quick', 300)}>
          <NetGlyph color={t.menuText} />
        </StripButton>
        <StripButton t={t} anchor={(inst) => { refs.current['audio'] = { current: inst }; }} onClick={() => openFor('quick', 'quick', 300)}>
          <AudioGlyph color={t.menuText} />
        </StripButton>
        <View style={{ paddingHorizontal: 2, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: t.menuText, lineHeight: 1.1 }}>{clock}</Text>
          <Text style={{ fontSize: 8, color: t.menuText, opacity: 0.6, lineHeight: 1.1 }}>{date}</Text>
        </View>
        <StripButton t={t} anchor={(inst) => { refs.current['bell'] = { current: inst }; }}
          onClick={() => {
            seen.current = history[0]?.id || 0;
            openFor('bell', 'bell', 320);
          }}>
          <BellGlyph color={t.menuText} dot={unread ? t.accent : null} />
        </StripButton>
        <StripButton t={t} anchor={(inst) => { refs.current['quick'] = { current: inst }; }} onClick={() => openFor('quick', 'quick', 300)}>
          <ControlGlyph color={t.menuText} />
        </StripButton>
      </View>

      {panel?.kind === 'app' ? (
        <AppPanel t={t} app={panel.app} wins={panel.wins} left={panel.x} top={area.y + PANEL_TOP} onClose={() => setPanel(null)} />
      ) : null}
      {panel?.kind === 'bell' ? (
        <NotificationCenter t={t} top={area.y + PANEL_TOP - 6} area={area} at={[panel.x, 320]} onClose={() => setPanel(null)} />
      ) : null}
      {panel?.kind === 'quick' ? (
        <QuickSettings t={t} top={area.y + PANEL_TOP} left={panel.x} onClose={() => setPanel(null)} />
      ) : null}
    </View>
  );
}

function StripButton({ t, onClick, anchor, children }) {
  const [hover, setHover] = useState(false);
  return (
    <View ref={anchor} onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ width: 26, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center',
        backgroundColor: hover ? t.menuHover : 'transparent' }}>
      {children}
    </View>
  );
}
