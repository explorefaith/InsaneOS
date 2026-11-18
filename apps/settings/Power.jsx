// Settings → Energy (Battery on laptops): battery state and health, power mode, screen off / lock /
// sleep after N minutes, what the power button and the lid do (logind, closed admin action
// power-buttons), the low-battery notice and the percentage in the menu bar. See docs/SETTINGS.md.
import {
  View, Text, useTheme, useLocale, useSettings, Toggle, Segmented, admin, useBattery, usePowerProfiles, onPowerProfileResult, tOptional,
  BatteryGlyph, powerPrefs,
} from '@insaneos/sdk';
import { useEffect, useState } from 'react';
import { GroupBox, SettingRow, PageHeader, PopUp, Stack, Badge, PaneGlyph } from './ui.jsx';

const mins = (m) => m * 60;
const duration = (tr, m) => (m >= 60 ? tr('prefs.power.hm', { h: Math.floor(m / 60), m: m % 60 }) : tr('prefs.power.m', { m }));

// Charge limit (macOS's Optimized Battery Charging, the manual version): a root admin action
// writes charge_control_end_threshold on every battery that exposes it (ThinkPads and most
// modern laptops) and keeps the value in /etc/insaneos/battery-limit for the boot service.
function ChargeLimitRow({ tr }) {
  const [s, set] = useSettings();
  const [err, setErr] = useState('');
  const cur = s.chargeLimit ?? 80;
  const setLimit = (v) => {
    const was = cur;
    set({ chargeLimit: v });
    admin.run('battery-limit', String(v)).then(() => setErr(''), (e) => {
      set({ chargeLimit: was });          // the value never applied: the dropdown shows the truth
      setErr(e.message);
    });
  };
  return (
    <SettingRow label={tOptional('prefs.power.chargeLimit') || 'Charge limit'}
      hint={err || (tOptional('prefs.power.chargeLimitHint') || 'Stop charging at this percentage to keep the battery healthy.')}>
      <PopUp value={cur} onChange={setLimit} width={130}
        options={[[80, '80%'], [85, '85%'], [90, '90%'], [95, '95%'], [100, tOptional('prefs.power.limitOff') || 'Full']]} />
    </SettingRow>
  );
}

function BatteryCard({ b, tr }) {
  const t = useTheme();
  const main = b.supplies.find((s) => s.battery && !s.device) || {};
  const status = b.charging ? (b.minutesLeft > 0 ? tr('prefs.power.chargingLeft', { time: duration(tr, b.minutesLeft) }) : tr('prefs.power.charging'))
    : b.onAC ? tr('prefs.power.onACFull') : b.minutesLeft > 0 ? tr('prefs.power.left', { time: duration(tr, b.minutesLeft) }) : tr('prefs.power.onBattery');
  const health = main.health >= 0 ? tr(main.health >= 80 ? 'prefs.power.healthNormal' : 'prefs.power.healthService', { pct: main.health }) : tr('prefs.power.healthUnknown');
  return (
    <PageHeader icon={<View style={{ width: 60, alignItems: 'center' }}><BatteryGlyph percent={b.percent} charging={b.charging} color={t.text} width={52} /></View>}
      title={b.percent >= 0 ? `${b.percent} %` : tr('prefs.power.battery')} subtitle={`${status}\n${health}${main.cycles > 0 ? ` · ${tr('prefs.power.cycles', { n: main.cycles })}` : ''}`} />
  );
}

function ProfileRow({ tr }) {
  const p = usePowerProfiles();
  const [err, setErr] = useState('');
  const [pending, setPending] = useState(null);
  useEffect(() => onPowerProfileResult((r) => {
    if (r.ok || !pending) { setErr(''); return; }
    // the daemon refused (polkit: the session is not "active" for logind): the closed admin action
    admin.run('power-profile', pending).then(() => setErr(''), (e) => setErr(e.message));
  }), [pending]);
  const list = p?.profiles || [];
  if (!list.length) return <SettingRow label={tr('prefs.power.mode')} hint={tr('prefs.power.noProfiles')} disabled />;
  const set = (v) => {
    setPending(v);
    if (!(p.daemon && insane.power.setProfile(v))) admin.run('power-profile', v).then(() => setErr(''), (e) => setErr(e.message));
  };
  return (
    <SettingRow label={tr('prefs.power.mode')} hint={err || (p.degraded ? tr('prefs.power.degraded') : tr(p.daemon ? 'prefs.power.modeHint' : 'prefs.power.modeGovernor', { gov: p.governor }))}>
      <Segmented small value={p.active} onChange={set} options={['power-saver', 'balanced', 'performance'].filter((x) => list.includes(x)).map((x) => [x, tr(`prefs.power.profile.${x}`)])} />
    </SettingRow>
  );
}

// The rendering side of the profile (sdk/quality.js): what the ambient layers draw when the user
// pins one, or 'auto' — the default — where the desktop adapts by itself to the load.
function QualityRow({ tr }) {
  const [s, set] = useSettings();
  const opts = [['auto', tr('prefs.power.quality.auto')], ['balanced', tr('prefs.power.quality.balanced')],
    ['performance', tr('prefs.power.quality.performance')], ['low', tr('prefs.power.quality.low')]];
  return (
    <SettingRow label={tr('prefs.power.quality')} hint={tr('prefs.power.qualityHint')}>
      <Segmented small value={s.renderQuality || 'auto'} onChange={(v) => set({ renderQuality: v })} options={opts} />
    </SettingRow>
  );
}

