// Wallpaper.jsx — Settings → Wallpaper, rebuilt (docs/WALLPAPERS.md). Desktop and login screen, each with
// its own setting, chosen with the switch at the top; a large preview of the selected target; and the three
// sources: a picture (grid + fit mode), a live video (add, speed, sound, loop, pause rules) or a solid
// colour / gradient. Desktop changes apply at once; the login screen crosses the privilege boundary as
// files (sdk/motion.jsx admin actions), committed with Apply — the preview shows what is staged.
//
// The Glass section (how panels blur the wallpaper) stays here at the bottom, as it was.
import {
  View, Text, Image, MediaView, useTheme, useSettings, useLocale, tOptional, spacing, typeScale, Segmented, Toggle, Slider, Button, TextInput,
  media, useThumb, useCodecs, motionItems, motionThumb, MOTION_RATES, MOTION_SECTIONS, motionBusy, motionDownloads, downloadMotion,
  setLoginMotion, setLoginStill, setLoginImage, setLoginVideo, setLoginSolid, setLoginGradient, setLoginRate, motionPathFor, addWallpaperImage, removeWallpaperImage,
  findWallpaper, wallpaperThumb, fitOf, bgStyle, Backdrop, insaneosWallpapers, WALLPAPER_CATEGORIES, GREETER_WALLPAPER, DEFAULT_WALLPAPER,
  userWallpaperName, userVideoProblem, heavyVideoWarning, variantFor, useStore, screenDisplays, errorText, fs, FilePicker,
} from '@insaneos/sdk';
import { useEffect, useState } from 'react';
import { Section, SettingRow, Note, Actions, Stack } from './ui.jsx';

// A theme names its wallpapers with a locale key (nameKey) and an English fallback (name).
const wallpaperName = (w) => (w.nameKey && tOptional(w.nameKey)) || w.name;
const cap = (t) => ({ fontSize: typeScale.caption, color: t.textDim });
// The page's own strings, with the English text as the fallback (every language that has them shows them).
const L = (k, fb) => tOptional(`settings.${k}`) || fb;

// The wallpaper grids' thumbnail width (issue #58): 80-240 px, 100 by default.
const thumbWidth = (s) => Math.max(80, Math.min(240, Math.round(+s.wallpaperThumbs) || 100));

const HEX = /^#?[0-9a-fA-F]{6}$/;
const hexNorm = (v) => { const m = HEX.exec(v || ''); return m ? `#${m[1]}` : null; };
const hexPlain = (v) => (v || '').replace('#', '').toLowerCase();

// The colours the picker offers: darks, lights, accents.
const PRESETS = ['#151520', '#0b3d5c', '#123c2b', '#3d1d38', '#4a2c0b', '#1d1d29', '#e8e8f2', '#bfe3ff', '#c9ecd2', '#f4d9ec', '#f7e6c8', '#d9def0',
  '#0a84ff', '#30d158', '#ff9f0a', '#ff453a', '#bf5af2', '#5ac8fa', '#ffd60a', '#8e8e93'];

// The login screen's files, read directly: they are root-owned and world-readable on purpose, so the session
// can show what is really applied (the greeter reads exactly these).
const LOGIN_DIR = '/var/lib/insaneos/wallpapers';
function readLogin() {
  let still = '', fit = '', hasVideo = false;
  try { still = String(fs.read(`${LOGIN_DIR}/login-still`)).trim(); } catch (e) { /* nothing chosen */ }
  try { fit = String(fs.read(`${LOGIN_DIR}/login-fit`)).trim(); } catch (e) { /* cover */ }
  try { hasVideo = !!fs.stat(`${LOGIN_DIR}/login.mp4`); } catch (e) { /* no video */ }
  return { still, fit: ['fill', 'fit', 'stretch', 'center'].includes(fit) ? fit : 'fill', hasVideo };
}

// A login colour mark ("solid:…", "gradient:…") as the preview's bg choice, or null.
function markBg(mark) {
  if (!mark) return null;
  if (mark.startsWith('solid:')) return { kind: 'solid', a: `#${mark.slice(6)}` };
  const m = /^gradient:([0-9a-f]{6})-([0-9a-f]{6})-(\d+)$/.exec(mark);
  return m ? { kind: 'gradient', a: `#${m[1]}`, b: `#${m[2]}`, angle: +m[3] } : null;
}

