// Control Center: mode, transparency, the volume and its output, the network, Wi-Fi and Bluetooth, accent,
// wallpaper and live CPU/RAM usage. The network, Wi-Fi, Bluetooth and CPU/RAM tiles can be turned off in Settings →
// Desktop & Dock → Control Center (issue #58, sdk/menubarmodel.js).
import {
  View, Text, Image, Button, Toggle, Slider, useSettings, useCpuUsage, useSystemInfo, formatBytes, wm, session, addListener, t as tr, tOptional,
  useSound, defaultSink, sound, NowPlayingTile, findWallpaper, wallpaperThumb, menuBarPrefs, SoundOutputList, useSoundOutputs, useBluetooth, setBluetoothPower,
  usePowerProfiles, admin, sharedTicker,
  useWeather, weatherRefresh, weatherConsent, weatherGroup, WEATHER_PLACE_DEFAULT, wallpaperAccent,
  panelLeft, inBar, useTween, useStore,
} from '@insaneos/sdk';
import { useEffect, useRef, useState } from 'react';

// Four wallpapers fit in the tile: the current one and a few from the collection (all of them are
// in Settings → Wallpaper, which «Change Wallpaper…» opens).
const QUICK = ['lumo-celestial', 'crystal-apple', 'royal-flow', 'event-horizon', 'aurora'];
function quickWallpapers(list, cur) {
  const current = findWallpaper(list, cur);
  const rest = QUICK.map((id) => list.find((w) => w.id === id)).filter((w) => w && w !== current);
  return [current, ...rest].filter(Boolean).slice(0, 4);
}

function Tile({ t, children, style }) {
  return <View style={[{ padding: 12, borderRadius: 12, backgroundColor: t.hover, border: `1px solid ${t.separator}` }, style]}>{children}</View>;
}

// "Speed up now": frees the page cache, trims the SSD and shrinks the journal (the root
// admin action optimize-now) — for the moment the desktop feels heavy.
function OptimizeTile({ t }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { await admin.run('optimize-now', '', null, { quiet: true }); } catch { /* best effort */ }
    setBusy(false);
  };
  return (
    <Tile t={t} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <Text style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{tOptional('shell.cc.optimize') || 'Speed up'}</Text>
      <Button small label={busy ? '…' : tOptional('shell.cc.optimizeNow') || 'Now'} onClick={run} disabled={busy} />
    </Tile>
  );
}

// Power mode (macOS's Low Power Mode): performance / balanced / power-saver through
// power-profiles-daemon (insane.power, sdk/hardware.jsx). Hidden when ppd isn't there.
function PowerTile({ t }) {
  const [, set] = useSettings();                         // Power Mode writes settings.renderQuality
  const profiles = usePowerProfiles();
  const list = profiles?.profiles?.length ? profiles.profiles : null;
  const active = profiles?.activeProfile || null;
  if (!list || !active) return null;
  const label = (p) => tOptional(`shell.cc.power.${p}`) || (p === 'power-saver' ? 'Low Power' : p === 'performance' ? 'Performance' : 'Balanced');
  const pick = (p) => {
    try { insane.power.setProfile(p); } catch (e) { console.log(`power: ${e.message}`); }
    // one decision, both halves of the profile: the CPU policy and what the ambient layers draw
    // (sdk/quality.js; balanced pins the normal quality, power-saver goes low)
    set({ renderQuality: p === 'performance' ? 'performance' : p === 'power-saver' ? 'low' : 'balanced' });
  };
  return (
    <Tile t={t} style={{ gap: 8 }}>
      <Text style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{tOptional('shell.cc.power.title') || 'Power Mode'}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {list.map((p) => (
          <View key={p} onClick={() => pick(p)} style={{ flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8,
            backgroundColor: active === p ? t.accent : t.control }}>
            <Text style={{ fontSize: 11, fontWeight: active === p ? 600 : 400, color: active === p ? '#fff' : t.textDim }}>{label(p)}</Text>
          </View>
        ))}
      </View>
    </Tile>
  );
}

