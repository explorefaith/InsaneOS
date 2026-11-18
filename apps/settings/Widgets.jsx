// Settings → Widgets: the desktop widgets' gallery and placement (phase 4, correction round M1b).
// The gallery shows the REAL widget components as previews (never text labels), each with drawn
// icon controls: a three-segment size, add, configure and remove — no raw pixel sizes anywhere.
// Previews ride the cards' own shared tickers (1 s / 3 s), exist only while this page is mounted,
// and never start network calls. No backdrop blur inside previews: the page is already glass —
// a nested blur would bring the Bug A lag back and fight the governor; the cards' flat
// translucent paper imitates the glass look instead.
import {
  View, Text, Button, useTheme, useLocale, useStore, tOptional, screen, Toggle,
  widgetLayout, widgetsEditing, WIDGET_CATALOG, catalogOf, addWidget, removeWidget, resizeWidget, setWidgetCfg, widgetComponent,
} from '@insaneos/sdk';
import { Stack, Section, SettingRow, Actions, Note, PopUp } from './ui.jsx';
import { useState } from 'react';

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
  return (
    <View style={{ width: w + 8, height: h + 8, padding: 4, borderRadius: 12, overflow: 'hidden',
      backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', border: `1px solid ${t.separator}` }}>
      <C widget={{ type, id: 'preview', x: 0, y: 0, w, h, cfg: cfg || {}, sample: true }} />
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
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {SIZES.map(([k]) => (
          <IconBtn key={k} small glyph={k === 'small' ? 'S' : k === 'medium' ? 'M' : 'L'} label={tOptional(`settings.widgets.size.${k}`)}
            onClick={() => onSize(k)} active={size === k} />
        ))}
        <View style={{ flex: 1 }} />
        {placed > 0 ? <Text style={{ fontSize: 10, color: t.textDim }}>{tOptional('settings.widgets.onDesktop') || 'On desktop'}: {placed}</Text> : null}
        <IconBtn glyph="+" label={tOptional('settings.widgets.tipAdd') || 'Add to the desktop'} onClick={onAdd} />
        {onConfigure ? <IconBtn glyph="⚙" label={tOptional('settings.widgets.tipConfigure') || 'Configure'} onClick={onConfigure} /> : null}
        {placed > 0 && onRemove ? <IconBtn glyph="✕" danger label={tOptional('settings.widgets.tipRemove') || 'Remove the newest one'} onClick={onRemove} /> : null}
      </View>
      {cfgOpen ? (
        <View style={{ padding: 8, gap: 2, borderRadius: 10, backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', border: `1px solid ${t.separator}` }}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

export function WidgetsSettings() {
  const t = useTheme();
  const { t: tr } = useLocale();
  const layout = useStore(widgetLayout);
  const editing = useStore(widgetsEditing);
  const [sz, setSz] = useState({});
  const [cfgFor, setCfgFor] = useState(null);            // the type whose gear is open
  const [pcfg, setPcfg] = useState({});                  // the preview cfg per type (the gear edits it)
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
      <Section title={tOptional('settings.widgets.placed') || 'Widgets on the desktop'} footer={tOptional('settings.widgets.placedHint') || 'Widgets live behind app windows, above the wallpaper. Arrange them right on the desktop.'}>
        <Actions start>
          <Button label={tOptional('settings.widgets.arrange') || 'Arrange on desktop'} onClick={() => widgetsEditing.set(true)} />
        </Actions>
        {editing ? <Note>{tOptional('settings.widgets.editing') || 'Arrange mode is on — drag the cards on the desktop, then close it there.'}</Note> : null}
        {!layout.length ? <Note>{tOptional('settings.widgets.none') || 'No widgets yet — add one from the gallery below.'}</Note> : null}
        {layout.map((w) => {
          const c = catalogOf(w.type) || { w: 300, h: 120 };
          const size = sizeOf(w, c);
          const cfg = w.cfg || {};
          const rows = [
            <SettingRow key={w.id} label={tOptional(`settings.widgets.type.${w.type}`) || (c.name || w.type)}>
              <PopUp width={150} value={size} onChange={(v) => setSize(w.id, SIZES.find(([k]) => k === v)?.[1] ?? 1)}
                options={SIZES.map(([k]) => [k, tOptional(`settings.widgets.size.${k}`) || (k === 'small' ? 'Small' : k === 'medium' ? 'Medium' : 'Large')])} />
              <Button small label={tOptional('settings.widgets.remove') || 'Remove'} onClick={() => { try { removeWidget(w.id); } catch (e) { /* already gone */ } }} />
            </SettingRow>,
          ];
          if (w.type === 'insane-clock') {
            rows.push(
              <SettingRow key={`${w.id}.style`} label={tOptional('settings.widgets.cfgStyle') || 'Style'}>
                <PopUp width={150} value={cfg.style || 'digital'} onChange={(v) => setWidgetCfg(w.id, { style: v })}
                  options={[['digital', tOptional('settings.widgets.cfgDigital') || 'Digital'], ['analog', tOptional('settings.widgets.cfgAnalog') || 'Analog']]} />
              </SettingRow>,
              <SettingRow key={`${w.id}.format`} label={tOptional('settings.widgets.cfgFormat') || 'Hour format'}>
                <PopUp width={150} value={cfg.h24 === false ? '12' : '24'} onChange={(v) => setWidgetCfg(w.id, { h24: v === '24' })}
                  options={[['24', tOptional('settings.widgets.cfg24') || '24-hour'], ['12', tOptional('settings.widgets.cfg12') || '12-hour']]} />
              </SettingRow>,
              <SettingRow key={`${w.id}.secs`} label={tOptional('settings.widgets.cfgSeconds') || 'Show seconds'}>
                <Toggle small on={!!cfg.seconds} onChange={(v) => setWidgetCfg(w.id, { seconds: v })} />
              </SettingRow>,
            );
          }
          if (w.type === 'insane-media') {
            rows.push(
              <SettingRow key={`${w.id}.idle`} label={tOptional('settings.widgets.cfgIdle') || 'When nothing plays'}>
                <PopUp width={150} value={cfg.idle || 'hide'} onChange={(v) => setWidgetCfg(w.id, { idle: v })}
                  options={[['hide', tOptional('settings.widgets.cfgIdleHide') || 'Hide the card'], ['idle', tOptional('settings.widgets.cfgIdleCard') || 'Show an idle card']]} />
              </SettingRow>,
            );
          }
          return rows;
        })}
      </Section>
      <Section title={tOptional('settings.widgets.gallery') || 'Add a widget'} footer={tOptional('settings.widgets.galleryHint') || 'Previews show the real widget at the chosen size. New ones land in a free spot on the desktop.'}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingVertical: 8, width: '100%' }}>
          {WIDGET_CATALOG.map((c) => {
            const size = SIZES[SIZES.findIndex(([k]) => k === (sz[c.type] || 'medium'))]?.[1] ?? 1;
            const placed = countOfType(layout, c.type);
            const open = cfgFor === c.type;
            return (
              <View key={c.type} style={{ width: 330, gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{tOptional(`settings.widgets.type.${c.type}`) || c.type}</Text>
                  {placed > 0 ? <Text style={{ fontSize: 10, color: t.textDim }}>{tOptional('settings.widgets.onDesktop') || 'On desktop'}: {placed}</Text> : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                  <Preview type={c.type} cfg={cfgOf(c.type)} size={size} />
                  {c.type === 'insane-media' ? (
                    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: t.accentSubtle }}>
                      <Text style={{ fontSize: 9, fontWeight: 700, color: t.text }}>{tOptional('settings.widgets.sample') || 'Sample'}</Text>
                    </View>
                  ) : null}
                </View>
                <Controls type={c.type} placed={placed} size={sz[c.type] || 'medium'}
                  onSize={(k) => setSz((s) => ({ ...s, [c.type]: k }))}
                  onAdd={() => place(c.type)}
                  onRemove={() => removeNewest(c.type)}
                  onConfigure={c.type === 'insane-clock' || c.type === 'insane-media' ? () => setCfgFor(open ? null : c.type) : null}
                  cfgOpen={open}>
                  {c.type === 'insane-clock' ? (
                    <>
                      <SettingRow label={tOptional('settings.widgets.cfgStyle') || 'Style'}>
                        <PopUp width={140} value={cfgOf('insane-clock').style || 'digital'} onChange={(v) => setCfg('insane-clock', { style: v })}
                          options={[['digital', tOptional('settings.widgets.cfgDigital') || 'Digital'], ['analog', tOptional('settings.widgets.cfgAnalog') || 'Analog']]} />
                      </SettingRow>
                      <SettingRow label={tOptional('settings.widgets.cfgFormat') || 'Hour format'}>
                        <PopUp width={140} value={cfgOf('insane-clock').h24 === false ? '12' : '24'} onChange={(v) => setCfg('insane-clock', { h24: v === '24' })}
                          options={[['24', tOptional('settings.widgets.cfg24') || '24-hour'], ['12', tOptional('settings.widgets.cfg12') || '12-hour']]} />
                      </SettingRow>
                      <SettingRow label={tOptional('settings.widgets.cfgSeconds') || 'Show seconds'}>
                        <Toggle small on={!!cfgOf('insane-clock').seconds} onChange={(v) => setCfg('insane-clock', { seconds: v })} />
                      </SettingRow>
                    </>
                  ) : null}
                  {c.type === 'insane-media' ? (
                    <SettingRow label={tOptional('settings.widgets.cfgIdle') || 'When nothing plays'}>
                      <PopUp width={140} value={cfgOf('insane-media').idle || 'hide'} onChange={(v) => setCfg('insane-media', { idle: v })}
                        options={[['hide', tOptional('settings.widgets.cfgIdleHide') || 'Hide the card'], ['idle', tOptional('settings.widgets.cfgIdleCard') || 'Show an idle card']]} />
                    </SettingRow>
                  ) : null}
                </Controls>
              </View>
            );
          })}
        </View>
        <Text style={cap}>{tOptional('settings.widgets.attribution') || ''}</Text>
      </Section>
    </Stack>
  );
}