// The source of a target, from its settings (desktop) or the greeter's files (login).
function sourceOf(login, s, info) {
  if (login) return info.hasVideo ? 'live' : (info.still.startsWith('solid:') || info.still.startsWith('gradient:')) ? 'solid' : 'picture';
  if (s.wallpaperBg) return 'solid';
  if (s.motion && s.motion['*']) return 'live';
  return 'picture';
}

// The mark a solid/gradient choice becomes on the login screen, and the object it becomes on the desktop.
const colorMark = (c) => (c.kind === 'gradient' && c.b ? `gradient:${hexPlain(c.a)}-${hexPlain(c.b)}-${Math.round(c.angle)}` : `solid:${hexPlain(c.a)}`);
const colorBg = (c) => ({ kind: c.kind, a: c.a, b: c.kind === 'gradient' ? c.b : null, angle: Math.round(c.angle) });

const fitOptions = (tr) => [['fill', tr('settings.wallpaper.fit.fill')], ['fit', tr('settings.wallpaper.fit.fit')],
  ['stretch', tr('settings.wallpaper.fit.stretch')], ['center', tr('settings.wallpaper.fit.center')]];
const rateOptions = MOTION_RATES.map((r) => [r, `${r / 100}×`]);

// ---- the preview ----

// A live preview really plays the video (muted, looping, hardware only). The still wallpaper stays drawn
// underneath, exactly as on the desktop: while the video starts, or without the hardware, that is what shows.
function LivePreview({ path, rate, muted }) {
  const codecs = useCodecs();
  const [id, setId] = useState(0);
  useEffect(() => {
    if (!path || !codecs.length) return undefined;
    let pid = 0, off = null;
    try { pid = media.play('settings', path, { loop: true, audio: muted ? 0 : 1, hwOnly: 1, rate, appName: 'Settings' }); } catch (e) { pid = 0; }
    if (pid) {
      off = media.on(pid, (type, d) => {
        if (type === 'state' && d.state === 'playing') setId(pid);
        else if (type === 'error' || type === 'closed') setId(0);
      });
    }
    return () => { setId(0); if (off) off(); if (pid) try { media.close(pid); } catch (e) { /* already gone */ } };
  }, [path, rate, muted, codecs.join('|')]);
  if (!id) return null;
  return <MediaView media={id} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} />;
}

