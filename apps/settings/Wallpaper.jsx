// Wallpaper.jsx — Settings → Wallpaper (docs/WALLPAPERS.md). A clean gallery of online pictures —
// nature, anime and cars — where clicking a wallpaper opens a small dialog with exactly two choices:
// apply it for the login screen, or for the desktop. Each download is verified against the shipped
// catalog's hash (the closed action wallpaper-web-get), lands in the user's wallpapers folder, and
// both destinations keep the copy they can read — so every choice survives a reboot.
//
// Below the gallery, the live wallpaper: the supplied video plays as a real video preview with a
// play/pause control (hardware decoding only), and one dialog sets it for either destination. The
// still picture stays drawn underneath the live layer, so nothing can blank the desktop. The Glass
// section stays at the bottom, as it was.
import {
  View, Text, Image, MediaView, useTheme, useSettings, useLocale, tOptional, spacing, typeScale, Button, Slider, Toggle,
  media, useCodecs, errorText, fs, admin, GREETER_WALLPAPER, userWallpaperName, setLoginImage, setLoginStill, setLoginVideo,
  Layer, wm, useAppWindow,
} from '@insaneos/sdk';
import { useEffect, useRef, useState } from 'react';
import { Section, SettingRow, Note, Actions, Stack } from './ui.jsx';

const L = (k, fb) => tOptional(`settings.${k}`) || fb;
const WEB_CATALOG = '/usr/share/backgrounds/insaneos/web.json';
const YOUR_VIDEO = '/usr/share/backgrounds/insaneos/motion/galaxy.mp4';
const cap = (t) => ({ fontSize: typeScale.caption, color: t.textDim });

// The collection, from the catalog the package ships. No catalog (an old install): the page says so.
function readCatalog() {
  try { return JSON.parse(fs.read(WEB_CATALOG)).items || []; } catch (e) { return []; }
}

// ---- the apply dialog: exactly two destinations, over the Settings window ----

