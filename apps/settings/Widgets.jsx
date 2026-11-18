// Settings → Widgets: the desktop widgets' gallery and placement (phase 4, correction round M1b).
// The gallery shows the REAL widget components as previews (never text labels), each with drawn
// icon controls: a three-segment size, add, configure and remove — no raw pixel sizes anywhere.
// Previews ride the cards' own shared tickers (1 s / 3 s), exist only while this page is mounted,
// and never start network calls. No backdrop blur inside previews: the page is already glass —
// a nested blur would bring the Bug A lag back and fight the governor; the cards' flat
// translucent paper imitates the glass look instead.
import {
  View, Text, Button, useTheme, useLocale, useStore, tOptional, screen, Toggle,
  widgetLayout, widgetsEditing, WIDGET_CATALOG, catalogOf, addWidget, removeWidget, resizeWidget, setWidgetCfg, widgetComponent, Layer,
  sharedTicker, useBattery, nowPlaying, formatBytes, placement, wm, useAppWindow, admin, errorText, TextInput,
} from '@insaneos/sdk';
import { Stack, Section, SettingRow, Actions, Note, PopUp, Columns } from './ui.jsx';
import { createElement as h, useState } from 'react';

// the compact native minis: no scale transform anywhere (this engine's parent scale does not
// render child subtrees — two approaches failed), just small real data per type. One shared tick.
const miniTick = sharedTicker(() => Date.now(), 1000);
function MiniContent({ type }) {
  const t = useTheme();
  const now = new Date();
  const row = (label, value) => (
    <Text style={{ fontSize: 10, color: t.textDim, whiteSpace: 'nowrap', overflow: 'hidden' }}>{`${label}  ${value}`}</Text>
  );
  if (type === 'insane-clock') return (
    <Text style={{ fontSize: 20, fontWeight: 700, color: t.text }}>{`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`}</Text>
  );
  if (type === 'insane-date') return (
    <Text style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{`${now.getDate()} ${now.toLocaleString([], { month: 'short' })}`}</Text>
  );
  if (type === 'insane-calendar') return (
    <Text style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{now.toLocaleString([], { month: 'long' })} {now.getFullYear()}</Text>
  );
  if (type === 'insane-media') {
    const np = nowPlaying.get();
    return <Text style={{ fontSize: 11, color: t.textDim, whiteSpace: 'nowrap', overflow: 'hidden' }}>{np && np.title ? np.title : tOptional('settings.widgets.mediaIdle') || 'Nothing playing'}</Text>;
  }
  try {
    const smp = insane.monitor?.sample?.() || {};
    if (type === 'insane-stats') {
      const cpu = smp.cpu ? Math.round((Array.isArray(smp.cpu) ? smp.cpu[smp.cpu.length - 1] : smp.cpu) * 100) : null;
      const mem = smp.mem && smp.mem.total > 0 && isFinite(smp.mem.avail) ? Math.round((1 - smp.mem.avail / smp.mem.total) * 100) : null;
      const tmp = smp.temp != null && isFinite(smp.temp) ? `${Math.round(smp.temp)}°C` : null;
      return <View style={{ gap: 1 }}>{cpu != null ? row('CPU', `${cpu}%`) : null}{mem != null ? row('MEM', `${mem}%`) : null}{tmp ? row('TEMP', tmp) : null}</View>;
    }
    if (type === 'insane-net' && smp.net && isFinite(smp.net.rx)) {
      const f = (b) => (b < 1024 ? `${Math.round(b)} B/s` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB/s` : `${(b / 1048576).toFixed(1)} MB/s`);
      return <View style={{ gap: 1 }}>{row('↓', f(smp.net.rx))}{row('↑', f(smp.net.tx))}</View>;
    }
  } catch { /* monitor asleep */ }
  try {
    if (type === 'insane-storage') {
      const d = (insane.disks?.list?.() || []).find((x) => x.system && isFinite(x.fssize) && x.fssize > 0) || (insane.disks?.list?.() || []).find((x) => isFinite(x.fssize) && x.fssize > 0);
      if (d) return <Text style={{ fontSize: 10, color: t.textDim }}>{`${formatBytes(d.used)} / ${formatBytes(d.fssize)}`}</Text>;
    }
  } catch { /* no disks api */ }
  return <Text style={{ fontSize: 11, color: t.textDim }}>·</Text>;
}

// Small/Medium/Large scale the catalog card's default; the model snaps to its grid and clamps.
const SIZES = [['small', 0.7], ['medium', 1], ['large', 1.4]];
const sizeOf = (w, def) => (w.w / def.w < 0.85 ? 'small' : w.w / def.w > 1.15 ? 'large' : 'medium');
const desktopArea = () => ({ x: 0, y: 28, w: screen.width, h: screen.height - 28 - 80 });
const countOfType = (layout, type) => layout.filter((w) => w.type === type).length;

// One real preview: the registered card component at the chosen size, with a synthetic widget —
// real local data (clock, system, battery, storage, network, calendar); media draws its sample
// song when nothing plays (the gallery tags it). No network calls ever start here.
function Preview({ type, cfg, size }) {
  const t = useTheme();
  const C = widgetComponent(type);
  const c = catalogOf(type) || { w: 300, h: 120 };
  const w = Math.round((c.w * size) / 4) * 4, h = Math.round((c.h * size) / 4) * 4;
  if (!C) return <Note>{tOptional('settings.widgets.missing') || 'This widget could not be loaded.'}</Note>;
  // previews drop the seconds: a live second hand would repaint the glass page every second, and
  // over the video wallpaper that repaint costs the blur — the depth stays readable without it
  const pc = { ...(cfg || {}), seconds: false };
  return (
    <View style={{ width: w + 8, height: h + 8, padding: 4, borderRadius: 12, overflow: 'hidden',
      backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', border: `1px solid ${t.separator}` }}>
      <C widget={{ type, id: 'preview', x: 0, y: 0, w, h, cfg: pc, sample: true }} />
    </View>
  );
}

// drawn icon button: a square with the glyph, hover and pressed states, translated meaning
function IconBtn({ glyph, label, onClick, danger, small, active }) {
  const t = useTheme();
  const [hov, setHov] = useState(false);
  const lit = active || hov;
  return (
    <View onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      title={label}
      style={{ minWidth: small ? 22 : 26, height: small ? 22 : 26, paddingHorizontal: 4, borderRadius: 6,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: active ? t.accentSubtle : hov ? (danger ? 'rgba(255,69,58,0.18)' : t.hover) : 'transparent',
        border: `1px solid ${active ? t.accent : hov ? (danger ? 'rgba(255,69,58,0.5)' : t.separator) : 'transparent'}` }}>
      <Text style={{ fontSize: small ? 11 : 13, fontWeight: 700, color: danger ? '#ff453a' : t.text }}>{glyph}</Text>
    </View>
  );
}

// the size segments + the icon controls under a preview (shared by the gallery and the list)
function Controls({ placed, size, onSize, onAdd, onRemove, onConfigure, cfgOpen, children }) {
  const t = useTheme();
  const Act = ({ label, onClick, primary, disabled }) => (
    <View onClick={disabled ? undefined : onClick} style={{ flex: 1, height: 26, borderRadius: 7, justifyContent: 'center', alignItems: 'center',
      cursor: disabled ? 'default' : 'pointer', backgroundColor: primary ? t.accent : t.control, opacity: disabled ? 0.4 : 1 }}>
      <Text style={{ fontSize: 11.5, fontWeight: 600, color: primary ? '#ffffff' : t.text, whiteSpace: 'nowrap', textOverflow: 'ellipsis', numberOfLines: 1, overflow: 'hidden' }}>{label}</Text>
    </View>
  );
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {SIZES.map(([k]) => (
          <IconBtn key={k} small glyph={k === 'small' ? 'S' : k === 'medium' ? 'M' : 'L'} label={tOptional(`settings.widgets.size.${k}`)}
            onClick={() => onSize(k)} active={size === k} />
        ))}
        <View style={{ flex: 1 }} />
        {placed > 0 ? <Text style={{ fontSize: 10, color: t.textDim }}>{tOptional('settings.widgets.onDesktop') || 'On desktop'}: {placed}</Text> : null}
        {placed > 0 && onRemove ? <IconBtn glyph="✕" danger label={tOptional('settings.widgets.tipRemove') || 'Remove the newest one'} onClick={onRemove} /> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        <Act primary label={tOptional('settings.widgets.set') || 'Set'} onClick={onAdd} />
        <Act label={tOptional('settings.widgets.preview') || 'Preview'} onClick={() => setPreviewFor(type)} />
        <Act label={tOptional('settings.widgets.customize') || 'Customize'} onClick={onConfigure || onAdd} disabled={!onConfigure} />
      </View>
      {cfgOpen ? (
        <View style={{ padding: 8, gap: 2, borderRadius: 10, backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', border: `1px solid ${t.separator}` }}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

// The bigger preview: the widget's own card component at its true size, in the chosen cfg, over
// a modal layer. No scale transforms — the real size is the point.
function PreviewDialog({ type, cfg, onClose }) {
  const t = useTheme();
  const c = catalogOf(type) || { w: 300, h: 120 };
  const C = widgetComponent(type);
  return (
    <Layer name="modal">
      <View style={{ position: 'absolute', left: 0, top: 0, width: screen.width, height: screen.height,
        justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
        <View onClick={(e) => e.stopPropagation?.()} style={{ padding: 18, borderRadius: 14, gap: 12, alignItems: 'center',
          backgroundColor: t.windowBg, border: `1px solid ${t.separator}`, boxShadow: '0 18px 60px rgba(0,0,0,0.45)' }}>
          <Text style={{ fontSize: 14, fontWeight: 700, color: t.text, textAlign: 'center' }}>
            {tOptional(`settings.widgets.type.${type}`) || type}
          </Text>
          <View style={{ width: c.w, height: c.h }}>
            {C ? h(C, { widget: { type, id: 'preview', x: 0, y: 0, w: c.w, h: c.h, cfg } }) : null}
          </View>
          <Text style={{ fontSize: 10, color: t.textDim }}>
            {tOptional('settings.widgets.trueSize') || 'True size — this is exactly what the desktop draws.'}
          </Text>
          <Button label={tOptional('settings.wallpaper.cancel') || 'Cancel'} onClick={onClose} />
        </View>
      </View>
    </Layer>
  );
}

export function WidgetsSettings() {
  const t = useTheme();
  const { t: tr } = useLocale();
  const layout = useStore(widgetLayout);
  const [previewFor, setPreviewFor] = useState(null);
  useStore(miniTick);
  const editing = useStore(widgetsEditing);
  const [sz, setSz] = useState({});
  const [cfgFor, setCfgFor] = useState(null);            // the type whose gear is open
  const [pcfg, setPcfg] = useState({});                  // the preview cfg per type (the gear edits it)
  const [pairText, setPairText] = useState('');
  const [pairErr, setPairErr] = useState('');
  const tryPair = (apply) => {
    const sym = (pairText || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{2,20}$/.test(sym)) { setPairErr(tOptional('settings.widgets.pairBad') || 'Only uppercase letters and digits, 2–20 characters.'); return; }
    admin.run('crypto-ticker', sym).then((ans) => {
      try { const d = JSON.parse(ans); if (!d.symbol) throw new Error('x'); } catch (e) { setPairErr(tOptional('settings.widgets.pairUnknown') || 'That pair returned nothing — check the symbol.'); return; }
      apply('crypto', { pair: sym });
      setPairText(''); setPairErr('');
    }, (e) => setPairErr(errorText(e)));
  };
  const cap = (s) => ({ fontSize: 12, color: t.textDim, lineHeight: 1.4, textAlign: 'start' });
  const place = (type) => { try { addWidget(type, desktopArea()); } catch (e) { /* the model clamps */ } };
  const removeNewest = (type) => {
    const mine = layout.filter((w) => w.type === type);
    if (mine.length) { try { removeWidget(mine[mine.length - 1].id); } catch (e) { /* gone */ } }
  };
  const setSize = (id, scale) => {
    const w = layout.find((x) => x.id === id);
    const c = catalogOf(w.type);
    if (!w || !c) return;
    const tw = Math.round((c.w * scale) / 4) * 4, th = Math.round((c.h * scale) / 4) * 4;
    try { resizeWidget(id, tw - w.w, th - w.h, desktopArea()); } catch (e) { /* clamped */ }
  };
  const cfgOf = (type) => {
    const mine = layout.find((w) => w.type === type);
    return (mine && mine.cfg) || pcfg[type] || {};
  };
  const setCfg = (type, patch) => {
    setPcfg((s) => ({ ...s, [type]: { ...cfgOf(type), ...patch } }));
    for (const w of layout) if (w.type === type) setWidgetCfg(w.id, patch);   // never fires without a real change (compare inside)
  };
  return (
    <Stack>
      <Section title={tOptional('settings.widgets.placed') || 'Widgets on the desktop'}
        footer={tOptional('settings.widgets.placedHint') || 'Widgets live behind app windows, above the wallpaper. Arrange them right on the desktop.'}
        accessory={(
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Button small label={tOptional('settings.widgets.arrange') || 'Arrange on desktop'} onClick={() => widgetsEditing.set(true)} />
            <Button small label={tOptional('settings.widgets.reset') || 'Reset layout'} onClick={() => loadWidgets(widgetDefaults(screen.width, screen.height))} />
          </View>
        )}>
        {editing ? <Note>{tOptional('settings.widgets.editing') || 'Arrange mode is on — drag the cards on the desktop, then close it there.'}</Note> : null}
        {layout.length === 0 ? (
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 16 }}>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', border: `1px solid ${t.separator}` }} />
              ))}
            </View>
            <Text style={{ fontSize: 12, color: t.textDim }}>{tOptional('settings.widgets.pickEmpty') || 'Pick a widget below'}</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, width: '100%' }}>
            {layout.map((w) => {
              const c = catalogOf(w.type) || { w: 300, h: 120 };
              const cfg = w.cfg || {};
              const size = sizeOf(w, c);
              const k = 0.35;
              const C = widgetComponent(w.type);
              return (
                <View key={w.id} style={{ width: Math.round(c.w * k) + 8, gap: 4 }}>
                  <View style={{ width: Math.round(c.w * k), height: Math.round(c.h * k), padding: 8, borderRadius: 8, overflow: 'hidden', border: `1px solid ${t.separator}`, justifyContent: 'center' }}>
                    <MiniContent type={w.type} />
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: 600, color: t.text, textAlign: 'center' }}>{tOptional(`settings.widgets.type.${w.type}`) || w.type}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 3 }}>
                    {SIZES.map(([sk]) => (
                      <IconBtn key={sk} small glyph={sk === 'small' ? 'S' : sk === 'medium' ? 'M' : 'L'} label={tOptional(`settings.widgets.size.${sk}`)}
                        onClick={() => setSize(w.id, SIZES.find(([kk]) => kk === sk)?.[1] ?? 1)} active={size === sk} />
                    ))}
                    <IconBtn small glyph="⇲" label={tOptional('settings.widgets.tipMove') || 'Place on the desktop'}
                      onClick={() => { placement.set({ id: w.id, snapshot: { x: w.x, y: w.y, w: w.w, h: w.h } }); widgetsEditing.set(true); try { wm.minimize?.(useAppWindow().id); } catch (e) { /* wm older */ } }} />
                    <IconBtn small glyph="✕" danger label={tOptional('settings.widgets.remove') || 'Remove'}
                      onClick={() => { try { removeWidget(w.id); } catch (e) { /* already gone */ } }} />
                  </View>
                </View>
              );
            })}
          </View>
        )}
        {layout.filter((w) => w.type === 'insane-clock' || w.type === 'insane-media').map((w) => {
          const cfg = w.cfg || {};
          const rows = [];
          if (w.type === 'insane-clock') {
            rows.push(
              <SettingRow key={`${w.id}.style`} label={`${tOptional(`settings.widgets.type.${w.type}`) || 'Clock'} · ${tOptional('settings.widgets.cfgStyle') || 'Style'}`}>
                <PopUp width={150} value={cfg.style || 'digital'} onChange={(v) => setWidgetCfg(w.id, { style: v })}
                  options={[['digital', tOptional('settings.widgets.cfgDigital') || 'Digital'], ['analog', tOptional('settings.widgets.cfgAnalog') || 'Analog']]} />
              </SettingRow>,
              <SettingRow key={`${w.id}.format`} label={`${tOptional('settings.widgets.cfgFormat') || 'Hour format'} · ${tOptional(`settings.widgets.type.${w.type}`) || 'Clock'}`}>
                <PopUp width={150} value={cfg.h24 === false ? '12' : '24'} onChange={(v) => setWidgetCfg(w.id, { h24: v === '24' })}
                  options={[['24', tOptional('settings.widgets.cfg24') || '24-hour'], ['12', tOptional('settings.widgets.cfg12') || '12-hour']]} />
              </SettingRow>,
              <SettingRow key={`${w.id}.secs`} label={`${tOptional('settings.widgets.cfgSeconds') || 'Show seconds'} · ${tOptional(`settings.widgets.type.${w.type}`) || 'Clock'}`}>
                <Toggle small on={!!cfg.seconds} onChange={(v) => setWidgetCfg(w.id, { seconds: v })} />
              </SettingRow>,
            );
          }
          if (w.type === 'insane-media') {
            rows.push(
              <SettingRow key={`${w.id}.idle`} label={`${tOptional('settings.widgets.cfgIdle') || 'When nothing plays'} · ${tOptional('settings.widgets.type.insane-media') || 'Media'}`}>
                <PopUp width={150} value={cfg.idle || 'hide'} onChange={(v) => setWidgetCfg(w.id, { idle: v })}
                  options={[['hide', tOptional('settings.widgets.cfgIdleHide') || 'Hide the card'], ['idle', tOptional('settings.widgets.cfgIdleCard') || 'Show an idle card']]} />
              </SettingRow>,
            );
          }
          return rows;
        })}
      </Section>
      <Section title={tOptional('settings.widgets.gallery') || 'Add a widget'} footer={tOptional('settings.widgets.galleryHint') || 'Previews show the real widget at the chosen size. New ones land in a free spot on the desktop.'}>
        <Columns>
          {[['time', 'Time', ['insane-clock', 'insane-date', 'insane-calendar']],
            ['system', 'System', ['insane-stats', 'insane-battery', 'insane-storage', 'insane-net']],
            ['media', 'Media', ['insane-media', 'insane-visualizer']],
            ['finance', 'Finance', ['crypto']]].map(([key, label, types]) => (
            <View key={key} style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: 700, color: t.textDim, letterSpacing: 1 }}>{tOptional(`settings.widgets.cat.${key}`) || label}</Text>
              {types.map((type) => {
                const c = catalogOf(type);
                const size = SIZES[SIZES.findIndex(([k]) => k === (sz[type] || 'medium'))]?.[1] ?? 1;
                const placed = countOfType(layout, type);
                const open = cfgFor === type;
                return (
                  <View key={type} style={{ width: 330, gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{tOptional(`settings.widgets.type.${type}`) || type}</Text>
                      {placed > 0 ? <Text style={{ fontSize: 10, color: t.textDim }}>{tOptional('settings.widgets.onDesktop') || 'On desktop'}: {placed}</Text> : null}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                      <Preview type={type} cfg={cfgOf(type)} size={size} />
                      {type === 'insane-media' ? (
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: t.accentSubtle }}>
                          <Text style={{ fontSize: 9, fontWeight: 700, color: t.text }}>{tOptional('settings.widgets.sample') || 'Sample'}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Controls placed={placed} size={sz[type] || 'medium'}
                      onSize={(k) => setSz((st) => ({ ...st, [type]: k }))}
                      onAdd={() => place(type)}
                      onRemove={() => removeNewest(type)}
                      onConfigure={type === 'insane-clock' || type === 'insane-media' ? () => setCfgFor(open ? null : type) : null}
                      cfgOpen={open}>
                      {type === 'insane-clock' ? (
                        <>
                          <SettingRow label={tOptional('settings.widgets.cfgStyle') || 'Style'}>
                            <PopUp width={140} value={cfgOf(type).style || 'digital'} onChange={(v) => setCfg(type, { style: v })}
                              options={[['digital', tOptional('settings.widgets.cfgDigital') || 'Digital'], ['analog', tOptional('settings.widgets.cfgAnalog') || 'Analog']]} />
                          </SettingRow>
                          <SettingRow label={tOptional('settings.widgets.cfgFormat') || 'Hour format'}>
                            <PopUp width={140} value={cfgOf(type).h24 === false ? '12' : '24'} onChange={(v) => setCfg(type, { h24: v === '24' })}
                              options={[['24', tOptional('settings.widgets.cfg24') || '24-hour'], ['12', tOptional('settings.widgets.cfg12') || '12-hour']]} />
                          </SettingRow>
                          <SettingRow label={tOptional('settings.widgets.cfgSeconds') || 'Show seconds'}>
                            <Toggle small on={!!cfgOf(type).seconds} onChange={(v) => setCfg(type, { seconds: v })} />
                          </SettingRow>
                        </>
                      ) : null}
                      {type === 'insane-media' ? (
                        <SettingRow label={tOptional('settings.widgets.cfgIdle') || 'When nothing plays'}>
                          <PopUp width={140} value={cfgOf(type).idle || 'hide'} onChange={(v) => setCfg(type, { idle: v })}
                            options={[['hide', tOptional('settings.widgets.cfgIdleHide') || 'Hide the card'], ['idle', tOptional('settings.widgets.cfgIdleCard') || 'Show an idle card']]} />
                        </SettingRow>
                      ) : null}
                      {type === 'crypto' ? (
                        <>
                          <SettingRow label={tOptional('settings.widgets.pair') || 'Market pair'}>
                            <PopUp width={140} value={cfgOf(type).pair || 'BTCUSDT'} onChange={(v) => setCfg(type, { pair: v })}
                              options={[['BTCUSDT', 'BTC / USDT'], ['ETHUSDT', 'ETH / USDT'], ['BNBUSDT', 'BNB / USDT'], ['SOLUSDT', 'SOL / USDT'], ['XRPUSDT', 'XRP / USDT'], ['DOGEUSDT', 'DOGE / USDT']]} />
                          </SettingRow>
                          <SettingRow label={tOptional('settings.widgets.pairCustom') || 'Any pair'} hint={tOptional('settings.widgets.pairHint') || 'https://… checked against the real market when you press Check'} stack>
                            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', width: '100%' }}>
                              <TextInput value={pairText || ''} onChange={setPairText} placeholder="ADAUSDT" style={{ flex: 1, minWidth: 0 }} onSubmit={() => tryPair(setCfg, setPairErr)} />
                              <Button small label={tOptional('settings.widgets.check') || 'Check'} onClick={() => tryPair(setCfg, setPairErr)} />
                            </View>
                            {pairErr ? <Note tone="warn">{pairErr}</Note> : null}
                          </SettingRow>
                        </>
                      ) : null}
                    </Controls>
                  </View>
                );
              })}
            </View>
          ))}
        </Columns>
                <Text style={cap}>{tOptional('settings.widgets.attribution') || ''}</Text>
      </Section>
    </Stack>
  );
}