function PreviewBox({ login, info, sel, setNote }) {
  const t = useTheme();
  const { t: tr } = useLocale();
  const [s] = useSettings();
  const d = (screenDisplays() || [])[0] || { w: 1920, h: 1080 };
  const codecs = useCodecs();
  // the preview keeps the display's own shape, scaled into the box: the fit modes show truthfully
  const k = Math.min(560 / d.w, 280 / d.h);
  const w = Math.round(d.w * k), h = Math.round(d.h * k);
  const displays = [{ id: 'preview', x: 0, y: 0, w, h, scale: 100 }];
  const src = sourceOf(login, s, info);
  const shownBg = login
    ? (sel && sel.source === 'solid' && sel.color && sel.color.a ? colorBg(sel.color) : markBg(info.still))
    : (src === 'solid' ? s.wallpaperBg : null);
  const list = t.wallpapers && t.wallpapers.length ? t.wallpapers : insaneosWallpapers;
  const stillId = login ? (sel && sel.stillId) || s.loginWallpaper : s.wallpaper;
  const wall = src === 'solid' && !login ? null : findWallpaper(list, login ? (stillId || GREETER_WALLPAPER) : stillId);
  const fit = login ? (sel && sel.fit) || info.fit : (s.wallpaperFit || 'fill');
  const livePath = login
    ? (sel && sel.videoPath) || (info.hasVideo ? `${LOGIN_DIR}/login.mp4` : null)
    : motionPathFor(s, (s.motion || {})['*'], codecs, d.w, d.h);
  const liveOn = src === 'live' && livePath;
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.m }}>
      <View style={{ width: w, height: h, borderRadius: 12, overflow: 'hidden', border: `1px solid ${t.separator}`, backgroundColor: '#000' }}>
        <View style={{ position: 'absolute', left: 0, top: 0, width: w, height: h }}>
          <Backdrop wallpaper={wall} bg={shownBg} fit={fit} displays={displays} />
        </View>
        {liveOn ? <LivePreview path={livePath} rate={MOTION_RATES.includes(s.motionRate) ? s.motionRate : 100} muted={s.wallpaperMuted !== false} /> : null}
        <View style={{ position: 'absolute', left: 10, bottom: 8 }}>
          <Text style={{ fontSize: typeScale.caption, color: 'rgba(255,255,255,0.92)', textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>
            {login ? tr('settings.wallpaperFor.login') : tr('settings.wallpaperFor.desktop')}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ---- shared pieces ----

function TileSpinner() {
  const [a, setA] = useState(0);
  useEffect(() => { const id = setInterval(() => setA((x) => (x + 30) % 360), 80); return () => clearInterval(id); }, []);
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <Text style={{ fontSize: 22, color: '#fff', transform: `rotate(${a}deg)` }}>⟳</Text>
    </View>
  );
}

function Thumb({ src, on, onClick, label, tw, dim }) {
  const t = useTheme();
  return (
    <View onClick={onClick} style={{ alignItems: 'center', gap: 6, width: tw + 8 }}>
      <View style={{ padding: 2, borderRadius: 10, border: `2px solid ${on ? t.accent : 'transparent'}` }}>
        <View style={{ width: tw, height: Math.round(tw * 9 / 16), borderRadius: 7, overflow: 'hidden', border: `1px solid ${t.separator}`,
          backgroundColor: dim ? 'rgba(0,0,0,0.4)' : 'transparent' }}>
          {src ? <Image src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
        </View>
      </View>
      {label ? <Text style={{ fontSize: typeScale.caption, color: on ? t.text : t.textDim, fontWeight: on ? 600 : 400,
        whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: tw + 8 }}>{label}</Text> : null}
    </View>
  );
}

// A built-in live wallpaper: downloaded on demand, played only with a compatible GPU.
function CatalogTile({ it, on, avail, percent, busy, onClick, tw }) {
  const name = tOptional(`settings.motion.item.${it.id}`) || it.name;
  return (
    <View onClick={avail ? onClick : undefined} style={{ alignItems: 'center', gap: 6, width: tw + 8, opacity: avail ? 1 : 0.45 }}>
      <View style={{ padding: 2, borderRadius: 10, border: `2px solid ${on ? t.accent : 'transparent'}` }}>
        <View style={{ width: tw, height: Math.round(tw * 9 / 16), borderRadius: 7, overflow: 'hidden', border: `1px solid ${t.separator}` }}>
          <Image src={motionThumb(it)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {busy || percent != null ? <TileSpinner /> : null}
          {percent != null ? <View style={{ position: 'absolute', left: 0, bottom: 0, height: 4, width: `${percent}%`, backgroundColor: t.accent }} /> : null}
        </View>
      </View>
      <Text style={{ fontSize: typeScale.caption, color: on ? t.text : t.textDim, fontWeight: on ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: tw + 8 }}>{name}</Text>
    </View>
  );
}

// The user's added videos, the first frame as the thumbnail (insane.media.thumb).
function UserVideoList({ selId, onPick }) {
  const [s] = useSettings();
  const list = s.motionUser || [];
  if (!list.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: spacing.m }}>
      {list.map((v) => <UserVideoTile key={v.id} v={v} on={selId === v.id} onClick={() => onPick(v)} />)}
    </View>
  );
}
function UserVideoTile({ v, on, onClick }) {
  const thumb = useThumb(v.path, 320);
  return <Thumb src={thumb} on={on} onClick={onClick} label={v.name} tw={100} dim />;
}

// ---- picture ----

function PicturePane({ login, curId, fit, onFit, onPick, onRemove, onDefault, setPicking, setNote, s, set }) {
  const t = useTheme();
  const { t: tr } = useLocale();
  const tw = thumbWidth(s);
  const list = t.wallpapers && t.wallpapers.length ? t.wallpapers : insaneosWallpapers;
  const images = (s.wallpaperImages || []).map((id) => findWallpaper([], id)).filter(Boolean);
  const cats = [...new Set([...WALLPAPER_CATEGORIES, ...list.map((w) => w.category || 'other')])]
    .map((c) => [c, list.filter((w) => (w.category || 'other') === c)]).filter(([, ws]) => ws.length);
  const catName = (c) => tOptional(`settings.wallpaperCategory.${c}`) || tr('settings.wallpaperCategory.other');
  const pick = (id) => { setNote(''); Promise.resolve(onPick(id)).catch((e) => setNote(errorText(e))); };
  return (
    <>
      <Section title={tr('settings.wallpaper.fit')}>
        <SettingRow label={tr('settings.wallpaper.fit')}>
          <Segmented small options={fitOptions(tr)} value={fit} onChange={onFit} />
        </SettingRow>
      </Section>
      <Section title={tr('settings.wallpaperCategory.mine')}>
        {images.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: spacing.m }}>
            {images.map((w) => <Thumb key={w.id} src={wallpaperThumb(w)} on={curId === w.id} onClick={() => pick(w.id)} tw={tw} />)}
          </View>
        ) : null}
        <Actions style={{ paddingVertical: spacing.s }}>
          <Button small label={tr('settings.wallpaperImage.choose')} onClick={() => setPicking('image')} />
          {!login && curId && userWallpaperName(curId) ? <Button small label={tr('settings.wallpaperImage.remove')} onClick={() => { setNote(''); Promise.resolve(onRemove()).catch((e) => setNote(errorText(e))); }} /> : null}
          {login && curId && userWallpaperName(curId) ? <Button small label={tr('settings.motion.loginDefault')} onClick={onDefault} /> : null}
        </Actions>
      </Section>
      {cats.map(([c, ws]) => (
        <Section key={c} title={catName(c)}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: spacing.m }}>
            {ws.map((w) => <Thumb key={w.id} src={wallpaperThumb(w)} on={curId === w.id} onClick={() => pick(w.id)} label={wallpaperName(w)} tw={tw} />)}
          </View>
        </Section>
      ))}
    </>
  );
}