function Meter({ t, label, value, detail }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{label}</Text>
        <Text style={{ fontSize: 12, color: t.textDim }}>{detail}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: t.control }}>
        <View style={{ width: `${Math.round(value * 100)}%`, height: 6, borderRadius: 3, backgroundColor: t.accent }} />
      </View>
    </View>
  );
}

// A small chevron drawn with two borders (it doesn't depend on a font): down when closed, up when open.
function Chevron({ color, open }) {
  return (
    <View style={{ width: 12, height: 12, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 5, height: 5, marginTop: open ? 3 : -3, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderColor: color, transform: `rotate(${open ? -135 : 45}deg)` }} />
    </View>
  );
}

// Volume of the default output (PipeWire). Click on the speaker: mute. With more than one output, the button at the
// end lists them; choosing one makes it the default, and its own volume comes back with it.
function SoundTile({ t }) {
  const st = useSound();
  const out = defaultSink(st);
  const outputs = useSoundOutputs();
  const [pick, setPick] = useState(false);
  if (!st.connected || !out) return null;
  const pct = Math.round(out.level * 100);
  const many = outputs.length > 1;
  return (
    <Tile t={t} style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{tr('shell.cc.sound')}</Text>
        <Text style={{ fontSize: 11, color: t.textDim, whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden' }}>{out.description}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, direction: 'ltr' }}>
        <View onClick={() => sound.setMute('sink', out.index, !out.mute)} style={{ width: 26, alignItems: 'center' }}>
          <Text style={{ fontSize: 15 }}>{out.mute || pct === 0 ? '🔇' : pct < 40 ? '🔈' : pct < 75 ? '🔉' : '🔊'}</Text>
        </View>
        <Slider value={Math.min(1, out.level)} width={many ? 168 : 196} onChange={(v) => sound.setVolume('sink', out.index, v)} />
        <Text style={{ fontSize: 11, color: t.textDim, width: 34, textAlign: 'end' }}>{out.mute ? '—' : `${pct} %`}</Text>
        {many ? (
          <View onClick={() => setPick((v) => !v)} title={tr('shell.cc.output')}
            style={{ width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: pick ? t.accent : t.control }}>
            <Chevron color={pick ? '#fff' : t.text} open={pick} />
          </View>
        ) : null}
      </View>
      {many && pick ? <SoundOutputList onPick={() => setPick(false)} /> : null}
    </Tile>
  );
}

// The Wi-Fi radio (only when the computer has one): connected or not; a click opens Settings → Network → Wi-Fi.
function WifiTile({ t, onClose, radios }) {
  const on = radios.find((i) => i.addresses.some((a) => a.scope === 'global' && a.family === 4));
  const ip = on?.addresses.find((a) => a.family === 4 && a.scope === 'global')?.address;
  return (
    <Tile t={t} style={{ flex: 1, gap: 3 }}>
      <View onClick={() => { onClose(); wm.open('settings', { args: { section: 'network', page: 'wifi' } }); }} style={{ gap: 3 }}>
        <Text style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{tr('shell.cc.wifi')}</Text>
        <Text style={{ fontSize: 11, color: t.textDim, whiteSpace: 'nowrap', overflow: 'hidden' }}>{on ? `${on.name} · ${ip}` : tr('shell.cc.notConnected')}</Text>
      </View>
    </Tile>
  );
}

// Bluetooth (only with an adapter): the switch turns it on or off; the name opens Settings → Bluetooth.
function BluetoothTile({ t, onClose, bt }) {
  const adapter = bt.adapter;
  const dev = (bt.devices || []).find((d) => d.connected);
  return (
    <Tile t={t} style={{ flex: 1, gap: 6 }}>
      <View onClick={() => { onClose(); wm.open('settings', { args: { section: 'bluetooth' } }); }} style={{ gap: 3 }}>
        <Text style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{tr('shell.cc.bluetooth')}</Text>
        <Text style={{ fontSize: 11, color: t.textDim, whiteSpace: 'nowrap', overflow: 'hidden' }}>
          {!adapter.powered ? tr('shell.cc.off') : dev ? dev.name : tr('shell.cc.on')}
        </Text>
      </View>
      <Toggle on={!!adapter.powered} onChange={(on) => setBluetoothPower(on)} />
    </Tile>
  );
}

// VPN interfaces (WireGuard, OpenVPN, IPsec, PPTP, OpenConnect, Fortinet).
const isVpnIf = (i) => ['wireguard', 'tun', 'xfrm', 'ppp'].includes(i.type) || /^(wg|ovpn|ips|ppp|oc|fvpn)-/.test(i.name);

// Network state (and active VPNs); a click opens Settings → Network.
function NetTile({ t, onClose, ifs }) {
  const main = ifs.find((i) => !isVpnIf(i) && i.type !== 'loopback' && i.addresses.some((a) => a.scope === 'global' && a.family === 4));
  const vpns = ifs.filter((i) => isVpnIf(i) && i.up);
  const ip = main?.addresses.find((a) => a.family === 4 && a.scope === 'global')?.address;
  return (
    <Tile t={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View onClick={() => { onClose(); wm.open('settings', { args: { section: 'network' } }); }} style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{tr('shell.cc.network')}</Text>
        <Text style={{ fontSize: 11, color: t.textDim }}>{main ? `${main.name} · ${ip}` : tr('shell.cc.offline')}</Text>
      </View>
      <View onClick={() => { onClose(); wm.open('settings', { args: { section: 'network', page: 'vpn' } }); }}
        style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: vpns.length ? t.accent : t.control }}>
        <Text style={{ fontSize: 11, fontWeight: 600, color: vpns.length ? '#fff' : t.text }}>{vpns.length ? `VPN · ${vpns.length}` : 'VPN'}</Text>
      </View>
    </Tile>
  );
}

const inside = (inst, ref) => { for (let n = inst; n; n = n.parent) if (n === ref.current) return true; return false; };

// Per-core bars under the CPU meter: the monitor thread's own reading of /proc/stat (insane.monitor,
// only while someone is querying — start() here, and the thread sleeps again 3 s after the panel closes).
const monitorTicker = sharedTicker(() => Date.now(), 1500);
function CoreBars({ t }) {
  const [, setAlive] = useState(0);
  useEffect(() => {
    try { insane.monitor?.start?.(); } catch { /* not available */ }
    setAlive(1);
    return () => { try { insane.monitor?.stop?.(); } catch { /* not available */ } };
  }, []);
  useStore(monitorTicker);
  let cores = null;
  try {
    const smp = insane.monitor?.sample?.();
    if (smp && Array.isArray(smp.cores)) cores = smp.cores;
  } catch { /* monitor asleep */ }
  if (!cores || !cores.length) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 3, alignItems: 'flex-end', height: 26 }}>
      {cores.slice(0, 16).map((v, i) => {
        const pct = Number.isFinite(v) ? Math.max(4, Math.min(100, Math.round(v * 100))) : 4;
        return <View key={i} style={{ flex: 1, height: `${pct}%`, minHeight: 3, borderRadius: 2, backgroundColor: t.accent, opacity: 0.72 }} />;
      })}
    </View>
  );
}

