// Settings → Sound: outputs, inputs (with meter), per-app volume (PipeWire, sdk/sound.js).
import {
  View, Text, useTheme, useLocale, Slider, Toggle, Button, Segmented, useSound, useSoundPeak, sound, defaultSink,
  microphones, defaultSource, spacing, typeScale,
} from '@insaneos/sdk';
import { useEffect, useState } from 'react';
import { Stack, Section, SettingRow, Note, tint } from './ui.jsx';
import { useSettings } from '@insaneos/sdk';
import { soundFxPrefs } from '../../sdk/soundfx.js';
import { balanceOf, volumesFor, snapBalance } from './balance.js';

function Volume({ kind, item, width = 170 }) {
  const t = useTheme();
  const pct = Math.round(item.level * 100);
  // past 100 % the gain is digital: anything loud clips, whatever the card or headphones
  useEffect(() => { if (item.level > 1) sound.setVolume(kind, item.index, 1); }, [item.index, item.level > 1]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s, direction: 'ltr' }}>
      <Slider value={Math.min(1, item.level)} max={1} width={width} onChange={(v) => sound.setVolume(kind, item.index, v)} />
      <Text style={{ width: 40, fontSize: typeScale.callout, color: t.textDim, textAlign: 'end' }}>{`${pct} %`}</Text>
      <Toggle small on={!item.mute} onChange={(on) => sound.setMute(kind, item.index, !on)} />
    </View>
  );
}

// Left/right balance of a stereo output: for a weak channel or one-sided hearing.
function Balance({ item, tr, width = 170 }) {
  const t = useTheme();
  const b = balanceOf(item.volume);
  const pct = Math.round(Math.abs(b) * 100);
  const text = pct === 0 ? tr('settings.sound.balanceCenter') : tr(b < 0 ? 'settings.sound.balanceLeft' : 'settings.sound.balanceRight', { pct });
  const set = (v) => sound.setVolume('sink', item.index, volumesFor(item.level, snapBalance(v)));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s, direction: 'ltr' }}>
      <Text style={{ fontSize: typeScale.callout, color: t.textDim }}>{tr('settings.sound.left')}</Text>
      <Slider value={b} min={-1} max={1} width={width - 36} onChange={set} />
      <Text style={{ fontSize: typeScale.callout, color: t.textDim }}>{tr('settings.sound.right')}</Text>
      <Text style={{ width: 92, fontSize: typeScale.callout, color: t.textDim, textAlign: 'end' }}>{text}</Text>
      <Button small label={tr('settings.sound.balanceReset')} disabled={pct === 0} onClick={() => set(0)} />
    </View>
  );
}

// Rows of devices (an array, so the section draws hairlines between them): the default one is
// checked; a click chooses it.
function deviceRows(kind, list, t) {
  return list.map((d) => (
    <SettingRow key={d.index} label={d.description || d.name} onClick={() => !d.default && sound.setDefault(kind, d.name)}
      labelStyle={{ whiteSpace: 'nowrap', overflow: 'hidden', fontWeight: d.default ? 600 : 400 }}>
      {d.state === 'running' ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tint.ok }} /> : null}
      <Text style={{ width: 16, fontSize: 14, fontWeight: 600, color: t.accent, textAlign: 'center' }}>{d.default ? '✓' : ''}</Text>
    </SettingRow>
  ));
}

function Ports({ kind, dev }) {
  if (!dev || dev.ports.length < 2) return null;
  return (
    <Segmented small value={dev.activePort} onChange={(p) => sound.setPort(kind, dev.index, p)}
      options={dev.ports.map((p) => [p.name, p.description || p.name])} />
  );
}

function Meter({ source }) {
  const t = useTheme();
  const peak = useSoundPeak();
  useEffect(() => { if (source) sound.meter(source.index); return () => sound.meter(-1); }, [source?.index]);
  const v = peak.source === source?.index ? Math.min(1, peak.level) : 0;
  const n = 16;
  // segmented level meter
  return (
    <View style={{ flexDirection: 'row', gap: 3, direction: 'ltr' }}>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={{ width: 8, height: 8, borderRadius: 4,
          backgroundColor: i < Math.round(v * n) ? (i >= n - 3 ? tint.error : tint.ok) : t.control }} />
      ))}
    </View>
  );
}

