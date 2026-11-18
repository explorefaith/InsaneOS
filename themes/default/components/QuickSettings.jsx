// QuickSettings.jsx — the Android-style quick settings the control button opens: the connectivity
// tiles and the two sliders, and nothing else. Every control talks to the real subsystem it names
// (the mission's rule): Bluetooth through the session's own BlueZ client, Night Light and Do Not
// Disturb through their settings, dark mode likewise, the volume through PipeWire, the brightness
// through the admin helper's display-brightness action — committed when the drag ends, so a slide
// is one round trip, not one per pixel. A click outside closes it.
import {
  View, Text, Toggle, Slider, useSettings, useSound, defaultSink, sound, useBluetooth, setBluetoothPower,
  nightPrefs, useTheme, addListener, admin, wm, tOptional, t as tr,
} from '@insaneos/sdk';
import { useEffect, useRef, useState } from 'react';

const inside = (inst, ref) => { for (let n = inst; n; n = n.parent) if (n === ref.current) return true; return false; };

function Tile({ t, label, sub, onClick, toggle, onToggle, style }) {
  return (
    <View onClick={onClick} style={[{ flex: 1, gap: 5, padding: 10, borderRadius: 14, backgroundColor: t.hover, border: `1px solid ${t.separator}` }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <Text style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{label}</Text>
        {toggle !== undefined ? <Toggle small on={toggle} onChange={onToggle} /> : null}
      </View>
      {sub ? <Text style={{ fontSize: 10, color: t.textDim, whiteSpace: 'nowrap', overflow: 'hidden' }}>{sub}</Text> : null}
    </View>
  );
}

// The brightness slider with a commit-on-release: dragging moves a local value, letting go sends one
// display-brightness action per backlight (the helper's child is not a per-pixel visitor).
function BrightnessRow({ t }) {
  const [s] = useSettings();
  const backlights = (s && typeof insane !== 'undefined' && insane.display?.list?.()?.backlight) || [];
  const [value, setValue] = useState(null);            // the drag's own value; null = show the hardware's
  const ref = useRef(null);
  const drag = useRef(false);
  const dev = backlights[0];
  if (!dev || !dev.max) return null;
  const shown = value != null ? value : dev.value;
  const at = (x) => {
    try {
      const [lx, , w] = insane.getLayout(ref.current.id);
      const f = Math.max(0, Math.min(1, (x - lx) / w));
      setValue(Math.round(dev.max * f));
    } catch { /* not laid out yet */ }
  };
  useEffect(() => {
    const move = addListener('pointermove', (e) => { if (drag.current) at(e.x); });
    const up = addListener('pointerup', () => {
      if (!drag.current) return;
      drag.current = false;
      if (value != null) admin.run('display-brightness', `${dev.name} ${value}`, undefined, { quiet: true }).catch(() => { });
    });
    return () => { move(); up(); };
  }, [value, dev?.name, dev?.max]);
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 11, fontWeight: 600, color: t.text }}>{tOptional('settings.displays.brightness') || 'Brightness'}</Text>
      <View ref={ref} onClick={(e) => { at(e.x); }}
        style={{ height: 18, borderRadius: 9, backgroundColor: t.control, justifyContent: 'center', paddingHorizontal: 3 }}>
        <View style={{ width: `${Math.max(3, Math.round((shown / dev.max) * 100))}%`, height: 12, borderRadius: 6, backgroundColor: t.accent }} />
      </View>
    </View>
  );
}

// top/left: the IslandStrip anchors this panel under the control button (Android-style, dropping down)
export function QuickSettings({ t, top, left, onClose }) {
  const ref = useRef(null);
  const [s, set] = useSettings();
  const st = useSound();
  const out = defaultSink(st);
  const bt = useBluetooth();
  const ifs = typeof insane !== 'undefined' && insane.net ? (() => { try { return insane.net.interfaces(); } catch { return []; } })() : [];
  const wifi = ifs.find((i) => i.type === 'wifi' && i.addresses.some((a) => a.scope === 'global' && a.family === 4));
  const wifiIp = wifi?.addresses.find((a) => a.family === 4 && a.scope === 'global')?.address;
  useEffect(() => addListener('pointerdown', (e) => { if (!inside(e.target, ref)) onClose(); }), [onClose]);
  const pct = out ? Math.round(out.level * 100) : 0;
  return (
    <View ref={ref} style={{
      position: 'absolute', left, top, width: 300, padding: 12, gap: 10, borderRadius: 20,
      backgroundColor: t.panelBg, backdropFilter: t.glassFilter, border: `1px solid ${t.windowBorder}`,
      boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
    }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Tile t={t} label={tr('shell.cc.wifi')} sub={wifi ? `${wifi.name} · ${wifiIp}` : tr('shell.cc.notConnected')}
          onClick={() => wm.open('settings', { args: { section: 'network', page: 'wifi' } })} style={{ flex: 1 }} />
        {bt?.adapter ? (
          <Tile t={t} label={tr('shell.cc.bluetooth')} sub={!bt.adapter.powered ? tr('shell.cc.off') : (bt.devices || []).find((d) => d.connected)?.name || tr('shell.cc.on')}
            toggle={!!bt.adapter.powered} onToggle={(on) => setBluetoothPower(on)} style={{ flex: 1 }} />
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Tile t={t} label={tOptional('settings.night.title') || 'Night Light'}
          toggle={!!nightPrefs(s).on} onToggle={(on) => set({ night: { ...nightPrefs(s), on } })} style={{ flex: 1 }} />
        <Tile t={t} label={tOptional('shell.cc.dnd') || 'Do Not Disturb'}
          toggle={!!s.notifications?.dnd} onToggle={(on) => set({ notifications: { ...(s.notifications || {}), dnd: on } })} style={{ flex: 1 }} />
      </View>
      <Tile t={t} label={tr('shell.cc.dark')} toggle={s.mode === 'dark'} onToggle={(on) => set({ mode: on ? 'dark' : 'light' })} />
      {out ? (
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 11, fontWeight: 600, color: t.text }}>{tr('shell.cc.sound')}</Text>
            <View onClick={() => sound.setMute('sink', out.index, !out.mute)} style={{ paddingHorizontal: 8, borderRadius: 7, backgroundColor: t.hover }}>
              <Text style={{ fontSize: 12, color: t.textDim }}>{out.mute || pct === 0 ? '🔇' : pct < 40 ? '🔈' : pct < 75 ? '🔉' : '🔊'}</Text>
            </View>
          </View>
          <Slider value={Math.min(1, out.level)} width={272} onChange={(v) => sound.setVolume('sink', out.index, v)} />
        </View>
      ) : null}
      <BrightnessRow t={t} />
    </View>
  );
}
