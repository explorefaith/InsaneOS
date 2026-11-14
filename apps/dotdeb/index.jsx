// DotDeb — the official Insane OS app store (apps/dotdeb). A classic store: search, categories,
// details, and one Install button per app. The catalog is the one DotDeb ships (real Debian
// packages, sizes and versions synced from packages.debian.org). Installation goes through the
// closed administration action `dotdeb-install`: the app names a catalog entry, never a command —
// the C side validates the package names and runs apt-get, streaming its real progress here.
// Debian apps land in the launcher on their own (the shell re-reads the .desktop files).
import {
  View, Text, Image, useTheme, useSettings, useLocale, tOptional, spacing, typeScale, TextInput, Button, ScrollView,
  admin, errorText, refreshApps, notify,
} from '@insaneos/sdk';
import { useEffect, useState } from 'react';
import { catalog } from './data.js';

// The app's identity: DotDeb's own mark (public/dotdeb-icon.svg, redrawn as views).
export function Icon({ size: s }) {
  return (
    <View style={{ width: s, height: s, borderRadius: s * 0.225, background: 'linear-gradient(180deg, #3d2b6b, #191033)',
      border: '1px solid rgba(255,255,255,0.14)', justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: s * 0.42, height: s * 0.42, borderRadius: s * 0.21, backgroundColor: '#c851ff',
        justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: s * 0.26, fontWeight: 700, color: '#fff' }}>D</Text>
      </View>
      <View style={{ position: 'absolute', left: s * 0.62, top: s * 0.6, width: s * 0.2, height: s * 0.2, borderRadius: s * 0.1, backgroundColor: '#5b9cff' }} />
    </View>
  );
}

// small inline note under a store entry; tone 'warn' for the not-installable notice.
// (There is no shared Note in the SDK — this one was referenced without an import and took the
// Store's details page down with it.)
function Note({ tone, children }) {
  const t = useTheme();
  return (
    <Text style={{ fontSize: 12, lineHeight: 1.4, textAlign: 'start',
      color: tone === 'warn' ? '#d29922' : t.textDim }}>{children}</Text>
  );
}

const CATS = [
  ['all', 'All'], ['internet', 'Internet'], ['multimedia', 'Multimedia'], ['graphics', 'Graphics'],
  ['productivity', 'Productivity'], ['development', 'Development'], ['system', 'System'], ['games', 'Games'],
];