// ---- live ----

function LivePane({ login, info, sel, setSel, setPicking, setNote, s, set }) {
  const { t: tr } = useLocale();
  const codecs = useCodecs();
  const downloads = useStore(motionDownloads);
  const busy = useStore(motionBusy);
  const can = codecs.length > 0;
  const displays = screenDisplays() || [];
  const main = displays[0] || { w: 1920, h: 1080 };
  const chosen = login ? null : (s.motion || {})['*'] || null;
  const pickCatalog = (it) => {
    setNote('');
    if (login) {
      const v = variantFor(it, codecs, main);
      if (!v) return;
      const done = () => { setSel((x) => ({ ...x, catalogId: it.id })); setNote(L('motion.loginDone', 'The login screen will play it.')); refreshLater(); };
      if ((s.motionFiles || {})[it.id]) setLoginMotion(it).then(done, (e) => setNote(errorText(e)));
      else downloadMotion(it, v).then(done, (e) => setNote(errorText(e)));
      return;
    }
    const apply = () => set({ motion: { ...(s.motion || {}), '*': it.id } });
    if ((s.motionFiles || {})[it.id]) { apply(); return; }
    const v = variantFor(it, codecs, main);
    if (!v) return;
    downloadMotion(it, v).then(apply, (e) => setNote(errorText(e)));
  };
  const addVideo = (path) => {
    setNote('');
    media.probe(path).then((pinfo) => {
      const why = userVideoProblem(pinfo, codecs);
      if (why) { setNote(L(`motion.problem.${why}`, why === 'format' ? "This GPU can't decode that video format." : "That file can't be read as a video.")); return; }
      const heavy = heavyVideoWarning(pinfo);
      if (heavy) setNote(L(`motion.heavy.${heavy}`, heavy === 'big'
        ? 'That video is above 1080p — it will cost a lot to play as a wallpaper. 1080p at 30 fps looks the same behind your windows.'
        : 'That video is above 30 fps — wallpapers look the same at 30 fps and cost half as much to play.'));
      if (login) {
        setLoginVideo(path).then(() => { setSel((x) => ({ ...x, videoPath: path })); setNote(L('motion.loginVideoDone', 'The login screen will play that video.')); refreshLater(); }, (e) => setNote(errorText(e)));
        return;
      }
      const id = `user:${Date.now()}`;
      set({ motionUser: [...(s.motionUser || []), { id, name: path.split('/').pop(), path }], motion: { ...(s.motion || {}), '*': id } });
    }, () => setNote(L('motion.problem.unreadable', "That file can't be read as a video.")));
  };
  const pw = s.motionPause || {};
  const PWS = [['fullscreen', 'A fullscreen app is open'], ['covered', 'The desktop is covered'], ['locked', 'The screen is locked'],
    ['idle', 'Nobody is using the computer (5 min)'], ['battery', 'The battery is low'], ['busy', 'The computer is busy']];
  return (
    <>
      <Section title={tr('settings.motion.title')} footer={can ? undefined : tr('settings.motion.needsGpu')}>
        {!can ? <Note>{tr('settings.motion.needsGpu')}</Note> : null}
        {can ? (
          <>
            <SettingRow label={L('wallpaper.live.speed', 'Speed')}>
              <Segmented small options={rateOptions} value={MOTION_RATES.includes(s.motionRate) ? s.motionRate : 100}
                onChange={(v) => { set({ motionRate: v }); if (login) setLoginRate(v).then(refreshLater, () => { }); }} />
            </SettingRow>
            {login ? null : (
              <SettingRow label={L('wallpaper.live.mute', 'Sound')}>
                <Toggle on={s.wallpaperMuted !== false} onChange={(on) => set({ wallpaperMuted: on })} />
              </SettingRow>
            )}
            <SettingRow label={L('wallpaper.live.loop', 'Loop')}>
              <Toggle on={s.motionLoop !== false} onChange={(on) => set({ motionLoop: on })} />
            </SettingRow>
            <Actions style={{ paddingVertical: spacing.s }}>
              <Button small label={login ? L('wallpaper.live.loginAdd', 'Login video of your own…') : L('wallpaper.live.add', 'Add video…')} onClick={() => setPicking('video')} />
              {login && info.hasVideo ? <Button small label={tr('settings.motion.loginDefault')} onClick={() => setLoginMotion(null).then(() => { setSel((x) => ({ ...x, videoPath: null })); refreshLater(); }, (e) => setNote(errorText(e)))} /> : null}
              {!login && chosen && String(chosen).startsWith('user:') ? (
                <Button small label={L('wallpaper.live.remove', 'Remove')} onClick={() => {
                  set({ motionUser: (s.motionUser || []).filter((x) => x.id !== chosen), motion: { ...(s.motion || {}), '*': null } });
                }} />
              ) : null}
              {!login && chosen && !String(chosen).startsWith('user:') ? (
                <Button small label={tr('settings.motion.none')} onClick={() => set({ motion: { ...(s.motion || {}), '*': null } })} />
              ) : null}
            </Actions>
          </>
        ) : null}
      </Section>
      {can && !login ? <UserVideoList selId={chosen} onPick={(v) => set({ motion: { ...(s.motion || {}), '*': v.id } })} /> : null}
      {can ? MOTION_SECTIONS.map((sec) => (
        <Section key={sec} title={tr(`settings.wallpaperCategory.${sec}`)}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: spacing.m }}>
            {motionItems.filter((it) => it.section === sec).map((it) => (
              <CatalogTile key={it.id} it={it} avail on={(login ? sel && sel.catalogId : chosen) === it.id} percent={downloads[it.id]}
                busy={!login && busy && chosen === it.id} onClick={() => pickCatalog(it)} tw={thumbWidth(s)} />
            ))}
          </View>
        </Section>
      )) : null}
      {!login && can ? (
        <Section title={L('wallpaper.live.pause', 'Pause when')} footer={tr('settings.motion.hint')}>
          {PWS.map(([k, fb]) => (
            <SettingRow key={k} label={L(`wallpaper.pause.${k}`, fb)}>
              <Toggle on={pw[k] !== false} onChange={(on) => set({ motionPause: { ...pw, [k]: on } })} />
            </SettingRow>
          ))}
        </Section>
      ) : null}
      {login ? <Note>{L('loginIdleNote', 'The login screen pauses its video after five minutes with no input, and always plays it muted.')}</Note> : null}
    </>
  );
}

