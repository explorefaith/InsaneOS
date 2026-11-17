// IslandStrip.jsx — the left-edge vertical island that replaces the top menu bar (the desktop
// transformation's second round, from the user's own brief): open apps stacked one under another,
// and under them only what was asked for — battery percentage, a one-click screenshot, the time in
// 24-hour format, the notifications bell and the control button. Nothing else lives here: no logo,
// no OS name, no menus. The top bar is gone entirely (windows use the full height now), so there is
// nothing left to auto-hide when an app opens.
//
// Clicking an open app's icon opens the golden panel below the icon: that app's windows, click to
// bring forward, × to close. The bell opens the notifications (and the calendar), the control button
// opens the Android-style quick settings (QuickSettings.jsx). Panels open to the right of the strip,
// under the item that called them, exactly like the old bar's panels did under their items.
import { View, Text, useStore, sharedTicker, useBattery, runShortcut, notifyHistory, wm, getApp, windowTitle, appName, addListener, useSettings, tOptional, screen } from '@insaneos/sdk';
import { useEffect, useRef, useState } from 'react';
import { NotificationCenter } from './NotificationCenter.jsx';
import { QuickSettings } from './QuickSettings.jsx';

// the 24-hour clock: one timer shared by the strip (sdk/ticker.js stops it with the last subscriber)
const clockTicker = sharedTicker((d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, 1000);

const inside = (inst, ref) => { for (let n = inst; n; n = n.parent) if (n === ref.current) return true; return false; };

// the strip's glyphs, drawn with views (no font dependency, like the old bar's)
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
function AppPanel({ t, app, wins, top, onClose }) {
  const ref = useRef(null);
  useEffect(() => addListener('pointerdown', (e) => { if (!inside(e.target, ref)) onClose(); }), [onClose]);
  return (
    <View ref={ref} style={{
      position: 'absolute', left: 74, top, width: 260, padding: 10, gap: 4, borderRadius: 16,
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

// area: the display the strip lives on; windows: the mounted windows; unread: a notification arrived
// since the bell was last opened. The battery, the clock and the rest read their own sources.
export function IslandStrip({ t, area, windows, focused }) {
  const clock = useStore(clockTicker);
  const battery = useBattery();
  const [panel, setPanel] = useState(null);          // { kind, y, app?, wins? }
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

  // anchors: every strip item's absolute place, read the way the old bar read its items
  const refs = useRef({});
  const stripRef = useRef(null);
  const anchor = (key) => {
    const r = refs.current[key];
    if (!r?.current) return null;
    try {
      const [, y, , h] = insane.getLayout(r.current.id);
      return { y, h };
    } catch { return null; }
  };
  const panelTop = (itemY, estH) => Math.max(8, Math.min(area.h - estH - 8, itemY - 14));

  // panels close on any click outside them and outside the strip
  useEffect(() => addListener('pointerdown', (e) => {
    if (panel && !inside(e.target, stripRef)) setPanel(null);
  }), [panel]);

  const openFor = (kind, key, extra = {}) => {
    const a = anchor(key);
    if (!a) return;
    setPanel((p) => (p && p.kind === kind && p.key === key ? null : { kind, key, y: a.y, ...extra }));
  };

  const W = 56;
  const stripTop = Math.max(8, Math.round(area.h / 2 - 190));

  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0 }}>
      <View ref={stripRef} style={{
        position: 'absolute', left: 8, top: stripTop, width: W, paddingVertical: 10, paddingHorizontal: 8, gap: 6, alignItems: 'center',
        borderRadius: 28, backgroundColor: t.menuBg, backdropFilter: t.glassFilter, border: `1px solid ${t.windowBorder}`,
        boxShadow: '0 12px 34px rgba(0,0,0,0.42)',
      }}>
        {groups.map((g) => {
          const Icon = g.app.Icon;
          const active = g.wins.some((w) => w.id === focused);
          const isOpen = panel?.kind === 'app' && panel.key === g.app.id;
          return (
            <View key={g.app.id} ref={(inst) => { refs.current[g.app.id] = { current: inst }; }}
              onClick={() => openFor('app', g.app.id, { app: g.app, wins: g.wins })}
              style={{ width: 40, alignItems: 'center', gap: 3 }}>
              <View style={{ width: 40, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
                backgroundColor: isOpen ? t.menuHover : 'transparent' }}>
                {Icon ? <Icon size={26} color={t.menuText} /> : null}
              </View>
              <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: active ? t.accent : t.separator }} />
            </View>
          );
        })}
        {groups.length ? <View style={{ width: 28, height: 1, backgroundColor: t.separator, marginVertical: 3 }} /> : null}

        {battery?.hasBattery ? (
          <View style={{ width: 40, alignItems: 'center', paddingVertical: 3 }}>
            <Text style={{ fontSize: 10, fontWeight: 600, color: battery.charging ? t.accent : t.menuText }}>{battery.percent >= 0 ? `${battery.percent}%` : '—'}</Text>
          </View>
        ) : null}
        <StripButton t={t} anchor={(inst) => { refs.current['shot'] = { current: inst }; }} onClick={() => runShortcut('capture.full')}>
          <CameraGlyph color={t.menuText} />
        </StripButton>
        <View style={{ width: 40, alignItems: 'center', paddingVertical: 3 }}>
          <Text style={{ fontSize: 11, fontWeight: 600, color: t.menuText }}>{clock}</Text>
        </View>
        <StripButton t={t} anchor={(inst) => { refs.current['bell'] = { current: inst }; }}
          onClick={() => {
            seen.current = history[0]?.id || 0;
            const a = anchor('bell');
            if (a) setPanel((p) => (p && p.kind === 'bell' ? null : { kind: 'bell', key: 'bell', y: a.y }));
          }}>
          <BellGlyph color={t.menuText} dot={unread ? t.accent : null} />
        </StripButton>
        <StripButton t={t} anchor={(inst) => { refs.current['quick'] = { current: inst }; }} onClick={() => openFor('quick', 'quick')}>
          <ControlGlyph color={t.menuText} />
        </StripButton>
      </View>

      {panel?.kind === 'app' ? (
        <AppPanel t={t} app={panel.app} wins={panel.wins} top={panelTop(panel.y, 70 + panel.wins.length * 34)} onClose={() => setPanel(null)} />
      ) : null}
      {panel?.kind === 'bell' ? (
        <NotificationCenter t={t} top={panel.y - area.y - 6} area={area} at={[70, 10]} onClose={() => setPanel(null)} />
      ) : null}
      {panel?.kind === 'quick' ? (
        <QuickSettings t={t} top={panelTop(panel.y, 400)} area={area} onClose={() => setPanel(null)} />
      ) : null}
    </View>
  );
}

function StripButton({ t, onClick, anchor, children }) {
  const [hover, setHover] = useState(false);
  return (
    <View ref={anchor} onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ width: 40, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
        backgroundColor: hover ? t.menuHover : 'transparent' }}>
      {children}
    </View>
  );
}