export default function DotDeb() {
  const t = useTheme();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [open, setOpen] = useState(null);                 // the app whose details are showing
  const [busy, setBusy] = useState('');                   // the id being installed
  const [lines, setLines] = useState([]);                 // apt-get's real progress lines
  const [note, setNote] = useState('');
  const needle = q.trim().toLowerCase();
  const list = catalog.items.filter((a) => (!needle || `${a.name} ${a.tagline} ${a.developer}`.toLowerCase().includes(needle))
    && (cat === 'all' || a.category === cat));

  useEffect(() => { refreshApps(); }, [busy]);            // a finished install shows in the launcher at once

  const install = (app) => {
    if (busy || app.installMethod !== 'apt' || !app.packages) return;
    setBusy(app.id);
    setLines([]);
    setNote('');
    admin.run('dotdeb-install', app.id, (line) => setLines((ls) => [...ls.slice(-14), line]), { quiet: false })
      .then(() => {
        setBusy('');
        refreshApps();
        notify({ app: 'dotdeb', title: `${app.name} installed`, body: 'It is in the launcher now.' });
      }, (e) => { setBusy(''); setNote(errorText(e)); });
  };

  const installed = (app) => app.desktop && (typeof insane !== 'undefined' && insane.apps
    ? (insane.apps.linux('en') || []).some((x) => x.id === app.desktop) : false);

  if (open) {
    const a = open;
    const canInstall = a.installMethod === 'apt' && !!a.packages;
    const isIn = installed(a);
    return (
      <View style={{ flex: 1, backgroundColor: t.windowBg }}>
        <ScrollView style={{ flex: 1 }}>
          <View style={{ padding: spacing.xl, gap: 12, maxWidth: 640, alignSelf: 'center', width: '100%' }}>
            <View onClick={() => setOpen(null)} style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, border: `1px solid ${t.separator}` }}>
              <Text style={{ fontSize: 12, color: t.textDim }}>← {tOptional('dotdeb.back') || 'Back'}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <Image src={`asset:dotdeb/logos/${a.id}.png`} style={{ width: 72, height: 72, borderRadius: 14 }} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontSize: 20, fontWeight: 700, color: t.text }}>{a.name}</Text>
                <Text style={{ fontSize: 12, color: t.textDim }}>{a.tagline}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
              {[['Version', a.version], ['Size', a.sizeLabel || '—'], ['Developer', a.developer], ['License', a.license], ['Category', a.category]].map(([k, v]) => (
                <View key={k} style={{ gap: 1 }}>
                  <Text style={{ fontSize: 10, color: t.textDim }}>{k}</Text>
                  <Text style={{ fontSize: 12, color: t.text }}>{v || '—'}</Text>
                </View>
              ))}
            </View>
            {a.description.map((p, i) => <Text key={i} style={{ fontSize: 13, lineHeight: 1.5, color: t.text }}>{p}</Text>)}
            {a.installMethod === 'apt' ? (
              <View style={{ gap: 6, paddingTop: 4 }}>
                <Button primary label={busy === a.id ? (tOptional('dotdeb.installing') || 'Installing…')
                  : isIn ? (tOptional('dotdeb.reinstall') || 'Reinstall')
                  : (tOptional('dotdeb.install') || 'Install')} disabled={!!busy}
                  onClick={() => install(a)} />
                {lines.length ? (
                  <View style={{ backgroundColor: t.mode === 'dark' ? '#141418' : '#f4f4f6', borderRadius: 8, padding: 10, gap: 1, maxHeight: 140 }}>
                    {lines.map((l, i) => <Text key={i} style={{ fontSize: 10, fontFamily: 'monospace', color: t.textDim, whiteSpace: 'nowrap' }}>{l}</Text>)}
                  </View>
                ) : null}
                {note ? <Text style={{ fontSize: 11, color: t.textDim }}>{note}</Text> : null}
              </View>
            ) : (
              <Note tone="warn">{L('notInstallable', 'This one is not installable from the store yet: its method is') + ` ${a.installMethod}.`}</Note>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.windowBg }}>
      <View style={{ padding: spacing.l, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(180deg, #3d2b6b, #191033)', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: 700, color: '#c851ff' }}>D</Text>
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{tOptional('dotdeb.title') || 'DotDeb'}</Text>
            <Text style={{ fontSize: 11, color: t.textDim }}>{tOptional('dotdeb.subtitle') || 'The official Insane OS app store'}</Text>
          </View>
          <TextInput value={q} onChange={setQ} placeholder={tOptional('dotdeb.search') || 'Search apps…'} width={220} />
        </View>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {CATS.map(([id, label]) => (
            <View key={id} onClick={() => setCat(id)} style={{ paddingHorizontal: 10, height: 24, borderRadius: 12, justifyContent: 'center',
              backgroundColor: cat === id ? t.accent : t.control, border: `1px solid ${cat === id ? t.accent : t.separator}` }}>
              <Text style={{ fontSize: 11, fontWeight: cat === id ? 600 : 400, color: cat === id ? '#fff' : t.text }}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
      <ScrollView style={{ flex: 1, paddingHorizontal: spacing.l, paddingBottom: spacing.l }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {list.map((a) => (
            <View key={a.id} onClick={() => setOpen(a)} onMouseEnter={null} style={{ width: 232, borderRadius: 10,
              border: `1px solid ${t.separator}`, backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#fff',
              padding: 12, gap: 6 }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Image src={`asset:dotdeb/logos/${a.id}.png`} style={{ width: 44, height: 44, borderRadius: 9 }} />
                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: 600, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden' }}>{a.name}</Text>
                  <Text style={{ fontSize: 10, color: t.textDim }}>{a.sizeLabel || a.category}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 11, lineHeight: 1.4, color: t.textDim, height: 30, overflow: 'hidden' }}>{a.tagline}</Text>
              {busy === a.id ? <Text style={{ fontSize: 11, color: t.accent }}>{tOptional('dotdeb.installing') || 'Installing…'}</Text>
                : installed(a) ? <Text style={{ fontSize: 11, color: '#30d158' }}>{tOptional('dotdeb.installed') || 'Installed'}</Text> : null}
            </View>
          ))}
        </View>
        <Text style={{ fontSize: 10, color: t.textDim, paddingTop: 12 }}>{catalog.synced ? `Catalog synced from packages.debian.org on ${catalog.synced}.` : ''}</Text>
      </ScrollView>
    </View>
  );
}

function L(k, fb) { return tOptional(`dotdeb.${k}`) || fb; }