// ---- solid colour / gradient ----

function Swatches({ accent, value, onPick }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: spacing.s }}>
      {PRESETS.map((c) => (
        <View key={c} onClick={() => onPick(c)} style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: c,
          border: `2px solid ${value && value.toLowerCase() === c.toLowerCase() ? accent : 'transparent'}`, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      ))}
      <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: value || 'transparent', border: `1px solid ${t.separator}`, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
    </View>
  );
}

function ColorPicker({ color, setColor, accent }) {
  const t = useTheme();
  const { t: tr } = useLocale();
  const [draftA, setDraftA] = useState(null), [draftB, setDraftB] = useState(null);
  useEffect(() => { setDraftA(null); setDraftB(null); }, [color.kind]);
  const aOk = hexNorm(draftA == null ? color.a : draftA);
  const bOk = hexNorm(draftB == null ? color.b : draftB);
  const commit = (a, b) => setColor((c) => ({ ...c, ...(a ? { a } : {}), ...(b ? { b } : {}) }));
  return (
    <>
      <SettingRow label={tr('settings.wallpaper.color.solid')}>
        <Segmented small options={[['solid', tr('settings.wallpaper.color.solid')], ['gradient', tr('settings.wallpaper.color.gradient')]]}
          value={color.kind} onChange={(kind) => setColor((c) => ({ ...c, kind }))} />
      </SettingRow>
      <SettingRow label={tr('settings.wallpaper.color.from')} stack>
        <Swatches accent={accent} value={color.a} onPick={(c) => commit(c, null)} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
          <TextInput value={draftA == null ? color.a : draftA} onChange={(v) => { setDraftA(v); const n = hexNorm(v); if (n) commit(n, null); }} width={110} />
          <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: aOk || 'transparent', border: `1px solid ${t.separator}` }} />
        </View>
      </SettingRow>
      {color.kind === 'gradient' ? (
        <>
          <SettingRow label={tr('settings.wallpaper.color.to')} stack>
            <Swatches accent={accent} value={color.b} onPick={(c) => commit(null, c)} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
              <TextInput value={draftB == null ? color.b : draftB} onChange={(v) => { setDraftB(v); const n = hexNorm(v); if (n) commit(null, n); }} width={110} />
              <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: bOk || 'transparent', border: `1px solid ${t.separator}` }} />
            </View>
          </SettingRow>
          <SettingRow label={tr('settings.wallpaper.color.angle')} stack>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
              <Slider value={color.angle} min={0} max={360} width={220} onChange={(v) => setColor((c) => ({ ...c, angle: Math.round(v) }))} />
              <Text style={cap(t)}>{`${Math.round(color.angle)}°`}</Text>
            </View>
          </SettingRow>
        </>
      ) : null}
    </>
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