// The weather footer: real conditions through the consent-gated weather-get action (sdk/weather.js).
// A refresh runs once per panel open (the 30-minute cache guards it); the states are honest — the ask,
// a loading line, the cached data with a stale mark, or "unavailable". Never invented weather.
function WeatherTile({ t }) {
  const w = useWeather();
  useEffect(() => { weatherRefresh().catch(() => { }); }, []);
  const place = WEATHER_PLACE_DEFAULT;
  if (w.state === 'consent') {
    return (
      <Tile t={t} style={{ gap: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{tr('shell.weather.enable')}</Text>
        <Text style={{ fontSize: 11, color: t.textDim }}>{tr('shell.weather.enableHint')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View onClick={() => weatherConsent(true)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9, backgroundColor: t.accent }}>
            <Text style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{tr('shell.weather.allow')}</Text>
          </View>
          <View onClick={() => weatherConsent(false)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9, backgroundColor: t.hover, border: `1px solid ${t.separator}` }}>
            <Text style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{tr('shell.weather.decline')}</Text>
          </View>
        </View>
      </Tile>
    );
  }
  if (w.state === 'error' || (!w.data && w.state !== 'ok')) {
    if (w.state === 'error') {
      return (
        <Tile t={t} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{tr('shell.weather.title')}</Text>
          <Text style={{ fontSize: 11, color: t.textDim }}>{tr('shell.weather.unavailable')}</Text>
        </Tile>
      );
    }
    return (
      <Tile t={t} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{tr('shell.weather.title')}</Text>
        <Text style={{ fontSize: 11, color: t.textDim }}>…</Text>
      </Tile>
    );
  }
  const cur = w.data?.current;
  const grp = weatherGroup(cur?.weather_code);
  return (
    <Tile t={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={{ fontSize: 26, fontWeight: 700, color: t.text }}>{Math.round(cur.temperature_2m)}°</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{tr(`shell.weather.cond.${grp}`)}{w.stale ? ' ·' : ''}</Text>
        <Text style={{ fontSize: 11, color: t.textDim }}>
          {place.name} · {tr('shell.weather.humidity')}: {Math.round(cur.relative_humidity_2m)}% · {tr('shell.weather.wind')}: {Math.round(cur.wind_speed_10m)} km/h
        </Text>
      </View>
      <View onClick={() => weatherRefresh(true)} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: t.hover, border: `1px solid ${t.separator}` }}>
        <Text style={{ fontSize: 11, fontWeight: 600, color: t.textDim }}>↻</Text>
      </View>
    </Tile>
  );
}

