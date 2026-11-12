// Wallpaper.jsx — Settings → Wallpaper, the simple flow (docs/WALLPAPERS.md): a collection of online
// pictures — nature, anime and cars — where one click sets the picture for the desktop AND the login
// screen. The picture downloads once, verified against the shipped catalog's hash like every wallpaper
// download (the closed action wallpaper-web-get), lands in the user's own wallpapers folder, and from
// there the desktop and the login screen each keep the copy they can read. Below it, your video: one
// switch makes it the live wallpaper of both (hardware decoding only; the still picture stays under it).
// The Glass section stays at the bottom, as it was.
import {
  View, Text, Image, MediaView, useTheme, useSettings, useLocale, tOptional, spacing, typeScale, Button, Slider,
  media, useCodecs, errorText, fs, admin, GREETER_WALLPAPER, userWallpaperName, setLoginImage, setLoginStill, setLoginVideo, setLoginMotion,
} from '@insaneos/sdk';
import { useEffect, useState } from 'react';
import { Section, SettingRow, Note, Actions, Stack } from './ui.jsx';

const L = (k, fb) => tOptional(`settings.${k}`) || fb;
const WEB_CATALOG = '/usr/share/backgrounds/insaneos/web.json';
const YOUR_VIDEO = '/usr/share/backgrounds/insaneos/motion/galaxy.mp4';
const cap = (t) => ({ fontSize: typeScale.caption, color: t.textDim });

// The collection, from the catalog the package ships. No catalog (an old install): the page says so.
function readCatalog() {
  try { return JSON.parse(fs.read(WEB_CATALOG)).items || []; } catch (e) { return []; }
}

// A live preview really plays the video (muted, looping, hardware only); while it starts, or without
// the hardware, nothing shows here — the section still works, the desktop just keeps the still picture.
function LivePreview({ path }) {
  const codecs = useCodecs();
  const [id, setId] = useState(0);
  useEffect(() => {
    if (!path || !codecs.length) return undefined;
    let pid = 0, off = null;
    try { pid = media.play('settings', path, { loop: true, audio: 0, hwOnly: 1, appName: 'Settings' }); } catch (e) { pid = 0; }
    if (pid) {
      off = media.on(pid, (type, d) => {
        if (type === 'state' && d.state === 'playing') setId(pid);
        else if (type === 'error' || type === 'closed') setId(0);
      });
    }
    return () => { setId(0); if (off) off(); if (pid) try { media.close(pid); } catch (e) { /* already gone */ } };
  }, [path, codecs.join('|')]);
  if (!id) return null;
  return <MediaView media={id} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />;
}

