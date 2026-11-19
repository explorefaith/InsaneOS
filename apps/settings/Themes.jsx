// Themes.jsx — Settings → Themes: the Theme Studio (docs/INSANE-DESKTOP-PERSONALIZATION-PROGRESS.md).
//
// The gallery lists every theme — the 26 built-ins and the user's own presets — as miniature
// desktops: the real wallpaper, the real palette, the real composition grammar, drawn natively at
// preview size (no scale transforms anywhere: this engine renders scaled children blank — the
// ledgered lesson). Applying writes the appearance keys and the widget composition through
// sdk/themestudio.js and the live desktop follows through the paths that already work. The
// customize section below edits the ACTIVE theme: the layer list (visibility, z-order), the
// selected widget's geometry and typography, add/duplicate/remove, reset — with undo — and
// Save as preset keeps the result as the user's own, never overwriting a built-in.
import {
  View, Text, Image, ScrollView, useTheme, useLocale, tOptional, spacing, typeScale, Button, Slider, Toggle,
  TextInput, useStore, useSettings, settings, screen, tsLive, tsDesktopUndo, tsHistory, tsAllThemes, tsApplyTheme, tsDeactivate, tsMutate, tsAdd,
  tsRemove, tsDuplicate, tsResize, tsMove, tsZ, tsSetInstance, tsResetInstance, tsResetTheme,
  tsSaveCustom, tsRenameCustom, tsDeleteCustom, tsCreateHistory, tsResolvePlan, TS_KINDS, TS_FONTS,
  tsAlignW, tsDistributeW, addListener, resolveStyle as rsResolveStyle, withAlpha as rsWithAlpha,
  tsRichSegments, tsRichSplit, fs, FilePicker, saveSettingsNow,
  TS_WIDGET_SPECS, TS_CATS, specsOfCat, SearchField,
  resolveStyle, withAlpha, insaneosWallpapers, wallpaperThumb, Layer, wm, useAppWindow, errorText,
} from '@insaneos/sdk';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Section, SettingRow, Note, Actions, Stack, Columns, PopUp, Message } from './ui.jsx';

const L = (k, fb) => tOptional(`settings.themes.${k}`) || fb;
// The kind's name in the interface language (the spec's English as the fallback).
const kindLabel = (id) => tOptional(`settings.kind.${id}`) || (TS_KINDS[id] || {}).label || id;

// ---------------------------------------------------------------- the miniature desktop

// The theme's wallpaper as a preview source: the catalog thumb (a real 320×180 decode), or the
// theme's own background colour when it stands on a gradient/solid.
const previewWallpaper = (appearance) => {
  if (appearance?.wallpaper) {
    const w = insaneosWallpapers.find((x) => x.id === appearance.wallpaper);
    if (w) return wallpaperThumb(w);
  }
  return null;
};

const bgOf = (appearance) => {
  const bg = appearance?.wallpaperBg;
  if (bg && bg.kind === 'solid' && /^#[0-9a-f]{6}$/i.test(bg.a || '')) return bg.a;
  if (bg && bg.kind === 'gradient' && /^#[0-9a-f]{6}$/i.test(bg.a || '')) return bg.a;
  return null;
};

// A widget block in the miniature: the instance's surface (paper at its alpha, radius, border)
// with one or two quiet bars standing for the text. Everything scales by k — geometry, not a
// transform — so the composition's grammar stays exact at any size.
function Block({ w, k, theme }) {
  const st = resolveStyle(theme.style || {}, w.style || {});
  const paper = st.paper || (theme.appearance.mode === 'dark' ? '#1B1A22' : '#F2EFE8');
  const ink = st.color || '#1d1d1f';
  const bw = Math.max(8, Math.round(w.w * k));
  const bh = Math.max(5, Math.round(w.h * k));
  if (w.hidden) return null;
  const big = w.kind === 'clock-digital' || w.kind === 'headline' || w.kind === 'label';
  return (
    <View style={{
      position: 'absolute', left: Math.round(w.x * k), top: Math.round(w.y * k), width: bw, height: bh,
      borderRadius: Math.min(12, Math.max(2, Math.round((st.radius ?? 16) * k * 2))),
      backgroundColor: withAlpha(paper, st.alpha ?? 0.7),
      border: st.border && st.border !== 'none' ? `${Math.max(1, Math.round(k * 2))}px solid ${withAlpha(ink, 0.35)}` : undefined,
      padding: Math.max(1, Math.round((st.pad ?? 18) * k * 1.6)), overflow: 'hidden', gap: Math.max(1, 3 * k * 2),
    }}>
      <View style={{ height: Math.max(2, bh * (big ? 0.42 : 0.18)), width: `${big ? 62 : 55}%`, borderRadius: 99, backgroundColor: withAlpha(ink, 0.5) }} />
      {!big ? <View style={{ height: Math.max(2, bh * 0.12), width: '78%', borderRadius: 99, backgroundColor: withAlpha(ink, 0.22) }} /> : null}
      {bh > 46 && !big ? <View style={{ height: Math.max(2, bh * 0.1), width: '40%', borderRadius: 99, backgroundColor: withAlpha(st.accent || ink, 0.55) }} /> : null}
    </View>
  );
}

// The miniature desktop: the real wallpaper (or background), the real palette, the real plan.
function ThemeMiniature({ theme, width, height }) {
  const k = width / (theme.sw || 1280);
  const h = Math.round((theme.sh || 720) * k);
  const src = previewWallpaper(theme.appearance);
  const bg = bgOf(theme.appearance);
  const area = { x: 0, y: 0, w: theme.sw || 1280, h: theme.sh || 720 };
  const plan = useMemo(() => (theme.custom
    ? theme.widgets
    : tsResolvePlan(theme.widgets || [], area, theme.sw || 1280, theme.sh || 720)),
    [theme.id, theme.custom && theme.widgets, theme.sw, theme.sh]);
  return (
    <View style={{ width, height, borderRadius: 10, overflow: 'hidden', backgroundColor: bg || '#141418' }}>
      {src ? <Image src={src} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
      {plan.map((w) => <Block key={w.id} w={w} k={k} theme={theme} />)}
    </View>
  );
}

// ---------------------------------------------------------------- the gallery card

function ThemeCard({ theme, active, onSet, onPreview, onCustomize }) {
  const t = useTheme();
  const [hover, setHover] = useState(false);
  const Act = ({ label, onClick, primary }) => (
    <View onClick={(e) => { e.stopPropagation?.(); onClick(); }} style={{ flex: 1, height: 24, borderRadius: 6,
      justifyContent: 'center', alignItems: 'center', cursor: 'pointer',
      backgroundColor: primary ? t.accent : t.control }}>
      <Text style={{ fontSize: 11, fontWeight: 600, color: primary ? '#ffffff' : t.text }}>{label}</Text>
    </View>
  );
  return (
    <View onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ width: 236, gap: 6, padding: 6, borderRadius: 12, cursor: 'pointer',
        border: `2px solid ${active ? t.accent : hover ? t.separator : 'transparent'}`,
        backgroundColor: active ? t.accentSubtle : 'transparent' }}>
      <View onClick={onPreview}>
        <ThemeMiniature theme={theme} width={220} height={124} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 }}>
        <Text style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: t.text, textAlign: 'start' }}
         >{theme.name}</Text>
        {theme.colors.slice(0, 3).map((c) => (
          <View key={c} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c, border: `1px solid ${t.separator}` }} />
        ))}
      </View>
      <Text style={{ fontSize: 11, color: t.textDim, paddingHorizontal: 2, minHeight: 26, textAlign: 'start' }}
       >{theme.desc}</Text>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        <Act label={active ? L('reapply', 'Reapply') : L('setTheme', 'Set')} onClick={onSet} primary />
        <Act label={L('preview', 'Preview')} onClick={onPreview} />
        <Act label={L('customize', 'Customize')} onClick={onCustomize} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- the preview dialog