function ApplyDialog({ title, kind, options, onPick, onClose, note }) {
  const t = useTheme();
  const win = useAppWindow();
  const g = wm.frame(wm.get(win.id) || {});
  return (
    <Layer name="modal">
      <View style={{ position: 'absolute', left: g.x || 0, top: g.y || 0, width: g.w || 640, height: g.h || 480,
        justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}
        onClick={onClose}>
        <View onClick={(e) => e.stopPropagation?.()} style={{ width: 320, borderRadius: 12, backgroundColor: t.windowBg,
          border: `1px solid ${t.separator}`, boxShadow: '0 10px 40px rgba(0,0,0,0.4)', padding: 16, gap: 10 }}
          >
          <Text style={{ fontSize: 14, fontWeight: 600, color: t.text, textAlign: 'center' }}>{title}</Text>
          {kind === 'picture' ? (
            <Image src={`asset:wallpapers/web/${options.item.id}.thumb.jpg`}
              style={{ width: '100%', height: 120, borderRadius: 8, objectFit: 'cover' }} />
          ) : null}
          {note ? <Note tone="warn">{note}</Note> : null}
          <View onClick={options.login && !options.busy ? options.login : undefined} style={{ height: 40, borderRadius: 8,
            backgroundColor: t.control, border: `1px solid ${t.separator}`, justifyContent: 'center', alignItems: 'center',
            opacity: options.busy ? 0.5 : 1 }}>
            <Text style={{ fontSize: 13, color: t.text }}>{options.busy ? '…' : '1.  Apply for Login Screen'}</Text>
          </View>
          <View onClick={options.desktop && !options.busy ? options.desktop : undefined} style={{ height: 40, borderRadius: 8,
            backgroundColor: t.control, border: `1px solid ${t.separator}`, justifyContent: 'center', alignItems: 'center',
            opacity: options.busy ? 0.5 : 1 }}>
            <Text style={{ fontSize: 13, color: t.text }}>{options.busy ? '…' : '2.  Apply for Desktop'}</Text>
          </View>
          <Text onClick={onClose} style={{ fontSize: 12, color: t.textDim, textAlign: 'center', padding: 2 }}>Cancel</Text>
        </View>
      </View>
    </Layer>
  );
}

function PicTile({ item, onClick }) {
  const t = useTheme();
  const [hover, setHover] = useState(false);
  const name = (item.title || '').replace(/\.(jpg|jpeg|png)$/i, '');
  return (
    <View onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ alignItems: 'center', gap: 6, width: 168 }}>
      <View style={{ padding: 2, borderRadius: 10, border: `2px solid ${hover ? t.textDim : 'transparent'}`,
        transform: hover ? 'translateY(-1px)' : 'none' }}>
        <View style={{ width: 160, height: 90, borderRadius: 8, overflow: 'hidden', border: `1px solid ${t.separator}`, backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <Image src={`asset:wallpapers/web/${item.id}.thumb.jpg`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </View>
      </View>
      <Text style={{ fontSize: typeScale.caption, color: t.textDim, whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: 168, textAlign: 'center' }}>{name}</Text>
    </View>
  );
}

// The live preview: the real video, playing (hardware decoding), with a play/pause control. The
// player stays mounted while the page is open — pause and play never reload or re-decode it.
function LivePreview({ path, playing }) {
  const codecs = useCodecs();
  const [id, setId] = useState(0);
  useEffect(() => {
    if (!path || !codecs.length) return undefined;
    let pid = 0, off = null;
    try { pid = media.play('settings', path, { loop: true, audio: 0, hwOnly: 1, fpsMax: 30, appName: 'Settings' }); } catch (e) { pid = 0; }
    if (pid) {
      off = media.on(pid, (type, d) => {
        if (type === 'state' && d.state === 'playing') setId(pid);
        else if (type === 'error' || type === 'closed') setId(0);
      });
    }
    return () => { setId(0); if (off) off(); if (pid) try { media.close(pid); } catch (e) { /* already gone */ } };
  }, [path, codecs.join('|')]);
  useEffect(() => { if (id) try { media.control(id, playing ? 'play' : 'pause'); } catch (e) { /* not playing yet */ } }, [playing, id]);
  if (!id) return null;
  return <MediaView media={id} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />;
}

export function WallpaperSettings() {
  const t = useTheme();
  const { t: tr } = useLocale();
  const [s, set] = useSettings();
  const codecs = useCodecs();
  const [items, setItems] = useState(() => readCatalog());
  const [dialog, setDialog] = useState(null);             // { kind: 'picture', item } | { kind: 'live' }
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [previewPlaying, setPreviewPlaying] = useState(true);
  useEffect(() => { if (!items.length) { const iv = setInterval(() => { const it = readCatalog(); if (it.length) { setItems(it); clearInterval(iv); } }, 2000); return () => clearInterval(iv); } }, [items.length]);
  const cats = ['nature', 'anime', 'cars'];
  const catName = (c) => L(`wallpaper.cat.${c}`, c === 'nature' ? 'Nature' : c === 'anime' ? 'Anime' : 'Cars');

  const applyDesktopPicture = (name) => {
    set({ wallpaper: `image:${name}`, wallpaperBg: null, motion: {},
      wallpaperImages: [`image:${name}`, ...(s.wallpaperImages || []).filter((x) => x !== `image:${name}`)].slice(0, 12) });
    setBusy('');
    setDialog(null);
    setNote(L('wallpaper.appliedDesktop', 'Applied to the desktop.'));
  };
  const applyLoginPicture = (name) => {
    setLoginImage(name).then(() => { setBusy(''); setDialog(null); setNote(L('wallpaper.appliedLogin', 'Applied to the login screen.')); }, (e) => { setBusy(''); setNote(errorText(e)); });
  };
  const pickPicture = (item) => {
    if (busy) return;
    setBusy(item.id);
    admin.run('wallpaper-web-get', `${item.id} 1920`, null, { quiet: true }).then((name) => {
      setBusy('');
      setDialog({ kind: 'picture', item, name });
    }, (e) => { setBusy(''); setNote(errorText(e)); });
  };
  const setLiveDesktop = () => {
    const video = { id: 'user:galaxy', name: 'insane-galaxy.mp4', path: YOUR_VIDEO };
    set({ motion: { '*': video.id }, motionUser: [video, ...(s.motionUser || []).filter((x) => x.id !== video.id)], wallpaperBg: null });
    setDialog(null);
    setNote(L('wallpaper.liveDesktop', 'The live wallpaper now plays on the desktop.'));
  };
  const setLiveLogin = () => {
    setLoginVideo(YOUR_VIDEO).then(() => { setDialog(null); setNote(L('wallpaper.liveLogin', 'The live wallpaper now plays on the login screen.')); }, (e) => setNote(errorText(e)));
  };
  const stopLive = () => {
    set({ motion: {} });
    const name = userWallpaperName(s.wallpaper);
    const p = name ? setLoginImage(name) : setLoginStill(s.wallpaper || GREETER_WALLPAPER);
    p.then(() => setNote(L('wallpaper.stoppedBoth', 'Back to the still wallpaper on both.')), (e) => setNote(errorText(e)));
  };
  const liveOn = !!(s.motion && s.motion['*']);
  return (
    <Stack>
      {note ? <Note>{note}</Note> : null}
      {!items.length ? <Note>{L('wallpaper.noCatalog', 'The picture collection is not installed on this system yet.')}</Note> : null}
      {cats.map((c) => {
        const list = items.filter((it) => it.category === c);
        if (!list.length) return null;
        return (
          <Section key={c} title={catName(c)}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: spacing.m }}>
              {list.map((it) => (
                <PicTile key={it.id} item={it} onClick={() => pickPicture(it)} />
              ))}
            </View>
            {c === 'cars' ? <Text style={cap(t)}>{L('wallpaper.credit', 'Pictures from Wikimedia Commons, under their free licenses. Clicking one asks where to apply it.')}</Text> : null}
          </Section>
        );
      })}
      <Section title={L('wallpaper.live.title', 'Live wallpaper')} footer={L('wallpaper.live.hint', 'The supplied video, hardware-decoded. The still picture stays underneath it, so nothing can blank the desktop.')}>
        {s.reduceMotion ? <Note tone="warn">{L('wallpaper.live.reduceMotion', 'Reduce Motion is on (Settings → Appearance): the live wallpaper stays paused until you turn it off.')}</Note> : null}
        <View onClick={() => setPreviewPlaying((p) => !p)} style={{ width: '100%', height: 200, borderRadius: 10, overflow: 'hidden',
          border: `1px solid ${t.separator}`, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
          <LivePreview path={YOUR_VIDEO} playing={previewPlaying} />
          {!previewPlaying ? <Text style={{ fontSize: 26, color: 'rgba(255,255,255,0.9)', textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>▶</Text> : null}
        </View>
        <SettingRow label={L('wallpaper.live.preview', 'Preview')}>
          <Toggle on={previewPlaying} onChange={setPreviewPlaying} />
        </SettingRow>
        <Actions style={{ paddingVertical: spacing.s }}>
          <Button label={L('wallpaper.live.set', 'Set Live Wallpaper…')} onClick={() => setDialog({ kind: 'live' })} />
          {liveOn ? <Button small label={L('wallpaper.live.stop', 'Back to the still wallpaper on both')} onClick={stopLive} /> : null}
        </Actions>
      </Section>
      <GlassSection />
      {dialog ? (
        dialog.kind === 'picture' ? (
          <ApplyDialog title={L('wallpaper.applyTitle', 'Apply wallpaper')} kind="picture" note={busy ? L('wallpaper.downloading', 'Downloading the picture…') : ''}
            item={dialog.item}
            options={{
              busy: !!busy,
              login: () => applyLoginPicture(dialog.name),
              desktop: () => applyDesktopPicture(dialog.name),
            }}
            onClose={() => setDialog(null)} />
        ) : (
          <ApplyDialog title={L('wallpaper.liveTitle', 'Set live wallpaper')} kind="live"
            options={{
              login: () => (s.reduceMotion ? setNote(L('wallpaper.live.reduceMotion', 'Reduce Motion is on: it would stay paused.')) : setLiveLogin()),
              desktop: () => setLiveDesktop(),
            }}
            onClose={() => setDialog(null)} />
        )
      ) : null}
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
