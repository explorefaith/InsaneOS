// Settings → Desktop & Dock: the desktops (sdk/desktops.js, docs/DESKTOPS.md), the same in every theme.
import { View, Text, Button, useSettings, Toggle, useStore, desktopList, desktopNames, renameDesktop, setDesktopCount, themes, typeScale, useTheme, trackpad, TRACKPAD_DEFAULTS, TextInput, tOptional } from '@lordos/sdk';
import { useEffect, useRef, useState } from 'react';
import { Section, SettingRow, PopUp } from './ui.jsx';

const HOT_CORNERS = [
  ['tl', 'settings.hotcorners.tl', 'Top-left'],
  ['tr', 'settings.hotcorners.tr', 'Top-right'],
  ['bl', 'settings.hotcorners.bl', 'Bottom-left'],
  ['br', 'settings.hotcorners.br', 'Bottom-right'],
];
const HOT_CORNER_ACTIONS = [
  ['none', 'settings.hotcorners.none', 'Nothing'],
  ['overview', 'settings.hotcorners.overview', 'Overview'],
  ['showDesktop', 'settings.hotcorners.showDesktop', 'Show Desktop'],
  ['dnd', 'settings.hotcorners.dnd', 'Do Not Disturb'],
];

const MAX = 9;

export function DesktopsSection({ tr }) {
  const t = useTheme();
  const [s, set] = useSettings();
  const list = useStore(desktopList);
  const n = list.length;
  const pad = { ...TRACKPAD_DEFAULTS, ...(s.trackpad || {}) };   // swipe4 is off by default
  const hc = { on: true, tl: 'overview', tr: 'dnd', bl: 'showDesktop', br: 'none', ...(s.hotCorners || {}) };
  return (
    <>
      <Section title={tr('settings.dock.desktops.title')} footer={tr('settings.dock.desktops.hint')}>
        <SettingRow label={tr('settings.dock.desktops.count')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Button small label="−" onClick={() => setDesktopCount(n - 1)} disabled={n <= 1} />
            <Text style={{ minWidth: 20, textAlign: 'center', fontSize: typeScale.body, color: t.text }}>{String(n)}</Text>
            <Button small label="+" onClick={() => setDesktopCount(n + 1)} disabled={n >= MAX} />
          </View>
        </SettingRow>
        {themes.current() === 'default' && (
          <SettingRow label={tr('settings.dock.desktops.arrows')} hint={tr('settings.dock.desktops.arrowsHint')}>
            <Toggle small on={s.desktopArrows !== false} onChange={(v) => set({ desktopArrows: v })} />
          </SettingRow>
        )}
        <SettingRow label={tr('settings.dock.desktops.swipe')}>
          <Toggle small on={!!pad.swipe4} onChange={(v) => trackpad.set({ swipe4: v })} />
        </SettingRow>
      </Section>
      <Section title={tOptional('settings.hotcorners.title') || 'Hot Corners'} footer={tOptional('settings.hotcorners.hint') || 'Rest the pointer in a corner for a moment to fire its action.'}>
        <SettingRow label={tOptional('settings.hotcorners.enabled') || 'Enabled'}>
          <Toggle small on={hc.on} onChange={(v) => set({ hotCorners: { ...hc, on: v } })} />
        </SettingRow>
        {HOT_CORNERS.map(([k, key, fb]) => (
          <SettingRow key={k} label={tOptional(key) || fb}>
            <PopUp value={hc[k] || 'none'} width={170} options={HOT_CORNER_ACTIONS.map(([v, kk, f]) => [v, tOptional(kk) || f])}
              onChange={(v) => set({ hotCorners: { ...hc, [k]: v } })} />
          </SettingRow>
        ))}
      </Section>
      <Section title={tr('settings.dock.desktops.names')} footer={tr('settings.dock.desktops.namesHint')}>
        {list.map((id, i) => <NameRow key={id} id={id} label={tr('shell.desktops.name', { n: i + 1 })} />)}
      </Section>
    </>
  );
}

// A desktop's name (empty: its default, shown as the placeholder). What is typed stays as typed while the
// store keeps it clean; a rename in the Overview shows here.
function NameRow({ id, label }) {
  const stored = useStore(desktopNames, (m) => m[id] || '');
  const [value, setValue] = useState(stored);
  const sent = useRef(stored);
  useEffect(() => { if (stored !== sent.current) { sent.current = stored; setValue(stored); } }, [stored]);
  const change = (v) => { setValue(v); renameDesktop(id, v); sent.current = desktopNames.get()[id] || ''; };
  return (
    <SettingRow label={label}>
      <TextInput value={value} placeholder={label} onChange={change} style={{ width: 200 }} />
    </SettingRow>
  );
}