// The accent row as labelled pill chips (the reference's theme row): "Auto" first — the accent that
// follows the wallpaper (server-side media.accent; the dot shows the sampled colour) — then the named
// presets. Hidden entirely when the running server predates media.accent, so an old binary never
// offers an accent that can't resolve.
function AccentChip({ t, label, dot, active, onPick }) {
  return (
    <View onClick={onPick} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 9, backgroundColor: active ? t.accent : t.hover, border: `1px solid ${active ? t.accent : t.separator}` }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} />
      <Text style={{ fontSize: 11, fontWeight: 600, color: active ? '#fff' : t.text }}>{label}</Text>
    </View>
  );
}

// area: the display of the menu bar it opened from (global coordinates); at: the [x, width] of the bar item that
// opened it, so it sits under that item, inside that display (sdk/menubarmodel.js panelLeft)
export function ControlCenter({ t, top, onClose, area = null, at = null }) {
  const left = panelLeft(at, 320, area), ay = area ? area.y : 0;
  const [s, set] = useSettings();
  const p = menuBarPrefs(s);
  let ifs = [];
  try { ifs = typeof insane.net !== 'undefined' ? insane.net.interfaces() : []; } catch (e) { ifs = []; }
  const radios = p.ccWifi ? ifs.filter((i) => i.type === 'wifi') : [];
  const bt = useBluetooth();
  const btShown = p.ccBluetooth && !!bt?.adapter;
  const cpu = useCpuUsage(1500);
  const info = useSystemInfo(3000);
  const ref = useRef(null);
  const used = (info.memTotalKB - info.memAvailableKB) / info.memTotalKB;
  // entrance: rises 6 px and fades in over the panel duration (useTween skips it under Reduce Motion);
  // the close stays instant — a panel that lingers after its click would feel slow
  const enter = useTween(1, { from: 0 });
  const canAuto = typeof insane !== 'undefined' && typeof insane.media?.accent === 'function';
  // a click on this display's bar is its items' own (the button toggles the panel); anywhere else closes it, another
  // display's bar too (its button then opens the panel there)
  useEffect(() => addListener('pointerdown', (e) => {
    if (!inside(e.target, ref) && !(area ? inBar(e.x, e.y, area, top) : e.y <= top)) onClose();
  }), [onClose, area, top]);

  return (
    <View ref={ref} style={{
      position: 'absolute', ...(left == null ? { right: 10 } : { left }), top: ay + top + 6, width: 320, padding: 12, gap: 10, borderRadius: 20,
      backgroundColor: t.panelBg, backdropFilter: t.glassFilter, border: `1px solid ${t.windowBorder}`,
      boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
      opacity: 0.4 + 0.6 * enter, transform: `translateY(${Math.round((1 - enter) * 6)}px)`,
    }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Tile t={t} style={{ flex: 1, gap: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{tr('shell.cc.dark')}</Text>
          <Toggle on={s.mode === 'dark'} onChange={(on) => set({ mode: on ? 'dark' : 'light' })} />
        </Tile>
        <Tile t={t} style={{ flex: 1, gap: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{tr('shell.cc.effects')}</Text>
          <Toggle on={s.effects} onChange={(effects) => set({ effects })} />
        </Tile>
      </View>
      <PowerTile t={t} />
      <OptimizeTile t={t} />
      <SoundTile t={t} />
      <NowPlayingTile />
      <WeatherTile t={t} />
      {p.ccNetwork && typeof insane.net !== 'undefined' ? <NetTile t={t} onClose={onClose} ifs={ifs} /> : null}
      {radios.length || btShown ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {radios.length ? <WifiTile t={t} onClose={onClose} radios={radios} /> : null}
          {btShown ? <BluetoothTile t={t} onClose={onClose} bt={bt} /> : null}
        </View>
      ) : null}
      <Tile t={t} style={{ gap: 10 }}>
        <Text style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{tr('shell.cc.accent')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {canAuto ? (
            <AccentChip t={t} label={tr('shell.cc.accentAuto')} value="auto" active={s.accent === 'auto'}
              dot={wallpaperAccent.get().hex || t.accents.violeta} onPick={() => set({ accent: 'auto' })} />
          ) : null}
          {Object.entries(t.accents).map(([name, c]) => (
            <AccentChip key={name} t={t} label={name[0].toUpperCase() + name.slice(1)} dot={c}
              active={s.accent === name} onPick={() => set({ accent: name })} />
          ))}
        </View>
      </Tile>
      <Tile t={t} style={{ gap: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{tr('shell.cc.wallpaper')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {quickWallpapers(t.wallpapers, s.wallpaper).map((w) => (
            <View key={w.id} onClick={() => set({ wallpaper: w.id })} style={{ width: 62, height: 40, borderRadius: 6, overflow: 'hidden',
              border: s.wallpaper === w.id ? `2px solid ${t.accent}` : `1px solid ${t.separator}` }}>
              <Image src={wallpaperThumb(w)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </View>
          ))}
        </View>
      </Tile>
      {p.ccSystem ? <Tile t={t} style={{ gap: 12 }}>
        <Meter t={t} label="CPU" value={cpu} detail={tr('shell.cc.cpuDetail', { pct: Math.round(cpu * 100), count: info.cores })} />
        <CoreBars t={t} />
        <Meter t={t} label={tr('shell.cc.memory')} value={used} detail={tr('shell.cc.memDetail', { used: formatBytes((info.memTotalKB - info.memAvailableKB) * 1024), total: formatBytes(info.memTotalKB * 1024) })} />
      </Tile> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Tile t={t} style={{ flex: 1, alignItems: 'center' }}>
          <View onClick={() => { onClose(); wm.open('settings'); }}><Text style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{tr('shell.menu.settings')}</Text></View>
        </Tile>
        <Tile t={t} style={{ flex: 1, alignItems: 'center' }}>
          <View onClick={() => session.quit()}><Text style={{ fontSize: 12, fontWeight: 600, color: '#ff5f57' }}>{tr('shell.menu.logout')}</Text></View>
        </Tile>
      </View>
    </View>
  );
}