function PreviewDialog({ theme, active, onApply, onClose, onDeactivate }) {
  const t = useTheme();
  const win = useAppWindow();
  const g = wm.frame(wm.get(win.id) || {});
  return (
    <Layer name="modal">
      <View style={{ position: 'absolute', left: g.x || 0, top: g.y || 0, width: g.w || 640, height: g.h || 480,
        justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
        <View onClick={(e) => e.stopPropagation?.()} style={{ width: 540, borderRadius: 14, backgroundColor: t.windowBg,
          border: `1px solid ${t.separator}`, boxShadow: '0 18px 60px rgba(0,0,0,0.45)', padding: 18, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, color: t.text, textAlign: 'start' }}>{theme.name}</Text>
            {theme.colors.map((c) => <View key={c} style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c, border: `1px solid ${t.separator}` }} />)}
          </View>
          <Text style={{ fontSize: 12, color: t.textDim, textAlign: 'start' }}>{theme.desc}</Text>
          <ThemeMiniature theme={theme} width={502} height={282} />
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
            {active ? <Button label={L('stopUsing', 'Use no theme')} onClick={onDeactivate} /> : null}
            <Button label={tOptional('settings.wallpaper.cancel') || 'Cancel'} onClick={onClose} />
            <Button primary label={active ? L('reapply', 'Reapply') : L('applyTheme', 'Apply theme')} onClick={onApply} />
          </View>
        </View>
      </View>
    </Layer>
  );
}

// ---------------------------------------------------------------- the customize editor

const STEPS = [12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 44, 48, 56, 64, 72, 80, 96];
const WEIGHTS = [400, 500, 600, 700, 800];

function LayerRow({ w, index, n, selected, onSelect, onEye, onUp, onDown, onDup, onRemove }) {
  const t = useTheme();
  const label = kindLabel(w.kind);
  return (
    <View onClick={() => onSelect(w.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34,
      paddingHorizontal: 8, borderRadius: 8, cursor: 'pointer',
      backgroundColor: selected ? t.accentSubtle : 'transparent' }}>
      <Text style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: selected ? 600 : 400, color: w.hidden ? t.textDim : t.text, textAlign: 'start' }}
       >{label}</Text>
      <Text onClick={(e) => { e.stopPropagation?.(); onUp(); }} style={{ fontSize: 12, color: index === n - 1 ? t.separator : t.textDim, padding: '2px 4px' }}>↑</Text>
      <Text onClick={(e) => { e.stopPropagation?.(); onDown(); }} style={{ fontSize: 12, color: index === 0 ? t.separator : t.textDim, padding: '2px 4px' }}>↓</Text>
      <Text onClick={(e) => { e.stopPropagation?.(); onDup(); }} style={{ fontSize: 12, color: t.textDim, padding: '2px 4px' }}>⧉</Text>
      <Text onClick={(e) => { e.stopPropagation?.(); onEye(); }} style={{ fontSize: 12, color: t.textDim, padding: '2px 4px' }}>{w.hidden ? '○' : '●'}</Text>
      <Text onClick={(e) => { e.stopPropagation?.(); onRemove(); }} style={{ fontSize: 13, color: t.textDim, padding: '2px 4px' }}>×</Text>
    </View>
  );
}