// The login screen applies its staged choice when the page changes a discrete control or Apply is pressed.
const refreshLater = () => setTimeout(() => globalThis.__wallpaperRefresh?.(), 500);

export function WallpaperSettings() {
  const t = useTheme();
  const { t: tr } = useLocale();
  const [s, set] = useSettings();
  const codecs = useCodecs();
  const [target, setTarget] = useState('desktop');
  const [note, setNote] = useState('');
  const [picking, setPicking] = useState(null);          // null | 'image' | 'video'
  const [info, setInfo] = useState(() => readLogin());
  const [sel, setSel] = useState(null);                  // the login screen's staged choice
  const refresh = () => setInfo(readLogin());
  useEffect(() => {
    globalThis.__wallpaperRefresh = refresh;
    return () => { delete globalThis.__wallpaperRefresh; };
  }, []);
  const login = target === 'login';
  const source = login ? (sel ? sel.source : sourceOf(true, s, info)) : sourceOf(false, s, info);
  // the login tab's staged state starts from what is applied right now
  useEffect(() => {
    if (!login || sel) return;
    setSel({ source: sourceOf(true, s, info), catalogId: null, videoPath: null, fit: info.fit,
      stillId: info.still.startsWith('image:') ? s.loginWallpaper : (info.still && !info.still.startsWith('solid:') && !info.still.startsWith('gradient:') ? info.still : null),
      color: markBg(info.still) || { kind: 'solid', a: '#1d1d29', b: '#31355c', angle: 160 } });
  }, [login, info]);
  const applyLogin = () => {
    setNote('');
    if (!sel) return;
    const f = sel.fit || 'fill';
    let p;
    if (sel.source === 'picture') p = sel.stillId && userWallpaperName(sel.stillId)
      ? setLoginImage(sel.stillId, f) : setLoginStill(sel.stillId || GREETER_WALLPAPER, f);
    else if (sel.source === 'solid') p = sel.color.kind === 'gradient' && sel.color.b
      ? setLoginGradient(hexPlain(sel.color.a), hexPlain(sel.color.b), Math.round(sel.color.angle), f)
      : setLoginSolid(hexPlain(sel.color.a), f);
    else p = Promise.resolve();
    p.then(() => { set({ loginFit: f }); refresh(); setNote(L('wallpaper.applied', 'Wallpaper applied')); }, (e) => setNote(errorText(e)));
  };
  const shownColor = login ? (sel && sel.color) || { kind: 'solid', a: '#1d1d29', b: '#31355c', angle: 160 }
    : s.wallpaperBg ? { kind: s.wallpaperBg.kind, a: s.wallpaperBg.a, b: s.wallpaperBg.b || '#31355c', angle: s.wallpaperBg.angle || 160 }
      : { kind: 'solid', a: '#1d1d29', b: '#31355c', angle: 160 };
  const noteNode = note && !note.startsWith('__') ? <Note tone={/can|not|format|unreadable/i.test(note) ? 'warn' : undefined}>{note}</Note> : null;
  const curId = login ? (sel && sel.stillId) || s.loginWallpaper : s.wallpaper;
  const fit = login ? (sel && sel.fit) || info.fit : (s.wallpaperFit || 'fill');
  const pickImage = (id) => {
    if (login) { setSel((x) => ({ ...x, source: 'picture', stillId: id })); return; }
    set({ wallpaper: id, wallpaperBg: null, motion: {} });
  };
  const addVideo = (path) => {
    setPicking(null);
    setNote('');
    media.probe(path).then((pinfo) => {
      const why = userVideoProblem(pinfo, codecs);
      if (why) { setNote(L(`motion.problem.${why}`, why === 'format' ? "This GPU can't decode that video format." : "That file can't be read as a video.")); return; }
      const heavy = heavyVideoWarning(pinfo);
      if (heavy) setNote(L(`motion.heavy.${heavy}`, heavy === 'big'
        ? 'That video is above 1080p — it will cost a lot to play as a wallpaper. 1080p at 30 fps looks the same behind your windows.'
        : 'That video is above 30 fps — wallpapers look the same at 30 fps and cost half as much to play.'));
      if (login) {
        setLoginVideo(path).then(() => { setSel((x) => ({ ...x, source: 'live', videoPath: path })); setNote(L('motion.loginVideoDone', 'The login screen will play that video.')); refresh(); }, (e) => setNote(errorText(e)));
        return;
      }
      const id = `user:${Date.now()}`;
      set({ motionUser: [...(s.motionUser || []), { id, name: path.split('/').pop(), path }], motion: { ...(s.motion || {}), '*': id } });
    }, () => setNote(L('motion.problem.unreadable', "That file can't be read as a video.")));
  };
  return (
    <Stack>
      <Segmented value={target} onChange={(v) => { setTarget(v); setNote(''); if (v === 'login') refresh(); }}
        options={[['desktop', tr('settings.wallpaperFor.desktop')], ['login', tr('settings.wallpaperFor.login')]]} />
      {noteNode}
      <PreviewBox login={login} info={info} sel={sel} />
      <Section title={L('wallpaper.source', 'Source')}>
        <SettingRow label={L('wallpaper.source', 'Source')}>
          <Segmented options={[['picture', L('wallpaper.source.picture', 'Picture')], ['live', L('wallpaper.source.live', 'Live (video)')], ['solid', L('wallpaper.source.solid', 'Solid / gradient')]]}
            value={source} onChange={(src) => {
              setNote('');
              if (login) { setSel((x) => ({ ...(x || { fit: info.fit, color: { kind: 'solid', a: '#1d1d29', b: '#31355c', angle: 160 } }), source: src })); return; }
              if (src === 'picture') set({ wallpaperBg: null, motion: {} });
              else if (src === 'live') set({ wallpaperBg: null });
              else set({ wallpaperBg: s.wallpaperBg || { kind: 'solid', a: '#1d1d29', b: null, angle: 160 }, motion: {} });
            }} />
        </SettingRow>
        {source === 'picture' ? (
          <PicturePane login={login} curId={curId} fit={fit}
            onFit={(f) => { if (login) setSel((x) => ({ ...x, fit: f })); else set({ wallpaperFit: f }); }}
            onPick={pickImage}
            onRemove={() => removeWallpaperImage(curId).then(() => {
              set({ wallpaperImages: (s.wallpaperImages || []).filter((x) => x !== curId), ...(s.wallpaper === curId ? { wallpaper: DEFAULT_WALLPAPER } : {}) });
              if (login) setSel((x) => ({ ...x, stillId: null }));
            })}
            onDefault={() => setLoginMotion(null).then(() => { if (sel) setSel((x) => ({ ...x, stillId: null })); refresh(); }, (e) => setNote(errorText(e)))}
            setPicking={setPicking} setNote={setNote}
            s={s} set={set} />
        ) : null}
        {source === 'live' ? <LivePane login={login} info={info} sel={sel} setSel={setSel} setPicking={setPicking} setNote={setNote} s={s} set={set} /> : null}
        {source === 'solid' ? (
          <>
            <ColorPicker color={shownColor} accent={t.accent} setColor={login
              ? (fn) => setSel((x) => ({ ...x, color: fn(x.color) }))
              : (fn) => set({ wallpaperBg: colorBg(fn(shownColor)) })} />
            {login ? null : (
              <SettingRow label={tr('settings.wallpaper.fit')}>
                <Segmented small options={fitOptions(tr)} value={s.wallpaperFit || 'fill'} onChange={(f) => set({ wallpaperFit: f })} />
              </SettingRow>
            )}
          </>
        ) : null}
        <Actions>
          {login
            ? <Button label={L('wallpaper.apply', 'Apply')} onClick={applyLogin} />
            : <Button label={L('wallpaper.apply', 'Apply')} onClick={() => setNote(L('wallpaper.applied', 'Wallpaper applied'))} />}
        </Actions>
      </Section>
      <GlassSection />
      <SettingRow label={tr('settings.wallpaperThumbs.size')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
          <Text style={cap(t)}>{tr('settings.wallpaperThumbs.small')}</Text>
          <Slider value={thumbWidth(s)} min={80} max={240} width={150} onChange={(v) => set({ wallpaperThumbs: Math.round(v) })} />
          <Text style={cap(t)}>{tr('settings.wallpaperThumbs.large')}</Text>
        </View>
      </SettingRow>
      {picking === 'image' ? (
        <FilePicker title={tr('settings.wallpaperImage.pick')} filter={/\.(png|jpe?g)$/i} onClose={() => setPicking(null)}
          onPick={(p) => {
            setPicking(null);
            const path = [].concat(p)[0];
            if (!path) return;
            addWallpaperImage(path).then((id) => {
              set({ wallpaperImages: [id, ...(s.wallpaperImages || [])].slice(0, 12) });
              pickImage(id);
            }, (e) => setNote(errorText(e)));
          }} />
      ) : null}
      {picking === 'video' ? (
        <FilePicker title={login ? L('wallpaper.live.loginAdd', 'Login video of your own…') : L('wallpaper.live.add', 'Add video…')}
          filter={/\.(mp4|webm|mkv)$/i} onClose={() => setPicking(null)} onPick={(p) => { const path = [].concat(p)[0]; if (path) addVideo(path); }} />
      ) : null}
    </Stack>
  );
}