// Sound effects (round 4): the master switch, the effects' own level, and each event. The rows
// write settings.soundFx (sdk/soundfx.js); a preview click plays the event's sample right here.
function SoundEffects() {
  const { t: tr } = useLocale();
  const [s, set] = useSettings();
  const fx = soundFxPrefs();
  const patch = (k, v) => set({ soundFx: { ...soundFxPrefs(), [k]: v } });
  const row = (key, labelKey, fb, hint) => (
    <SettingRow key={key} label={tr(labelKey) || fb} hint={hint ? tr(labelKey + 'Hint') || hint : undefined}>
      <Toggle small on={fx[key] !== false} onChange={(v) => patch(key, v)} />
    </SettingRow>
  );
  return (
    <Section title={tr('settings.sound.fx') || 'Sound Effects'} footer={tr('settings.sound.fxHint') || 'Short system sounds for desktop events. They follow the system mute and output device.'}>
      <SettingRow label={tr('settings.sound.fxOn') || 'Sound effects'}>
        <Toggle small on={fx.on !== false} onChange={(v) => patch('on', v)} />
      </SettingRow>
      <SettingRow label={tr('settings.sound.fxVolume') || 'Effects volume'}>
        <Slider value={fx.volume ?? 0.7} max={1} width={170} onChange={(v) => patch('volume', v)} />
      </SettingRow>
      {row('screenshot', 'settings.sound.fxScreenshot', 'Screenshot captured')}
      {row('trash', 'settings.sound.fxTrash', 'Trash emptied')}
      {row('power', 'settings.sound.fxPower', 'Charger connected')}
      {row('notify', 'settings.sound.fxNotify', 'Notifications')}
      {row('startup', 'settings.sound.fxStartup', 'Startup chime')}
      {row('minimize', 'settings.sound.fxMinimize', 'Window minimize and restore')}
      {row('launch', 'settings.sound.fxLaunch', 'Application launch')}
      <SettingRow label={tr('settings.sound.fxTest') || 'Preview'}>
        <Button small label={tr('settings.sound.fxShutter') || 'Shutter'} onClick={() => insane.sound.play('shutter', fx.volume ?? 0.7)} />
        <Button small label={tr('settings.sound.fxTrashP') || 'Trash'} onClick={() => insane.sound.play('trash', fx.volume ?? 0.7)} />
        <Button small label={tr('settings.sound.fxPlug') || 'Charger'} onClick={() => insane.sound.play('plug', fx.volume ?? 0.7)} />
      </SettingRow>
    </Section>
  );
}

export function SoundSettings() {
  const t = useTheme();
  const { t: tr } = useLocale();
  const st = useSound();
  if (!sound.available() || !st.connected) {
    return <Stack><Note tone="warn">{tr('settings.sound.unavailable')}</Note></Stack>;
  }
  const out = defaultSink(st);
  const mics = microphones(st);
  const mic = defaultSource(st);
  const apps = st.inputs;
  return (
    <Stack>
      <Section title={tr('settings.sound.output')}>
        {st.sinks.length === 0 ? <SettingRow label={tr('settings.sound.noOutputs')} disabled /> : deviceRows('sink', st.sinks, t)}
      </Section>
      {out && (
        <Section>
          <SettingRow label={tr('settings.sound.volume')}><Volume kind="sink" item={out} /></SettingRow>
          {out.volume && out.volume.length === 2 && <SettingRow label={tr('settings.sound.balance')}><Balance item={out} tr={tr} /></SettingRow>}
          {out.ports.length > 1 && <SettingRow label={tr('settings.sound.port')}><Ports kind="sink" dev={out} /></SettingRow>}
          <SettingRow label={tr('settings.sound.test')}><Button small label={tr('settings.sound.play')} onClick={() => sound.play('notify')} /></SettingRow>
        </Section>
      )}
      <Section title={tr('settings.sound.input')}>
        {mics.length === 0 ? <SettingRow label={tr('settings.sound.noInputs')} disabled /> : deviceRows('source', mics, t)}
      </Section>
      {mic && (
        <Section>
          <SettingRow label={tr('settings.sound.volume')}><Volume kind="source" item={mic} /></SettingRow>
          <SettingRow label={tr('settings.sound.level')}><Meter source={mic} /></SettingRow>
        </Section>
      )}
      <SoundEffects />
      <Section title={tr('settings.sound.apps')}>
        {apps.length === 0 ? <SettingRow label={tr('settings.sound.noApps')} disabled /> : apps.map((a) => (
          <SettingRow key={a.index} label={a.app || a.name}>
            {a.hasVolume ? <Volume kind="input" item={a} width={140} /> : <Toggle small on={!a.mute} onChange={(on) => sound.setMute('input', a.index, !on)} />}
          </SettingRow>
        ))}
      </Section>
    </Stack>
  );
}