function PicTile({ item, busy, onClick, tw }) {
  const t = useTheme();
  const name = (item.title || '').replace(/\.(jpg|jpeg|png)$/i, '');
  return (
    <View onClick={busy ? undefined : onClick} style={{ alignItems: 'center', gap: 6, width: tw + 8, opacity: busy ? 0.6 : 1 }}>
      <View style={{ padding: 2, borderRadius: 10, border: `2px solid ${busy ? t.accent : 'transparent'}` }}>
        <View style={{ width: tw, height: Math.round(tw * 9 / 16), borderRadius: 7, overflow: 'hidden', border: `1px solid ${t.separator}`,
          backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' }}>
          <Image src={`asset:wallpapers/web/${item.id}.thumb.jpg`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {busy ? <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }}>
            <Text style={{ fontSize: 20, color: '#fff' }}>⟳</Text>
          </View> : null}
        </View>
      </View>
      <Text style={{ fontSize: typeScale.caption, color: t.textDim, whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: tw + 8, textAlign: 'center' }}>{name}</Text>
    </View>
  );
}

export function WallpaperSettings() {
  const t = useTheme();
  const { t: tr } = useLocale();
  const [s, set] = useSettings();
  const [items, setItems] = useState(() => readCatalog());
  const [busy, setBusy] = useState('');                   // the id downloading right now
  const [note, setNote] = useState('');
  useEffect(() => { if (!items.length) { const iv = setInterval(() => { const it = readCatalog(); if (it.length) { setItems(it); clearInterval(iv); } }, 2000); return () => clearInterval(iv); } }, [items.length]);
  const tw = 128;
  const cats = ['nature', 'anime', 'cars'];
  const catName = (c) => L(`wallpaper.cat.${c}`, c === 'nature' ? 'Nature' : c === 'anime' ? 'Anime' : 'Cars');
  const pick = (item) => {
    if (busy) return;
    setBusy(item.id);
    setNote('');
    admin.run('wallpaper-web-get', `${item.id} 1920`, null, { quiet: true }).then((name) => {
      set({ wallpaper: `image:${name}`, wallpaperBg: null, motion: {}, wallpaperImages: [`image:${name}`, ...(s.wallpaperImages || []).filter((x) => x !== `image:${name}`)].slice(0, 12) });
      return setLoginImage(name).then(() => {
        setBusy('');
        setNote(L('wallpaper.appliedBoth', 'Applied to the desktop and the login screen.'));
      }, (e) => { setBusy(''); setNote(errorText(e)); });
    }, (e) => { setBusy(''); setNote(errorText(e)); });
  };
  const setLive = () => {
    setNote('');
    const video = { id: 'user:galaxy', name: 'insane-galaxy.mp4', path: YOUR_VIDEO };
    set({ motion: { '*': video.id }, motionUser: [video, ...(s.motionUser || []).filter((x) => x.id !== video.id)], wallpaperBg: null });
    setLoginVideo(YOUR_VIDEO).then(() => setNote(L('wallpaper.liveBoth', 'The live wallpaper plays on the desktop and the login screen.')), (e) => setNote(errorText(e)));
  };
  const stopLive = () => {
    setNote('');
    set({ motion: {} });
    const name = userWallpaperName(s.wallpaper);
    const p = name ? setLoginImage(name) : setLoginStill(s.wallpaper || GREETER_WALLPAPER);
    p.then(() => setNote(L('wallpaper.stoppedBoth', 'Back to the still wallpaper on both.')), (e) => setNote(errorText(e)));
  };
  const liveOn = !!(s.motion && s.motion['*']);
  return (
    <Stack>
      {note ? <Note tone={/can|not|fail|error/i.test(note) ? 'warn' : undefined}>{note}</Note> : null}
      {!items.length ? <Note>{L('wallpaper.noCatalog', 'The picture collection is not installed on this system yet.')}</Note> : null}
      {cats.map((c) => {
        const list = items.filter((it) => it.category === c);
        if (!list.length) return null;
        return (
          <Section key={c} title={catName(c)}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: spacing.m }}>
              {list.map((it) => <PicTile key={it.id} item={it} busy={busy === it.id} onClick={() => pick(it)} tw={tw} />)}
            </View>
            <Text style={cap(t)}>{L('wallpaper.credit', 'One click downloads the picture and sets it for the desktop and the login screen. Pictures from Wikimedia Commons, under their free licenses.')}</Text>
          </Section>
        );
      })}
      <Section title={L('wallpaper.live.title', 'Live wallpaper')} footer={L('wallpaper.live.hint', 'Hardware decoding only: without a compatible GPU the still picture stays, nothing breaks.')}>
        <View style={{ width: '100%', height: 180, borderRadius: 10, overflow: 'hidden', border: `1px solid ${t.separator}`, backgroundColor: '#000' }}>
          <Image src={`asset:wallpapers/web/nature-star-trails.thumb.jpg`} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: liveOn ? 0 : 1 }} />
          <LivePreview path={liveOn ? YOUR_VIDEO : null} />
        </View>
        <Text style={cap(t)}>{L('wallpaper.live.source', 'Your video: insane-galaxy.mp4 — the desktop and the login screen pause it when nobody is watching.')}</Text>
        <Actions style={{ paddingVertical: spacing.s }}>
          <Button label={L('wallpaper.live.set', 'Set live wallpaper for 1. Login Screen 2. Desktop')} onClick={setLive} />
          {liveOn ? <Button small label={L('wallpaper.live.stop', 'Back to the still wallpaper on both')} onClick={stopLive} /> : null}
        </Actions>
      </Section>
      <GlassSection />
    </Stack>
  );
}

// ---- Glass (kept from the old page, unchanged) ----

function GlassSection() {
  const t = useTheme();
  const [s, set] = useSettings();
  const c = cap(t);
  return (
    <Section title={tOptional('settings.glass.title') || 'Glass'} footer={tOptional('settings.glass.hint') || 'How much the desktop panels and widgets blur what is behind them and show the wallpaper through.'}>
      <SettingRow label={tOptional('settings.glass.blur') || 'Blur'} stack>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
          <Text style={c}>{tOptional('settings.glass.off') || 'Off'}</Text>
          <Slider value={Number.isFinite(s.glassBlur) ? s.glassBlur : 24} min={0} max={64} width={180}
            onChange={(v) => set({ glassBlur: Math.round(v) })} />
          <Text style={c}>{`${Number.isFinite(s.glassBlur) ? Math.round(s.glassBlur) : 24} px`}</Text>
        </View>
      </SettingRow>
      <SettingRow label={tOptional('settings.glass.transparency') || 'Transparency'} stack>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
          <Text style={c}>{tOptional('settings.glass.solid') || 'Solid'}</Text>
          <Slider value={Number.isFinite(s.glassTransparency) ? s.glassTransparency : 0.3} min={0} max={1} width={180}
            onChange={(v) => set({ glassTransparency: Math.round(v * 100) / 100 })} />
          <Text style={c}>{`${Math.round((Number.isFinite(s.glassTransparency) ? s.glassTransparency : 0.3) * 100)} %`}</Text>
        </View>
      </SettingRow>
      <SettingRow label={tOptional('settings.glass.saturation') || 'Saturation'} stack>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
          <Text style={c}>{tOptional('settings.glass.neutral') || 'Neutral'}</Text>
          <Slider value={Number.isFinite(s.glassSaturate) ? s.glassSaturate : 1.2} min={1} max={2} width={180}
            onChange={(v) => set({ glassSaturate: Math.round(v * 100) / 100 })} />
          <Text style={c}>{`${Math.round((Number.isFinite(s.glassSaturate) ? s.glassSaturate : 1.2) * 100)} %`}</Text>
        </View>
      </SettingRow>
    </Section>
  );
}
