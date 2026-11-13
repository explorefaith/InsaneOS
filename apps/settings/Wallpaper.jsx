// Wallpaper.jsx — Settings → Wallpaper (docs/WALLPAPERS.md). A clean gallery of online pictures —
// nature, anime and cars — where clicking a wallpaper opens a small dialog with exactly two choices:
// apply it for the login screen, or for the desktop. Each download is verified against the shipped
// catalog's hash (the closed action wallpaper-web-get), lands in the user's wallpapers folder, and
// both destinations keep the copy they can read — so every choice survives a reboot.
//
// Below the pictures, the live wallpapers: the shipped motion catalog as its own gallery (downloaded
// the same verified way, by the closed wallpaper-get), a real play/pause preview of the supplied
// video with its playback facts, your own video (probe-checked before it is offered), and the
// "Pause when" switches. The still picture stays drawn underneath every live layer, so nothing can
// blank the desktop. The Glass section stays at the bottom, as it was.
import {
  View, Text, Image, MediaView, useTheme, useSettings, useLocale, tOptional, spacing, typeScale, Button, Slider, Toggle,
  media, useCodecs, useStore, errorText, fs, admin, GREETER_WALLPAPER, userWallpaperName, setLoginImage, setLoginStill, setLoginVideo,
  setLoginMotion, motionItems, MOTION_SECTIONS, motionThumb, motionPoster, motionDownloads, downloadMotion, removeMotion,
  variantFor, motionDisabled, retryMotion, motionBusy, userVideoProblem, heavyVideoWarning, FilePicker,
  Layer, wm, useAppWindow,
} from '@insaneos/sdk';
import { useEffect, useRef, useState } from 'react';
import { Section, SettingRow, Note, Actions, Stack } from './ui.jsx';

const L = (k, fb) => tOptional(`settings.${k}`) || fb;
const WEB_CATALOG = '/usr/share/backgrounds/insaneos/web.json';
const YOUR_VIDEO = '/usr/share/backgrounds/insaneos/motion/galaxy.mp4';
const MOV_STORE = '/var/lib/insaneos/wallpapers';        // where verified catalog videos live (docs/WALLPAPERS.md)
const cap = (t) => ({ fontSize: typeScale.caption, color: t.textDim });

// The picture collection, from the catalog the package ships. No catalog (an old install): the page says so.
function readCatalog() {
  try { return JSON.parse(fs.read(WEB_CATALOG)).items || []; } catch (e) { return []; }
}

// The catalog variant to fetch for this screen: the smallest that covers it, in a format this
// machine decodes in hardware (sdk/motionmodel.js). Null: nothing fits.
const variantOf = (it, codecs) => {
  try { return variantFor(it, codecs, { w: insane.screen.width || 1920, h: insane.screen.height || 1080 }); } catch (e) { /* older insane-server */ }
  return it.variants.find((x) => codecs.includes(x.codec)) || null;
};

// The file behind a downloaded catalog item — the same path the desktop's Layer would play, and the
// key of the "stopped" marker (settings motionDisabled, sdk/motion.jsx).
const storedPathOf = (it, s) => {
  const v = it.variants.find((x) => x.name === (s.motionFiles || {})[it.id]);
  return v ? `${MOV_STORE}/${v.sha256}.mp4` : null;
};

// ---- the apply dialog: exactly two destinations, over the Settings window ----