// One patch into the selected widget's style; null values delete (resolveStyle's contract).
function StyleControl({ label, children }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 }}>
      <Text style={{ width: 92, fontSize: 12, color: t.textDim, textAlign: 'start' }}>{label}</Text>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{children}</View>
    </View>
  );
}

function WidgetEditor({ w, onStyle, onGeom, onCfg, onReset, onLock, onAlign, onDistributeX, onDistributeY, area }) {
  const t = useTheme();
  const st = w.style || {};
  const set = (patch) => onStyle(patch);
  const nudge = (dx, dy) => onGeom(w.x + dx, w.y + dy);
  const scale = (f) => onGeom(null, null, Math.round((w.w * f) / 4) * 4, Math.round((w.h * f) / 4) * 4);
  return (
    <View style={{ gap: 8, padding: 12, borderRadius: 12, border: `1px solid ${t.separator}`, backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: t.text, textAlign: 'start' }}>
          {kindLabel(w.kind)}</Text>
        <Button small label="S" onClick={() => scale(0.8)} />
        <Button small label="M" onClick={() => scale(1)} />
        <Button small label="L" onClick={() => scale(1.25)} />
        <Button small label={w.locked ? L('unlock', 'Unlock') : L('lock', 'Lock')} onClick={() => onLock(!w.locked)} />
        <Button small label={L('resetWidget', 'Reset')} onClick={onReset} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Text style={{ width: 92, fontSize: 12, color: t.textDim, textAlign: 'start' }}>{L('arrange', 'Arrange')}</Text>
        {[['left', '⇤'], ['center-x', '⇔'], ['right', '⇥'], ['top', '⇧'], ['center-y', '⇕'], ['bottom', '⇩']].map(([edge, glyph]) => (
          <Button key={edge} small label={glyph} onClick={() => onAlign(edge)} />
        ))}
        <Button small label={L('distributeX', 'Distribute X')} onClick={onDistributeX} />
        <Button small label={L('distributeY', 'Distribute Y')} onClick={onDistributeY} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ width: 92, fontSize: 12, color: t.textDim, textAlign: 'start' }}>{L('position', 'Position')}</Text>
        <Button small label="←" onClick={() => nudge(-4, 0)} />
        <Button small label="→" onClick={() => nudge(4, 0)} />
        <Button small label="↑" onClick={() => nudge(0, -4)} />
        <Button small label="↓" onClick={() => nudge(0, 4)} />
        <Text style={{ fontSize: 11, color: t.textDim }}>{`${w.x}, ${w.y}`}</Text>
      </View>
      <StyleControl label={L('font', 'Typeface')}>
        <PopUp value={st.font || ''} onChange={(v) => set({ font: v || null })} width={190}
          options={[['', L('themeFont', 'Theme default')], ...TS_FONTS.map((f) => [f.id, f.name])]} />
      </StyleControl>
      <StyleControl label={L('size', 'Size')}>
        <PopUp value={st.size ?? ''} onChange={(v) => set({ size: v === '' ? null : v })} width={110}
          options={[['', L('themeSize', 'Default')], ...STEPS.map((x) => [x, `${x}`])]} />
        <PopUp value={st.weight ?? ''} onChange={(v) => set({ weight: v === '' ? null : v })} width={110}
          options={[['', L('themeWeight', 'Weight')], ...WEIGHTS.map((x) => [x, `${x}`])]} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 12, color: t.textDim }}>{L('italic', 'Italic')}</Text>
          <Toggle on={!!st.italic} onChange={(v) => set({ italic: v ? true : null })} />
        </View>
      </StyleControl>
      <StyleControl label={L('ink', 'Ink')}>
        {[null, ...(w._palette || ['#1d1d1f', '#f5f5f7'])].map((c, i) => (
          <View key={i} onClick={() => set({ color: c })} style={{ width: 20, height: 20, borderRadius: 10,
            backgroundColor: c || 'transparent', border: `2px solid ${(st.color || null) === c ? t.accent : t.separator}`,
            alignItems: 'center', justifyContent: 'center' }}>
            {c === null ? <Text style={{ fontSize: 9, color: t.textDim }}>A</Text> : null}
          </View>
        ))}
        <TextInput value={st.color || ''} onChange={(v) => set({ color: v ? v : null })}
          placeholder="#hex" style={{ width: 110 }} />
      </StyleControl>
      <StyleControl label={L('surface', 'Surface')}>
        <View style={{ flex: 1, maxWidth: 220 }}>
          <Slider value={st.alpha ?? 0.7} min={0.16} max={1} step={0.02}
            onChange={(v) => set({ alpha: v })} />
        </View>
        <Text style={{ fontSize: 11, color: t.textDim, width: 34 }}>{`${Math.round((st.alpha ?? 0.7) * 100)}%`}</Text>
      </StyleControl>
      <StyleControl label={L('corners', 'Corners')}>
        <View style={{ flex: 1, maxWidth: 220 }}>
          <Slider value={st.radius ?? 16} min={0} max={28} step={1} onChange={(v) => set({ radius: Math.round(v) })} />
        </View>
        <Text style={{ fontSize: 11, color: t.textDim, width: 34 }}>{`${Math.round(st.radius ?? 16)}`}</Text>
      </StyleControl>
      <StyleControl label={L('glass', 'Glass')}>
        <View style={{ flex: 1, maxWidth: 220 }}>
          <Slider value={st.blur ?? 0.4} min={0} max={1} step={0.05} onChange={(v) => set({ blur: v || null })} />
        </View>
        <Text style={{ fontSize: 11, color: t.textDim, width: 34 }}>{`${Math.round((st.blur ?? 0.4) * 100)}%`}</Text>
      </StyleControl>
      <StyleControl label={L('align', 'Align')}>
        <PopUp value={st.align || 'left'} onChange={(v) => set({ align: v === 'left' ? null : v })} width={130}
          options={[['left', L('alignLeft', 'Left')], ['center', L('alignCentre', 'Centre')], ['right', L('alignRight', 'Right')]]} />
        <PopUp value={st.shadow || 'soft'} onChange={(v) => set({ shadow: v === 'soft' ? null : v })} width={130}
          options={[['soft', L('shadowSoft', 'Soft shadow')], ['lift', L('shadowLift', 'Lifted')], ['none', L('shadowNone', 'None')]]} />
      </StyleControl>
      {w.kind === 'clock-digital' ? (
        <StyleControl label={L('clock', 'Clock')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 12, color: t.textDim }}>24 h</Text>
            <Toggle on={(w.cfg || {}).h24 !== false} onChange={(v) => onCfg({ h24: v ? true : false })} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 12, color: t.textDim }}>{L('seconds', 'Seconds')}</Text>
            <Toggle on={!!(w.cfg || {}).seconds} onChange={(v) => onCfg({ seconds: !!v })} />
          </View>
        </StyleControl>
      ) : null}
      {w.kind === 'media' ? (
        <StyleControl label={L('idle', 'Idle')}>
          <PopUp value={(w.cfg || {}).idle || 'idle'} onChange={(v) => onCfg({ idle: v })} width={170}
            options={[['idle', L('idleCard', 'Show a quiet card')], ['hide', L('idleHide', 'Hide the widget')]]} />
        </StyleControl>
      ) : null}
      {w.kind === 'notes' ? (
        <StyleControl label={L('text', 'Text')}>
          <TextInput value={(w.cfg || {}).text || ''} onChange={(v) => onCfg({ text: v })} style={{ width: 220 }} />
        </StyleControl>
      ) : null}
      {w.kind === 'quote' ? (
        <StyleControl label={L('text', 'Text')}>
          <TextInput value={(w.cfg || {}).text || ''} onChange={(v) => onCfg({ text: v })} style={{ width: 220 }} />
        </StyleControl>
      ) : null}
      {w.kind === 'headline' || w.kind === 'label' ? (
        <StyleControl label={L('text', 'Text')}>
          <TextInput value={(w.cfg || {}).text || ''} onChange={(v) => onCfg({ text: v })} style={{ width: 220 }} />
        </StyleControl>
      ) : null}
      {w.kind === 'label' || w.kind === 'headline' || w.kind === 'quote' || w.kind === 'notes' ? (
        <RichEditor w={w} onCfg={onCfg} pal={w._palette || []} />
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- the add-widget dialog

// 105 kinds: a flat list is unusable. Category chips + a search field; the grid shows names only
// (never raw pixel sizes). Adding places the widget at a free spot of the real work area.
function AddDialog({ onAdd, onClose }) {
  const t = useTheme();
  const [cat, setCat] = useState('time');
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const list = ql ? TS_WIDGET_SPECS.filter((sp) => sp.label.toLowerCase().includes(ql))
    : specsOfCat(cat);
  return (
    <Layer name="modal">
      <View style={{ position: 'absolute', left: 0, top: 0, width: screen.width, height: screen.height,
        justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
        <View onClick={(e) => e.stopPropagation?.()} style={{ width: 560, borderRadius: 14, backgroundColor: t.windowBg,
          border: `1px solid ${t.separator}`, boxShadow: '0 18px 60px rgba(0,0,0,0.45)', padding: 16, gap: 10 }}>
          <Text style={{ fontSize: 15, fontWeight: 700, color: t.text, textAlign: 'start' }}>{L('addWidgetTitle', 'Add a widget')}</Text>
          <SearchField value={q} onChange={setQ} placeholder={L('searchKinds', 'Search widgets…')} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {TS_CATS.map(([c, name]) => (
              <View key={c} onClick={() => { setCat(c); setQ(''); }} style={{ paddingHorizontal: 10, height: 24, borderRadius: 12,
                justifyContent: 'center', backgroundColor: !ql && cat === c ? t.accent : 'transparent',
                border: `1px solid ${!ql && cat === c ? t.accent : t.separator}` }}>
                <Text style={{ fontSize: 12, color: !ql && cat === c ? '#ffffff' : t.textDim }}>{name}</Text>
              </View>
            ))}
          </View>
          <ScrollView style={{ height: 280 }} resetKey={`${cat}:${q}`}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 }}>
              {list.map((sp) => (
                <View key={sp.id} onClick={() => { onAdd(sp.id); onClose(); }} style={{ width: 168, paddingHorizontal: 10, height: 30,
                  borderRadius: 8, justifyContent: 'center', backgroundColor: t.control, cursor: 'pointer' }}>
                  <Text style={{ fontSize: 12, color: t.text, whiteSpace: 'nowrap', textOverflow: 'ellipsis', numberOfLines: 1 }}>{kindLabel(sp.id)}</Text>
                </View>
              ))}
              {!list.length ? <Text style={{ fontSize: 12, color: t.textDim, padding: 12 }}>{L('noKinds', 'Nothing matches.')}</Text> : null}
            </View>
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Button label={tOptional('settings.wallpaper.cancel') || 'Cancel'} onClick={onClose} />
          </View>
        </View>
      </View>
    </Layer>
  );
}


// ---------------------------------------------------------------- the live studio canvas

// The active composition, natively drawn at preview scale (no transforms — the engine renders
// scaled children blank). A block click selects; a drag moves the real widget live through
// tsMove, with one undo step per drag (the history's beginDrag/endDrag coalescing) and the
// alignment guides drawn while a drag snaps.
function StudioCanvas({ widgets, area, selW, onSelect, histRef }) {
  const t = useTheme();
  const W = 520;
  const k = W / area.w;
  const H = Math.round(area.h * k);
  const drag = useRef(null);
  const live = useStore(tsLive);
  const guides = useRef(null);
  const offs = useRef([]);
  useEffect(() => () => { for (const off of offs.current.splice(0)) off(); }, []);
  const byZ = [...widgets].sort((a, b) => a.z - b.z);
  const start = (e, w) => {
    if (w.locked) return;
    e.stopPropagation?.();
    onSelect(w.id);
    drag.current = { id: w.id, sx: e.x, sy: e.y, ox: w.x, oy: w.y, moved: false, pre: tsLive.get().widgets.map((x) => ({ ...x })) };
    histRef.current.beginDrag(drag.current.pre);
    const move = (ev) => {
      const d = drag.current;
      if (!d) return;
      d.moved = true;
      const nx = d.ox + (ev.x - d.sx) / k;
      const ny = d.oy + (ev.y - d.sy) / k;
      try {
        tsMove(d.id, nx, ny, area);
        const cur = (tsLive.get().widgets.find((x) => x.id === d.id)) || {};
        guides.current = { x: cur.x, y: cur.y, w: cur.w, h: cur.h };
      } catch (err) { /* clamped */ }
    };
    const up = () => {
      const d = drag.current;
      drag.current = null;
      guides.current = null;
      for (const off of offs.current.splice(0)) off();
      if (d && d.moved) histRef.current.endDrag(tsLive.get().widgets.map((x) => ({ ...x })));
      else histRef.current.endDrag(d ? d.pre : null);
    };
    offs.current.push(addListener('pointermove', move));
    offs.current.push(addListener('pointerup', up));
  };
  const g = guides.current;
  return (
    <View onClick={() => onSelect(null)} style={{ width: W, height: H, borderRadius: 10, overflow: 'hidden',
      backgroundColor: '#101014', alignSelf: 'center', cursor: 'default' }}>
      {g ? <View style={{ position: 'absolute', left: 0, right: 0, top: Math.round((g.y + g.h / 2) * k), height: 1, backgroundColor: 'rgba(120,180,255,0.6)' }} /> : null}
      {g ? <View style={{ position: 'absolute', top: 0, bottom: 0, left: Math.round((g.x + g.w / 2) * k), width: 1, backgroundColor: 'rgba(120,180,255,0.6)' }} /> : null}
      {byZ.map((w) => {
        if (w.hidden) return null;
        const st = rsResolveStyle(live.def?.style || {}, w.style || {});
        const paper = st.paper || '#222222';
        const ink = st.color || '#dddddd';
        const sel = w.id === selW;
        return (
          <View key={w.id} onMouseDown={(e) => start(e, w)} onClick={(e) => e.stopPropagation?.()} style={{
            position: 'absolute', left: Math.round(w.x * k), top: Math.round(w.y * k),
            width: Math.max(6, Math.round(w.w * k)), height: Math.max(4, Math.round(w.h * k)),
            borderRadius: Math.min(10, Math.max(2, Math.round((st.radius ?? 14) * k * 2))),
            backgroundColor: rsWithAlpha(paper, st.alpha ?? 0.7),
            border: sel ? '1.5px solid #7ab2ff' : (st.border && st.border !== 'none' ? '1px solid rgba(128,128,128,0.5)' : undefined),
            padding: Math.max(2, Math.round((st.pad ?? 16) * k * 1.5)), overflow: 'hidden', cursor: w.locked ? 'default' : 'move',
          }}>
            <View style={{ height: Math.max(2, Math.round(w.h * k * 0.16)), width: '62%', borderRadius: 99, backgroundColor: rsWithAlpha(ink, 0.5) }} />
          </View>
        );
      })}
      {!widgets.length ? <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', padding: 16, textAlign: 'center' }}>{L('canvasEmpty', 'The composition is empty — add widgets from the layers panel.')}</Text> : null}
      <Text style={{ position: 'absolute', left: 8, bottom: 6, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{L('canvasHint', 'Drag to arrange — the desktop follows live')}</Text>
    </View>
  );
}



function RichEditor({ w, onCfg, pal }) {
  const t = useTheme();
  const segs = tsRichSegments(w.cfg || {}, null) || [];
  const setSegs = (next) => onCfg({ rich: next, text: next.map((g) => g.t).join('') });
  const patch = (i, p) => {
    const next = segs.map((g, j) => (j === i ? { ...g, ...p } : g));
    setSegs(next);
  };
  const split = (i) => setSegs(tsRichSplit(segs, i, Math.floor((segs[i]?.t || '').length / 2)));
  const isRich = Array.isArray((w.cfg || {}).rich);
  return (
    <View style={{ gap: 8, padding: 10, borderRadius: 10, border: `1px solid ${t.separator}` }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: t.text, textAlign: 'start' }}>{L('richTitle', 'Styled segments')}</Text>
        <Button small
          label={isRich ? L('richOff', 'Plain text') : L('richOn', 'Style segments')}
          onClick={() => {
            if (isRich) onCfg({ rich: null, text: segs.map((g) => g.t).join('') });
            else setSegs([{ t: (w.cfg || {}).text || 'Text' }]);
          }} />
      </View>
      {isRich ? (
        <View style={{ gap: 6 }}>
          {segs.map((g, i) => (
            <View key={i} style={{ gap: 6, padding: 8, borderRadius: 8, backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <TextInput value={g.t} onChange={(v) => patch(i, { t: v })} style={{ flex: 1, minWidth: 0 }} />
                <Button small label="½" onClick={() => split(i)} />
                <Button small label="×" onClick={() => setSegs(segs.filter((_, j) => j !== i))} />
              </View>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <PopUp value={g.weight ?? ''} onChange={(v) => patch(i, { weight: v === '' ? null : v })} width={92}
                  options={[['', 'W'], ...[400, 500, 600, 700, 800].map((x) => [x, `${x}`])]} />
                <PopUp value={g.size ?? ''} onChange={(v) => patch(i, { size: v === '' ? null : v })} width={92}
                  options={[['', 'Size'], ...STEPS.slice(6).map((x) => [x, `${x}`])]} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 11, color: t.textDim }}>{L('italic', 'Italic')}</Text>
                  <Toggle on={!!g.italic} onChange={(v) => patch(i, { italic: v ? true : null })} />
                </View>
                {[null, ...(pal || []).slice(0, 3), '#f5f5f7', '#1d1d1f'].map((c, ci) => (
                  <View key={ci} onClick={() => patch(i, { color: c })} style={{ width: 16, height: 16, borderRadius: 8,
                    backgroundColor: c || 'transparent', border: `2px solid ${(g.color || null) === c ? t.accent : t.separator}`,
                    alignItems: 'center', justifyContent: 'center' }}>
                    {c === null ? <Text style={{ fontSize: 8, color: t.textDim }}>A</Text> : null}
                  </View>
                ))}
              </View>
            </View>
          ))}
          {segs.length < 12 ? <Button small label={L('richAdd', '+ Segment')} onClick={() => setSegs([...segs, { t: ' ' }])} /> : null}
        </View>
      ) : (
        <Text style={{ fontSize: 11, color: t.textDim, textAlign: 'start' }}>{L('richHint', 'Split the text into runs and style each one — font weight, size, italics and ink, segment by segment.')}</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------- the page

export function ThemesSettings() {
  const t = useTheme();
  const { t: tr } = useLocale();
  const [s] = useSettings();
  const live = useStore(tsLive);
  const [sel, setSel] = useState(null);            // the theme in the preview dialog
  const [selW, setSelW] = useState(null);          // the selected widget in the editor
  const [note, setNote] = useState(null);
  const [presetName, setPresetName] = useState('');
  const [presetOpen, setPresetOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [customizeFocus, setCustomizeFocus] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const hist = useRef(tsHistory);   // shared with the desktop customize bar
  const area = { x: 0, y: 28, w: screen.width, h: Math.max(200, screen.height - 28 - 80) };
  // the catalog only changes with the themeStudio record — not on every live-list edit
  const themes = useMemo(() => tsAllThemes(), [s.themeStudio]);
  const activeDef = live.def;
  const widgets = live.widgets || [];
  const selected = widgets.find((w) => w.id === selW) || null;

  const say = (msg) => setNote({ ok: !msg.err, text: msg.err ? msg.err : msg });
  const open = (id) => { setSel(id); };
  const apply = (id) => {
    try {
      hist.current.reset();
      setSelW(null);
      if (tsApplyTheme(id, area)) say(L('appliedNote', 'Applied — the desktop followed.'));
      else say({ err: L('missingTheme', 'That theme is gone.') });
    } catch (e) { say({ err: errorText(e) }); }
  };
  const stop = () => {
    try { tsDeactivate(area); hist.current.reset(); setSelW(null); say(L('stoppedNote', 'Back to the look you had before.')); }
    catch (e) { say({ err: errorText(e) }); }
  };
  // push-before: the history keeps the state as it was BEFORE the edit; the store helpers own
  // their tsMutate, so an action wraps one of them instead of double-running the mutation
  const act = (fn) => {
    if (!live.active) return;
    hist.current.push(tsLive.get().widgets);
    try { fn(); } catch (e) { say({ err: errorText(e) }); }
  };
  // continuous controls (the sliders): one undo step per burst, the live set still every frame
  const lastSoft = useRef(0);
  const actSoft = (fn) => {
    const now = Date.now();
    if (now - lastSoft.current > 800) { hist.current.push(tsLive.get().widgets); lastSoft.current = now; }
    try { fn(); } catch (e) { say({ err: errorText(e) }); }
  };
  const undo = () => { const prev = hist.current.undo(tsLive.get().widgets); if (prev) tsMutate(() => prev, area); };
  // a drag on the real desktop hands its pre-drag snapshot here: one undo step per drag
  const deskPre = useStore(tsDesktopUndo);
  useEffect(() => { if (deskPre) { hist.current.push(deskPre); tsDesktopUndo.set(null); } }, [deskPre]);

  // ---- backup / restore (Phase 2 §9F): a preset as one JSON file ----
  const exportPreset = (id) => {
    try {
      const def = themes.find((x) => x.id === id);
      if (!def) return;
      const saved = settings.get().themeStudio || {};
      const rec = saved.customs && saved.customs[id];
      if (!rec) return;
      const payload = { insane: 'theme', version: 1, name: rec.name, base: rec.base, widgets: rec.widgets, appearance: rec.appearance || {} };
      const safe = rec.name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'theme';
      const path = `${fs.home()}/Desktop/${safe}.insanetheme.json`;
      fs.write(path, JSON.stringify(payload, null, 1));
      say(L('exportedNote', 'Exported to the Desktop.'));
    } catch (e) { say({ err: errorText(e) }); }
  };
  const importTheme = (path) => {
    try {
      const txt = fs.read(path);
      if (!txt) { say({ err: L('importBad', 'That file could not be read.') }); return; }
      const j = JSON.parse(txt);
      if (j.insane !== 'theme' || typeof j.name !== 'string' || !Array.isArray(j.widgets)) {
        say({ err: L('importBad', 'That file is not an exported Insane OS theme.') });
        return;
      }
      const id = tsSaveCustom(String(j.name).slice(0, 60) || 'Imported');
      const saved = settings.get().themeStudio || {};
      const rec = saved.customs && saved.customs[id];
      if (!rec) { say({ err: L('importBad', 'The preset could not be written.') }); return; }
      // the same validation the store applies to its own lists: one tsSetInstance-style write
      const rec2 = { ...rec, base: typeof j.base === 'string' ? j.base : rec.base, appearance: j.appearance && typeof j.appearance === 'object' ? j.appearance : rec.appearance };
      settings.set({ themeStudio: { ...saved, customs: { ...saved.customs, [id]: { ...rec2, widgets: j.widgets } } } });
      tsPersistFlush();
      say(L('importedNote', 'Imported — it is in the gallery now.'));
    } catch (e) { say({ err: errorText(e) }); }
  };
  const tsMutateList = (fn) => act(() => tsMutate(fn, area));
  const redo = () => { const next = hist.current.redo(tsLive.get().widgets); if (next) tsMutate(() => next, area); };
  const canUndo = hist.current.canUndo;
  const canRedo = hist.current.canRedo;

  const cur = () => (tsLive.get().widgets || []).find((x) => x.id === selW) || {};
  const onStyle = (patch) => actSoft(() => tsSetInstance(selW, { style: { ...(cur().style || {}), ...patch } }));
  const onCfg = (patch) => act(() => tsSetInstance(selW, { cfg: { ...(cur().cfg || {}), ...patch } }));
  const onGeom = (nx, ny, nw, nh) => {
    if (nx != null || ny != null) act(() => tsMove(selW, nx ?? cur().x, ny ?? cur().y, area));
    if (nw != null || nh != null) act(() => tsResize(selW, nw ?? cur().w, nh ?? cur().h, area));
  };

  const byZ = [...widgets].sort((a, b) => a.z - b.z);
  const selTheme = sel ? themes.find((x) => x.id === sel) : null;
  const pal = activeDef ? (activeDef.colors || []) : [];

  return (
    <Stack>
      <Message msg={note} />
      <Section
        title={L('gallery', 'Themes')}
        footer={L('galleryHint', 'Each theme is a whole desktop: a wallpaper, a palette, its widgets and their typography. Applying follows the live desktop and survives a reboot; the originals never change.')}
        accessory={activeDef ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Button small label="↶" onClick={undo} disabled={!canUndo} />
            <Button small label="↷" onClick={redo} disabled={!canRedo} />
            <Button small label={L('resetLayout', 'Reset layout')} onClick={() => act(() => tsResetTheme(area))} />
            <Button small label={L('arrangeDesktop', 'Arrange on the desktop')} onClick={() => {
              const first = (tsLive.get().widgets || [])[0];
              tsSelected.set(first ? first.id : null);
              try { wm.minimize?.(useAppWindow().id); } catch (e) { /* wm older */ }
              tsEnterArrange();
            }} />
            <Button small label={L('stopUsing', 'Use no theme')} onClick={stop} />
          </View>
        ) : null}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, width: '100%' }}>
          {themes.map((th) => (
            <ThemeCard key={th.id} theme={th} active={live.active === th.id}
              onSet={() => apply(th.id)}
              onPreview={() => open(th.id)}
              onCustomize={() => {
                if (live.active !== th.id) apply(th.id);
                // straight to the desktop (the user's ask): the bar rides there, the first card
                // comes up picked, the Settings window steps aside
                const first = (tsLive.get().widgets || [])[0];
                tsSelected.set(first ? first.id : null);
                setSelW(first ? first.id : null);
                try { wm.minimize?.(useAppWindow().id); } catch (e) { /* wm older */ }
                tsEnterArrange();
              }} />
          ))}
        </View>
      </Section>

      {activeDef ? (
        <Section title={L('livePreview', 'Live preview')}
          footer={L('livePreviewHint', 'Click a block to select it; drag it and the real desktop follows. The centre lines are the alignment guides.')}>
          <StudioCanvas widgets={live.widgets} area={area} selW={selW} onSelect={setSelW} histRef={hist} />
        </Section>
      ) : null}

      {activeDef ? (
        <Columns>
          <Section title={customizeFocus % 2 ? L('layers', 'Layers — the widgets of this theme') : L('layers', 'Layers — the widgets of this theme')}
            footer={L('layersHint', 'Top of the list is frontmost. The eye hides a widget without removing it; ⧉ duplicates; × removes. Click a row to edit its look below.')}
            accessory={<Button small label={L('addWidget', 'Add a widget…')} onClick={() => setAddOpen(true)} />}>
            {byZ.length ? [...byZ].reverse().map((w, i) => (
              <LayerRow key={w.id} w={w} index={byZ.length - 1 - i} n={byZ.length} selected={selW === w.id}
                onSelect={setSelW}
                onEye={() => act(() => tsSetInstance(w.id, { hidden: !w.hidden }))}
                onUp={() => act(() => tsZ(w.id, 'forward', area))}
                onDown={() => act(() => tsZ(w.id, 'backward', area))}
                onDup={() => act(() => tsDuplicate(w.id, area))}
                onRemove={() => { act(() => tsRemove(w.id, area)); if (selW === w.id) setSelW(null); }} />
            )) : <Text style={{ fontSize: 12, color: t.textDim }}>{L('noWidgets', 'This theme carries no widgets on the desktop.')}</Text>}
          </Section>

          <Section title={L('customize', 'Customize')}>
            {selected ? (
              <WidgetEditor w={{ ...selected, _palette: pal }} area={area}
                onStyle={onStyle} onCfg={onCfg} onGeom={onGeom}
                onLock={(on) => act(() => tsSetInstance(selected.id, { locked: on }))}
                onAlign={(edge) => tsMutateList((l) => tsAlignW(l, selected.id, edge, area))}
                onDistributeX={() => tsMutateList((l) => tsDistributeW(l, 'x', area))}
                onDistributeY={() => tsMutateList((l) => tsDistributeW(l, 'y', area))}
                onReset={() => act(() => tsResetInstance(selected.id, area))} />
            ) : (
              <Text style={{ fontSize: 12, color: t.textDim, paddingVertical: 8 }}>{L('pickWidget', 'Pick a widget from the layers to edit its type, size, colours and surface.')}</Text>
            )}
            <Actions style={{ marginTop: 10 }}>
              <Button small label={L('duplicate', 'Duplicate selected')} onClick={() => selected && act(() => tsDuplicate(selected.id, area))} disabled={!selected} />
            </Actions>
          </Section>
        </Columns>
      ) : (
        <Section title={L('customizeNone', 'Nothing applied')}>
          <Text style={{ fontSize: 12, color: t.textDim }}>{L('customizeNoneHint', 'The desktop keeps its current look. Apply a theme to start customizing it.')}</Text>
        </Section>
      )}

      {activeDef ? (
        <Section title={L('presets', 'Your themes')}
          footer={L('presetsHint', 'A preset keeps the theme exactly as you customized it — the built-ins stay untouched. Export writes the preset as a file you can carry; importing checks it before it lands.')}>
          <SettingRow label={L('saveAs', 'Save this look as a preset')} hint={activeDef.custom ? L('saveAsHintCustom', 'You are already on a preset — apply a built-in first to branch from it.') : undefined}>
            <Button small label={L('save', 'Save…')} disabled={activeDef.custom} onClick={() => { setPresetName(`${activeDef.name} ·`); setPresetOpen(true); }} />
          </SettingRow>
          {themes.filter((x) => x.custom).map((c) => (
            <SettingRow key={c.id} label={c.name} hint={c.desc}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Button small label={L('applyTheme', 'Apply')} onClick={() => apply(c.id)} />
                <Button small label={L('rename', 'Rename')} onClick={() => { setPresetName(c.name); setPresetOpen(c.id); }} />
                <Button small label={L('export', 'Export')} onClick={() => exportPreset(c.id)} />
                <Button small label="×" onClick={() => { try { tsDeleteCustom(c.id); } catch (e) { say({ err: errorText(e) }); } }} />
              </View>
            </SettingRow>
          ))}
          <SettingRow label={L('importTheme', 'Import a theme file')} hint={L('importHint', 'A .json exported here earlier. It is validated before it lands — a broken file is refused, not applied.')}>
            <Button small label={L('import', 'Import…')} onClick={() => setImportOpen(true)} />
          </SettingRow>
        </Section>
      ) : null}
      {importOpen ? (
        <FilePicker modal title={L('importTitle', 'Choose a theme file')} filter={/\.json$/i}
          onPick={(f) => { importTheme(typeof f === 'string' ? f : f.path); setImportOpen(false); }}
          onClose={() => setImportOpen(false)} />
      ) : null}

      {presetOpen ? (
        <Layer name="modal">
          <View style={{ position: 'absolute', left: 0, top: 0, width: screen.width, height: screen.height,
            justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}
            onClick={() => setPresetOpen(false)}>
            <View onClick={(e) => e.stopPropagation?.()} style={{ width: 360, borderRadius: 14, backgroundColor: t.windowBg,
              border: `1px solid ${t.separator}`, padding: 16, gap: 10 }}>
              <Text style={{ fontSize: 14, fontWeight: 600, color: t.text, textAlign: 'start' }}>
                {typeof presetOpen === 'string' ? L('renameTitle', 'Rename the preset') : L('saveTitle', 'Save as a preset')}</Text>
              <TextInput value={presetName} onChange={setPresetName} autoFocus />
              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                <Button label={tOptional('settings.wallpaper.cancel') || 'Cancel'} onClick={() => setPresetOpen(false)} />
                <Button primary label={typeof presetOpen === 'string' ? L('renameSave', 'Rename') : L('save', 'Save')}
                  onClick={() => {
                    try {
                      if (typeof presetOpen === 'string') {
                        if (!tsRenameCustom(presetOpen, presetName)) { say({ err: L('renameBlank', 'Give the preset a name first.') }); return; }
                      } else {
                        const id = tsSaveCustom(presetName || activeDef.name);
                        if (id) say(L('savedNote', 'Saved — it is in the gallery now.'));
                      }
                      setPresetOpen(false);
                    } catch (e) { say({ err: errorText(e) }); }
                  }} />
              </View>
            </View>
          </View>
        </Layer>
      ) : null}

      {addOpen ? (
        <AddDialog onAdd={(kind) => act(() => tsAdd(kind, area))} onClose={() => setAddOpen(false)} />
      ) : null}
      {selTheme ? (
        <PreviewDialog theme={selTheme} active={live.active === selTheme.id}
          onApply={() => { apply(selTheme.id); }}
          onDeactivate={() => { stop(); }}
          onClose={() => setSel(null)} />
      ) : null}
    </Stack>
  );
}
