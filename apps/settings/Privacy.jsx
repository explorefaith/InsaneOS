// Settings → Privacy — per-app permissions («Privacy & Security»). Lists each
// permission with the apps that requested it and lets you revoke it. The Monitor adds its own section
// through registerPrivacySection (see sdk/privacy.js); this page does not know about the Monitor.
import { View, Text, useTheme, useLocale, Segmented, useStore, perms, permsRev, privacySections, useIndicators, share, shareRev, packages, appName, getApp, spacing, typeScale } from '@insaneos/sdk';
import { Stack, Section, SettingRow, Badge, Note, StatusDot, tint, PaneGlyph } from './ui.jsx';

// Permissions shown with the shared PaneGlyph pictogram (ui.jsx) and color (the order is the page
// order) — the same pictures the sidebar draws.
const SHOWN = [
  ['camera', 'camera', '#30d158'], ['microphone', 'mic', '#ff9f0a'], ['screen', 'display', '#0a84ff'],
  ['files', 'folder', '#30b0c7'], ['network', 'globe', '#0a84ff'], ['clipboard', 'clipboard', '#5e5ce6'],
  ['notifications', 'bell', '#ff375f'], ['apps', 'grid', '#8e8e93'], ['listen', 'share', '#34c759'],
  ['usb', 'usb', '#8e8e93'], ['bluetooth', 'bt', '#0a84ff'], ['status-item', 'statusitem', '#8e8e93'],
];

const PermBadge = ({ glyph, color }) => <Badge color={color} size={22}><PaneGlyph id={glyph} size={14} /></Badge>;

// Apps that declared a permission (manifest) or already have a saved decision.
function appsFor(perm, decisions) {
  const set = new Map();
  for (const p of packages.list()) if ((p.permissions || []).includes(perm)) set.set(p.id, p.name);
  for (const d of decisions) if (d.perm === perm) set.set(d.app, appName(getApp(d.app)) || d.app);
  return [...set.entries()];
}

function PermSection({ perm, glyph, color }) {
  const { t: tr } = useLocale();
  useStore(permsRev);
  const decisions = perms.list();
  const apps = appsFor(perm, decisions);
  if (!apps.length) return null;
  return (
    <Section icon={<PermBadge glyph={glyph} color={color} />} title={tr(`privacy.perm.${perm}`)} footer={tr(`privacy.permHint.${perm}`)}>
      {apps.map(([id, name]) => (
        <SettingRow key={id} label={name}>
          <Segmented small value={perms.get(id, perm)} onChange={(s) => perms.set(id, perm, s)}
            options={[['allow', tr('privacy.allowShort')], ['ask', tr('privacy.askShort')], ['deny', tr('privacy.denyShort')]]} />
        </SettingRow>
      ))}
    </Section>
  );
}

// What is using the camera or the microphone right now.
function InUse() {
  const { t: tr } = useLocale();
  const list = useIndicators();
  if (!list.length) return null;
  return (
    <Section>
      {list.map((d) => (
        <SettingRow key={d.kind} icon={<StatusDot color={d.kind === 'camera' ? tint.ok : tint.warn} />} label={`${tr(`privacy.inUse.${d.kind}`)}: ${d.apps.join(', ')}`} />
      ))}
    </Section>
  );
}

// The screen-sharing API's two permissions: decisions in a root-owned file (sdk/share.js), so they aren't in perms.
function ShareSection({ perm }) {
  const { t: tr } = useLocale();
  useStore(shareRev);
  const list = share.grants().filter((g) => g.perm === perm);
  if (!list.length) return null;
  return (
    <Section icon={<PermBadge glyph="display" color="#ff453a" />} title={tr(`privacy.perm.${perm}`)} footer={tr(`privacy.permHint.${perm}`)}>
      {list.map((g) => (
        <SettingRow key={g.id} label={g.id.replace(/^(desktop|lpk):/, '')} hint={g.exe}>
          <Segmented value={g.state} onChange={(v) => share.set(g.id, perm, v, g.exe)}
            options={[['allow', tr('privacy.allowShort')], ['ask', tr('privacy.askShort')], ['deny', tr('privacy.denyShort')]]} />
        </SettingRow>
      ))}
    </Section>
  );
}

export function PrivacySettings() {
  const { t: tr } = useLocale();
  const sections = useStore(privacySections);
  return (
    <Stack>
      <Note style={{ fontSize: typeScale.callout }}>{tr('privacy.intro')}</Note>
      <InUse />
      {/* slots registered by other parts (e.g. the Monitor: its on/off switch and the apps' network) */}
      {sections.map((s) => <s.Component key={s.id} />)}
      {SHOWN.map(([perm, glyph, color]) => <PermSection key={perm} perm={perm} glyph={glyph} color={color} />)}
      <ShareSection perm="screen-share" />
      <ShareSection perm="remote-input" />
    </Stack>
  );
}