function ApplyDialog({ title, kind, preview, options, onClose, note, extra }) {
  const t = useTheme();
  const win = useAppWindow();
  const g = wm.frame(wm.get(win.id) || {});
  const row = (label, onClick, first) => (
    <View key={label} onClick={onClick && !options.busy ? onClick : undefined} style={{ height: 40, borderRadius: 8,
      backgroundColor: t.control, border: `1px solid ${t.separator}`, justifyContent: 'center', alignItems: 'center',
      opacity: onClick ? (options.busy ? 0.5 : 1) : 0.35 }}>
      <Text style={{ fontSize: 13, color: t.text }}>{options.busy && !first ? '…' : label}</Text>
    </View>
  );
  return (
    <Layer name="modal">
      <View style={{ position: 'absolute', left: g.x || 0, top: g.y || 0, width: g.w || 640, height: g.h || 480,
        justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}
        onClick={onClose}>
        <View onClick={(e) => e.stopPropagation?.()} style={{ width: 320, borderRadius: 12, backgroundColor: t.windowBg,
          border: `1px solid ${t.separator}`, boxShadow: '0 10px 40px rgba(0,0,0,0.4)', padding: 16, gap: 10 }}>
          <Text style={{ fontSize: 14, fontWeight: 600, color: t.text, textAlign: 'center' }}>{title}</Text>
          {preview}
          {note ? <Note tone="warn">{note}</Note> : null}
          {options.login ? row(`1.  ${L('wallpaper.applyLogin', 'Apply for Login Screen')}`, options.login, true) : null}
          {options.desktop ? row(`2.  ${L('wallpaper.applyDesktop', 'Apply for Desktop')}`, options.desktop) : null}
          {extra}
          <Text onClick={onClose} style={{ fontSize: 12, color: t.textDim, textAlign: 'center', padding: 2 }}>{L('wallpaper.cancel', 'Cancel')}</Text>
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

// A catalog video: its thumbnail (the still poster where the hardware is missing), its name, the
// download's progress, and — when it burned its retries — the stopped chip with Try again.
function LiveTile({ it, state, onPick, onRetry, codecsAny }) {
  const t = useTheme();
  const [hover, setHover] = useState(false);
  const pct = state.dl;
  const stopped = state.stopped;
  return (
    <View onClick={pct == null ? onPick : undefined}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ alignItems: 'center', gap: 6, width: 168, opacity: pct != null ? 0.6 : 1 }}>
      <View style={{ padding: 2, borderRadius: 10, border: `2px solid ${state.chosen ? t.accent : hover ? t.textDim : 'transparent'}`,
        transform: hover && pct == null ? 'translateY(-1px)' : 'none' }}>
        <View style={{ width: 160, height: 90, borderRadius: 8, overflow: 'hidden', border: `1px solid ${t.separator}`, backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <Image src={state.have || codecsAny ? motionThumb(it) : motionPoster(it)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </View>
        {pct != null ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View style={{ width: `${pct}%`, height: '100%', backgroundColor: t.accent }} />
          </View>
        ) : null}
      </View>
      <Text style={{ fontSize: typeScale.caption, color: t.textDim, whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: 168, textAlign: 'center' }}>{it.name}</Text>
      {stopped ? (
        <Text onClick={onRetry} style={{ fontSize: typeScale.caption, color: t.accent, textDecoration: 'underline' }}>
          {L('wallpaper.live.stopped', 'stopped — try again')}
        </Text>
      ) : null}
    </View>
  );
}

// The live preview: the real video, playing (hardware decoding), with a play/pause control. The
// player stays mounted while the page is open — pause and play never reload or re-decode it. The
// player's own stats feed the line under the box, so the numbers are the player's, not decoration.
function LivePreview({ path, playing, onStats }) {
  const codecs = useCodecs();
  const [id, setId] = useState(0);
  useEffect(() => {
    if (!path || !codecs.length) return undefined;
    let pid = 0, off = null;
    try { pid = media.play('settings', path, { loop: true, audio: 0, hwOnly: 1, fpsMax: 30, appName: 'Settings' }); } catch (e) { pid = 0; }
    if (pid) {
      off = media.on(pid, (type, d) => {
        if (type === 'state' && d.state === 'playing') setId(pid);
        else if (type === 'stats') onStats?.(d);
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
  const [dialog, setDialog] = useState(null);             // { kind: 'picture'|'live'|'motion'|'user', ... }
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [previewPlaying, setPreviewPlaying] = useState(true);
  const [stats, setStats] = useState(null);
  const [picker, setPicker] = useState(false);
  const [probe, setProbe] = useState(null);               // the picked video's probe, while its dialog is open
  const dl = useStore(motionDownloads);
  const starting = useStore(motionBusy);
  useEffect(() => { if (!items.length) { const iv = setInterval(() => { const it = readCatalog(); if (it.length) { setItems(it); clearInterval(iv); } }, 2000); return () => clearInterval(iv); } }, [items.length]);
  const cats = ['nature', 'anime', 'cars'];
  const catName = (c) => L(`wallpaper.cat.${c}`, c === 'nature' ? 'Nature' : c === 'anime' ? 'Anime' : 'Cars');

  // ---- pictures ----
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

  // ---- the supplied video ----
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

  // ---- your own video: probed before it is offered ----
  const pickOwnVideo = (path) => {
    setPicker(false);
    setBusy('probe');
    media.probe(path).then((info) => {
      setBusy('');
      if (!info) { setNote(L('wallpaper.live.unreadable', 'That file could not be read as a video.')); return; }
      const problem = userVideoProblem(info, codecs);
      if (problem === 'unreadable') { setNote(L('wallpaper.live.unreadable', 'That file could not be read as a video.')); return; }
      if (problem === 'format') { setNote(L('wallpaper.live.format', `This machine does not decode that format in hardware, so it would never play. (${codecs.join(', ') || 'no hardware formats'})`)); return; }
      setProbe(info);
      setDialog({ kind: 'user', path });
    }, (e) => { setBusy(''); setNote(errorText(e)); });
  };
  const applyOwnDesktop = () => {
    const id = `user:own-${Date.now()}`;
    const name = (dialog.path || '').split('/').pop() || 'video';
    const warn = heavyVideoWarning(probe);
    set({ motion: { '*': id }, motionUser: [{ id, name, path: dialog.path }, ...(s.motionUser || [])].slice(0, 12), wallpaperBg: null });
    setDialog(null);
    setProbe(null);
    setNote(warn === 'big' ? L('wallpaper.live.big', 'Applied — but above 1080p, a wallpaper costs more than it needs to.')
      : warn === 'fps' ? L('wallpaper.live.fps', 'Applied — but above 30 fps, the extra frames are dropped anyway (the cap is 30).')
        : L('wallpaper.liveDesktop', 'The live wallpaper now plays on the desktop.'));
  };
  const applyOwnLogin = () => {
    setLoginVideo(dialog.path).then(() => { setDialog(null); setProbe(null); setNote(L('wallpaper.liveLogin', 'The live wallpaper now plays on the login screen.')); }, (e) => setNote(errorText(e)));
  };

  // ---- the shipped catalog ----
  const pickLive = (it) => {
    if (busy || starting) return;
    if ((s.motionFiles || {})[it.id]) { setDialog({ kind: 'motion', item: it }); return; }
    if (dl[it.id] != null) return;
    const v = variantOf(it, codecs);
    if (!v) { setNote(L('wallpaper.live.noformat', 'None of this video\'s formats decodes in hardware here.')); return; }
    setBusy(it.id);
    downloadMotion(it, v).then(() => { setBusy(''); setDialog({ kind: 'motion', item: it }); },
      (e) => { setBusy(''); setNote(errorText(e)); });
  };
  const applyLiveDesktop = (it) => {
    const p = storedPathOf(it, s);
    if (p && motionDisabled(p)) retryMotion(p);           // a fresh chance with the fresh copy
    set({ motion: { '*': it.id }, wallpaperBg: null });
    setDialog(null);
    setNote(L('wallpaper.liveDesktop', 'The live wallpaper now plays on the desktop.'));
  };
  const applyLiveLogin = (it) => {
    setLoginMotion(it).then(() => { setDialog(null); setNote(L('wallpaper.liveLogin', 'The live wallpaper now plays on the login screen.')); }, (e) => setNote(errorText(e)));
  };
  const removeLive = (it) => {
    removeMotion(it).then(() => { setDialog(null); setNote(L('wallpaper.live.removed', 'Removed. The login screen keeps its own copy, so it keeps playing.')); },
      (e) => setNote(errorText(e)));
  };
  const liveOn = !!(s.motion && s.motion['*']);
  const mp = s.motionPause || {};
  const setPause = (k, v) => set({ motionPause: { ...mp, [k]: v } });
  const perf = stats ? L('wallpaper.live.perf', `Hardware decode · cap 30 fps · ${stats.dropped} frame${stats.dropped === 1 ? '' : 's'} dropped so far`)
    : codecs.length ? L('wallpaper.live.perfWait', 'Hardware decode · the numbers arrive with the first seconds of playback') : null;
  return (
    <Stack>
      {note ? <Note>{note}</Note> : null}
      {starting ? <Note>{L('wallpaper.live.starting', 'Starting the live wallpaper…')}</Note> : null}
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
      <Section title={L('wallpaper.live.title', 'Live wallpaper')} footer={L('wallpaper.live.hint', 'Videos decode in hardware only, capped at 30 frames a second. The still picture stays underneath every live layer, so nothing can blank the desktop.')}>
        {s.reduceMotion ? <Note tone="warn">{L('wallpaper.live.reduceMotion', 'Reduce Motion is on (Settings → Appearance): the live wallpaper stays paused until you turn it off.')}</Note> : null}
        {!codecs.length ? <Note>{L('wallpaper.live.nohw', 'Moving wallpapers need a compatible GPU. The still posters below stand in for the videos.')}</Note> : null}
        <View onClick={() => setPreviewPlaying((p) => !p)} style={{ width: '100%', height: 200, borderRadius: 10, overflow: 'hidden',
          border: `1px solid ${t.separator}`, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
          <LivePreview path={YOUR_VIDEO} playing={previewPlaying} onStats={setStats} />
          {!previewPlaying ? <Text style={{ fontSize: 26, color: 'rgba(255,255,255,0.9)', textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>▶</Text> : null}
        </View>
        {perf ? <Text style={{ ...cap(t), paddingVertical: 4 }}>{perf}</Text> : null}
        <SettingRow label={L('wallpaper.live.preview', 'Preview')}>
          <Toggle on={previewPlaying} onChange={setPreviewPlaying} />
        </SettingRow>
        <Actions style={{ paddingVertical: spacing.s }}>
          <Button label={L('wallpaper.live.set', 'Set Live Wallpaper…')} onClick={() => setDialog({ kind: 'live' })} />
          <Button small label={L('wallpaper.live.own', 'Your own video…')} onClick={() => setPicker(true)} />
          {liveOn ? <Button small label={L('wallpaper.live.stop', 'Back to the still wallpaper on both')} onClick={stopLive} /> : null}
        </Actions>
        {MOTION_SECTIONS.map((sec) => {
          const list = motionItems.filter((it) => it.section === sec);
          if (!list.length) return null;
          return (
            <View key={sec} style={{ gap: 8, paddingVertical: spacing.s }}>
              <Text style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{L(`wallpaper.live.sec.${sec}`, sec[0].toUpperCase() + sec.slice(1))}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {list.map((it) => (
                  <LiveTile key={it.id} it={it} codecsAny={codecs.length > 0}
                    state={{
                      dl: dl[it.id],
                      have: !!(s.motionFiles || {})[it.id],
                      chosen: s.motion?.['*'] === it.id,
                      stopped: !!storedPathOf(it, s) && motionDisabled(storedPathOf(it, s)),
                    }}
                    onPick={() => pickLive(it)}
                    onRetry={() => { const p = storedPathOf(it, s); if (p) retryMotion(p); }} />
                ))}
              </View>
            </View>
          );
        })}
        <View style={{ gap: 2, paddingVertical: spacing.s }}>
          <Text style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{L('wallpaper.live.pauseWhen', 'Pause when')}</Text>
          <SettingRow label={L('wallpaper.live.pLocked', 'The session is locked or away')} hint={L('wallpaper.live.pLockedHint', 'The still wallpaper stays drawn under the login screen.')}>
            <Toggle on={mp.locked !== false} onChange={(v) => setPause('locked', v)} />
          </SettingRow>
          <SettingRow label={L('wallpaper.live.pFullscreen', 'An app is fullscreen')}>
            <Toggle on={mp.fullscreen !== false} onChange={(v) => setPause('fullscreen', v)} />
          </SettingRow>
          <SettingRow label={L('wallpaper.live.pCovered', 'A window covers every display')}>
            <Toggle on={mp.covered !== false} onChange={(v) => setPause('covered', v)} />
          </SettingRow>
          <SettingRow label={L('wallpaper.live.pIdle', 'After 5 idle minutes')}>
            <Toggle on={mp.idle !== false} onChange={(v) => setPause('idle', v)} />
          </SettingRow>
          <SettingRow label={L('wallpaper.live.pBusy', 'The CPU is busy')} hint={L('wallpaper.live.pBusyHint', 'Two seconds above 85 % pause it until the load passes.')}>
            <Toggle on={mp.busy !== false} onChange={(v) => setPause('busy', v)} />
          </SettingRow>
          <SettingRow label={L('wallpaper.live.pBattery', 'The battery is low (≤ 20 %)')}>
            <Toggle on={mp.battery !== false} onChange={(v) => setPause('battery', v)} />
          </SettingRow>
        </View>
      </Section>
      <GlassSection />
      {picker ? <FilePicker modal title={L('wallpaper.live.pick', 'Choose a video')} filter={/\.(mp4|mkv|webm|mov|m4v|avi|ts)$/i}
        onPick={(f) => pickOwnVideo(typeof f === 'string' ? f : f.path)} onClose={() => setPicker(false)} /> : null}
      {dialog ? (
        dialog.kind === 'picture' ? (
          <ApplyDialog title={L('wallpaper.applyTitle', 'Apply wallpaper')} kind="picture" note={busy ? L('wallpaper.downloading', 'Downloading the picture…') : ''}
            preview={<Image src={`asset:wallpapers/web/${dialog.item.id}.thumb.jpg`} style={{ width: '100%', height: 120, borderRadius: 8, objectFit: 'cover' }} />}
            options={{
              busy: !!busy,
              login: () => applyLoginPicture(dialog.name),
              desktop: () => applyDesktopPicture(dialog.name),
            }}
            onClose={() => setDialog(null)} />
        ) : dialog.kind === 'live' ? (
          <ApplyDialog title={L('wallpaper.liveTitle', 'Set live wallpaper')}
            options={{
              login: () => (s.reduceMotion ? setNote(L('wallpaper.live.reduceMotion', 'Reduce Motion is on: it would stay paused.')) : setLiveLogin()),
              desktop: () => setLiveDesktop(),
            }}
            onClose={() => setDialog(null)} />
        ) : dialog.kind === 'motion' ? (
          <ApplyDialog title={dialog.item.name}
            preview={<Image src={motionThumb(dialog.item)} style={{ width: '100%', height: 120, borderRadius: 8, objectFit: 'cover' }} />}
            options={{
              busy: !!busy || starting,
              login: () => applyLiveLogin(dialog.item),
              desktop: () => applyLiveDesktop(dialog.item),
            }}
            extra={<Text onClick={() => removeLive(dialog.item)} style={{ fontSize: 12, color: '#e5484d', textAlign: 'center', padding: 2 }}>
              {L('wallpaper.live.remove', 'Remove from this computer')}
            </Text>}
            onClose={() => setDialog(null)} />
        ) : (
          <ApplyDialog title={L('wallpaper.live.ownTitle', 'Your video')}
            note={heavyVideoWarning(probe) ? L('wallpaper.live.heavy', 'This video is heavier than a wallpaper needs (over 1080p or over 30 fps). It plays, but the player drops what the cap does not need.') : ''}
            options={{
              login: () => (s.reduceMotion ? setNote(L('wallpaper.live.reduceMotion', 'Reduce Motion is on: it would stay paused.')) : applyOwnLogin()),
              desktop: () => applyOwnDesktop(),
            }}
            onClose={() => { setDialog(null); setProbe(null); }} />
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