function Buttons({ hasLid, tr }) {
  const [b, setB] = useState(() => insane.power.buttons());
  const [err, setErr] = useState('');
  const isAdmin = admin.available();
  const acts = () => ['suspend', 'hibernate', 'poweroff', 'ignore'].map((a) => [a, tr(`prefs.power.act.${a}`)]);
  const save = (x) => {
    const n = { ...b, ...x };
    admin.run('power-buttons', `${n.power} ${n.lid} ${n.lidAC}`).then(() => { setB(insane.power.buttons()); setErr(''); }, (e) => setErr(e.message));
    setB(n);
  };
  return (
    <GroupBox title={tr('prefs.power.buttons')} footer={err || (isAdmin ? tr('prefs.power.buttonsHint') : tr('prefs.power.needAdmin'))}>
      <SettingRow label={tr('prefs.power.powerKey')} disabled={!isAdmin}>
        <PopUp value={b.power} options={acts(false)} onChange={(power) => save({ power })} disabled={!isAdmin} />
      </SettingRow>
      {hasLid && (
        <SettingRow label={tr('prefs.power.lid')} disabled={!isAdmin}>
          <PopUp value={b.lid} options={acts(true)} onChange={(lid) => save({ lid })} disabled={!isAdmin} />
        </SettingRow>
      )}
      {hasLid && (
        <SettingRow label={tr('prefs.power.lidAC')} disabled={!isAdmin}>
          <PopUp value={b.lidAC} options={acts(true)} onChange={(lidAC) => save({ lidAC })} disabled={!isAdmin} />
        </SettingRow>
      )}
    </GroupBox>
  );
}

export function PowerSettings() {
  const { t: tr } = useLocale();
  const [s, set] = useSettings();
  const b = useBattery();
  const p = powerPrefs(s);
  const patch = (x) => set({ power: { ...p, ...x } });
  const hasBattery = !!b?.hasBattery;
  const offOpts = [[0, tr('prefs.power.never')], [mins(1), duration(tr, 1)], [mins(2), duration(tr, 2)], [mins(3), duration(tr, 3)], [mins(5), duration(tr, 5)],
    [mins(10), duration(tr, 10)], [mins(15), duration(tr, 15)], [mins(30), duration(tr, 30)], [mins(60), duration(tr, 60)]];
  // shorter choices for a quicker sleep: 10 and 20 min on power, 5 and 10 min on battery (#17)
  const sleepList = (list) => [[0, tr('prefs.power.never')], ...list.map((m) => [mins(m), duration(tr, m)])];
  const sleepACOpts = sleepList([10, 15, 20, 30, 60, 120, 180]);
  const sleepBatteryOpts = sleepList([5, 10, 15, 30, 60, 120, 180]);
  const lockOpts = [[0, tr('prefs.power.immediately')], [5, tr('prefs.power.secs', { s: 5 })], [60, duration(tr, 1)], [300, duration(tr, 5)], [900, duration(tr, 15)], [3600, duration(tr, 60)], [-1, tr('prefs.power.never')]];
  return (
    <Stack>
      {hasBattery ? <BatteryCard b={b} tr={tr} />
        : <PageHeader icon={<Badge color="#30d158" size={44}><PaneGlyph id="power" size={26} /></Badge>} title={tr('prefs.power.onPower')} subtitle={tr('prefs.power.noBattery')} />}
      <GroupBox>
        <ProfileRow tr={tr} />
      <QualityRow tr={tr} />
        {hasBattery ? <ChargeLimitRow tr={tr} /> : null}
        {hasBattery ? (
          <SettingRow label={tOptional('prefs.power.autoSwitch') || 'Switch power mode automatically'}
            hint={tOptional('prefs.power.autoSwitchHint') || 'Power-saver on battery, balanced on AC.'}>
            <Toggle small on={s.autoPowerProfile?.on !== false} onChange={(v) => set({ autoPowerProfile: { on: v } })} />
          </SettingRow>
        ) : null}
      </GroupBox>
      <GroupBox title={tr('prefs.power.screenSleep')} footer={tr('prefs.power.screenSleepHint')}>
        <SettingRow label={hasBattery ? tr('prefs.power.offAC') : tr('prefs.power.off')}>
          <PopUp value={p.offAC} options={offOpts} onChange={(offAC) => patch({ offAC })} />
        </SettingRow>
        {hasBattery && (
          <SettingRow label={tr('prefs.power.offBattery')}>
            <PopUp value={p.offBattery} options={offOpts} onChange={(offBattery) => patch({ offBattery })} />
          </SettingRow>
        )}
        <SettingRow label={tr('prefs.power.lock')}>
          <PopUp value={p.lockDelay} options={lockOpts} onChange={(lockDelay) => patch({ lockDelay })} />
        </SettingRow>
        <SettingRow label={hasBattery ? tr('prefs.power.sleepAC') : tr('prefs.power.sleep')}>
          <PopUp value={p.sleepAC} options={sleepACOpts} onChange={(sleepAC) => patch({ sleepAC })} />
        </SettingRow>
        {hasBattery && (
          <SettingRow label={tr('prefs.power.sleepBattery')}>
            <PopUp value={p.sleepBattery} options={sleepBatteryOpts} onChange={(sleepBattery) => patch({ sleepBattery })} />
          </SettingRow>
        )}
      </GroupBox>
      <Buttons hasLid={hasBattery} tr={tr} />
      {hasBattery && (
        <GroupBox title={tr('prefs.power.battery')}>
          <SettingRow label={tr('prefs.power.lowBattery')} hint={tr('prefs.power.lowBatteryHint')}>
            <Toggle small on={p.lowBattery} onChange={(lowBattery) => patch({ lowBattery })} />
          </SettingRow>
          <SettingRow label={tr('prefs.power.menuPercent')}>
            <Toggle small on={p.menuPercent} onChange={(menuPercent) => patch({ menuPercent })} />
          </SettingRow>
        </GroupBox>
      )}
    </Stack>
  );
}
