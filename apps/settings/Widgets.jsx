// Settings → Widgets: the desktop widgets' gallery and placement (phase 4, M1). The cards
// themselves live on the desktop (themes/default/components/DesktopWidgets.jsx) and persist in
// settings.desktopWidgets (sdk/widgetmodel.js — the only writer of the layout). This page adds
// widgets from the catalog, sizes and removes the placed ones, and enters the desktop's arrange
// mode (drag, remove, snap to the grid) — the same mode the desktop's right-click opens.
import {
  View, Text, Button, useTheme, useLocale, useStore, tOptional, screen, Toggle,
  widgetLayout, widgetsEditing, WIDGET_CATALOG, catalogOf, addWidget, removeWidget, resizeWidget, setWidgetCfg,
} from '@insaneos/sdk';
import { Stack, Section, SettingRow, Actions, Note, PopUp } from './ui.jsx';

// Small/Medium/Large scale the catalog card's default; the model snaps to its grid and clamps.
const SIZES = [['small', 0.7], ['medium', 1], ['large', 1.4]];
const sizeOf = (w, def) => (w.w / def.w < 0.85 ? 'small' : w.w / def.w > 1.15 ? 'large' : 'medium');

// The desktop area the cards place into (the model snaps and clamps; the desktop's arrange mode
// re-clamps against the theme's own work area on the next drag).
const desktopArea = () => ({ x: 0, y: 28, w: screen.width, h: screen.height - 28 - 80 });

export function WidgetsSettings() {
  const t = useTheme();
  const { t: tr } = useLocale();
  const layout = useStore(widgetLayout);
  const editing = useStore(widgetsEditing);
  const cap = (s) => ({ fontSize: 12, color: t.textDim, lineHeight: 1.4, textAlign: 'start' });
  const place = (type) => { try { addWidget(type, desktopArea()); } catch (e) { /* the model clamps; nothing to report */ } };
  const setSize = (id, scale) => {
    const w = layout.find((x) => x.id === id);
    const c = catalogOf(w.type);
    if (!w || !c) return;
    const tw = Math.round((c.w * scale) / 4) * 4, th = Math.round((c.h * scale) / 4) * 4;
    try { resizeWidget(id, tw - w.w, th - w.h, desktopArea()); } catch (e) { /* clamped */ }
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
            <SettingRow key={w.id} label={tOptional(`settings.widgets.type.${w.type}`) || (c.name || w.type)}
              hint={`${Math.round(w.w)} × ${Math.round(w.h)}`}>
              <PopUp width={150} value={size} onChange={(v) => setSize(w.id, SIZES.find(([k]) => k === v)?.[1] ?? 1)}
                options={SIZES.map(([k]) => [k, tOptional(`settings.widgets.size.${k}`) || (k === 'small' ? 'Small' : k === 'medium' ? 'Medium' : 'Large')])} />
              <Button small label={tOptional('settings.widgets.remove') || 'Remove'} onClick={() => { try { removeWidget(w.id); } catch (e) { /* already gone */ } }} />
            </SettingRow>,
          ];
          // M2: the clock's depth — the face, the hour format and the seconds, per widget
          if (w.type === 'insane-media') {
            rows.push(
              <SettingRow key={`${w.id}.idle`} label={tOptional('settings.widgets.cfgIdle') || 'When nothing plays'}>
                <PopUp width={150} value={cfg.idle || 'hide'} onChange={(v) => setWidgetCfg(w.id, { idle: v })}
                  options={[['hide', tOptional('settings.widgets.cfgIdleHide') || 'Hide the card'], ['idle', tOptional('settings.widgets.cfgIdleCard') || 'Show an idle card']]} />
              </SettingRow>,
            );
          }
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
          return rows;
        })}
      </Section>
      <Section title={tOptional('settings.widgets.gallery') || 'Add a widget'} footer={tOptional('settings.widgets.galleryHint') || 'New widgets land in a free spot on the desktop; arrange them there.'}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 8 }}>
          {WIDGET_CATALOG.map((c) => (
            <View key={c.type} onClick={() => place(c.type)} style={{ width: 150, paddingVertical: 10, paddingHorizontal: 12, gap: 4,
              borderRadius: 10, backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: `1px solid ${t.separator}` }}>
              <Text style={{ fontSize: 13, fontWeight: 600, color: t.text, textAlign: 'start' }}>{tOptional(`settings.widgets.type.${c.type}`) || (c.name || c.type)}</Text>
              <Text style={cap}>{`${c.w} × ${c.h}`}</Text>
            </View>
          ))}
        </View>
        <Text style={cap}>{tOptional('settings.widgets.attribution') || ''}</Text>
      </Section>
    </Stack>
  );
}
