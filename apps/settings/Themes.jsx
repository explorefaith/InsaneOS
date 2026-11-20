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
  tsRemove, tsDuplicate, tsResize, tsMove, tsZ, tsSetInstance, tsResetInstance, tsResetTheme, setLoginStill,
  tsSaveCustom, tsRenameCustom, tsDeleteCustom, tsCreateHistory, tsResolvePlan, tsAddVariant, TS_KINDS, TS_FONTS,
  tsPersistFlush, tsSelected, tsEnterArrange,
  tsAlignW, tsDistributeW, addListener, resolveStyle as rsResolveStyle, withAlpha as rsWithAlpha, Slider as SliderX,
  tsRichSegments, tsRichSplit, fs, FilePicker, saveSettingsNow, insaneosWallpapers as allWallpapers, wallpaperThumb as wThumb,
  TS_WIDGET_SPECS, TS_CATS, TS_ROUTES, variantEntries, specsOfCat, SearchField,
  resolveStyle, withAlpha, insaneosWallpapers, wallpaperThumb, Layer, wm, useAppWindow, errorText,
} from '@insaneos/sdk';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Section, SettingRow, Note, Actions, Stack, Columns, PopUp, Message } from './ui.jsx';

const L = (k, fb) => tOptional(`settings.themes.${k}`) || fb;
// The kind's name in the interface language (the spec's English as the fallback).
const kindLabel = (id) => tOptional(`settings.kind.${id}`) || (TS_KINDS[id] || {}).label || id;
// a widget with a style route shows it: 'Digital clock · Glass'
const widgetLabel = (w) => {
  const base = kindLabel(w.kind);
  const r = (w.cfg || {}).variantRoute;
  return r ? `${base} · ${r.charAt(0).toUpperCase() + r.slice(1)}` : base;
};

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

function LayerRow({ w, selected, onSelect, onEye, onRemove }) {
  const t = useTheme();
  const label = widgetLabel(w);
  return (
    <View onClick={() => onSelect(w.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36,
      paddingHorizontal: 8, borderRadius: 8, cursor: 'pointer',
      backgroundColor: selected ? t.accentSubtle : 'transparent' }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: w.hidden ? 'transparent' : t.accent, border: `2px solid ${w.hidden ? t.separator : t.accent}` }} />
      <Text style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: selected ? 600 : 400, color: w.hidden ? t.textDim : t.text, textAlign: 'start' }}
       >{label}</Text>
      <Text onClick={(e) => { e.stopPropagation?.(); onEye(); }} style={{ fontSize: 13, color: w.hidden ? t.separator : t.textDim, padding: '2px 5px' }}
       >{w.hidden ? '○' : '●'}</Text>
      <Text onClick={(e) => { e.stopPropagation?.(); onRemove(); }} style={{ fontSize: 13, color: t.textDim, padding: '2px 5px' }}>×</Text>
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

export function WidgetEditor({ w, onStyle, onGeom, onCfg, onReset, onLock, onAlignXY, onSpace, onZ, onDup, onRemove, area }) {
  const t = useTheme();
  const st = w.style || {};
  const [adv, setAdv] = useState(false);
  const set = (patch) => onStyle(patch);
  const nudge = (dx, dy) => onGeom(w.x + dx, w.y + dy);
  const scale = (f) => onGeom(null, null, Math.round((w.w * f) / 4) * 4, Math.round((w.h * f) / 4) * 4);
  const textSize = (px) => set({ size: px === null ? null : px });
  const sizeChips = [['tsSmall', 'Small', 13], ['tsMedium', 'Medium', 18], ['tsLarge', 'Large', 24], ['tsHuge', 'Huge', 34]];
  const G = ({ title, children }) => (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 11, fontWeight: 700, color: t.textDim, letterSpacing: 1 }}>{title}</Text>
      {children}
    </View>
  );
  const Swatches = ({ colors, value, onPick, clearLabel }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
      {[null, ...colors].map((c, i) => (
        <View key={i} onClick={() => onPick(c)} style={{ width: 24, height: 24, borderRadius: 12,
          backgroundColor: c || 'transparent', border: `2px solid ${(value || null) === c ? t.accent : t.separator}`,
          alignItems: 'center', justifyContent: 'center' }}>
          {c === null ? <Text style={{ fontSize: 9, color: t.textDim }}>{clearLabel}</Text> : null}
        </View>
      ))}
    </View>
  );
  const isTexty = w.kind === 'clock-digital' || w.kind === 'headline' || w.kind === 'label';
  return (
    <View style={{ gap: 14, padding: 12, borderRadius: 12, border: `1px solid ${t.separator}`, backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Text style={{ flex: 1, minWidth: 130, fontSize: 14, fontWeight: 700, color: t.text, textAlign: 'start' }}>
          {widgetLabel(w)}</Text>
        <Button small label={L('sizeBigger', 'Bigger')} onClick={() => scale(1.25)} />
        <Button small label={L('sizeSmaller', 'Smaller')} onClick={() => scale(0.8)} />
        <Button small label={w.hidden ? L('show', 'Show') : L('hide', 'Hide')} onClick={() => onStyle({ hidden: !w.hidden })} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Button small label={L('copyWidget', 'Make a copy')} onClick={onDup} />
        <Button small label={L('removeWidget', 'Remove')} onClick={onRemove} />
        <Button small label={w.locked ? L('unlock', 'Unlock') : L('lock', 'Lock')} onClick={() => onLock(!w.locked)} />
        <Button small label={L('resetWidget', 'Reset')} onClick={onReset} />
      </View>

      {w.kind === 'clock-digital' || w.kind === 'clock-analog' ? (
        <G title={L('clock', 'Clock')}>
          <SettingRow label={L('h24', 'Show 24-hour time')}><Toggle small on={w.kind === 'clock-digital' && (w.cfg || {}).h24 !== false} onChange={(v) => onCfg({ h24: !!v })} /></SettingRow>
          <SettingRow label={L('seconds', 'Show seconds')}><Toggle small on={!!(w.cfg || {}).seconds} onChange={(v) => onCfg({ seconds: !!v })} /></SettingRow>
        </G>
      ) : null}
      {w.kind === 'notes' || w.kind === 'quote' || w.kind === 'headline' || w.kind === 'label' ? (
        <G title={L('yourText', 'Your text')}>
          <TextInput value={(w.cfg || {}).text || ''} onChange={(v) => onCfg({ text: v })} style={{ width: 240 }} />
          {adv ? <RichEditor w={w} onCfg={onCfg} pal={w._palette || []} /> : null}
        </G>
      ) : null}
      {w.kind === 'crypto-price' || w.kind === 'crypto-ticker' ? (
        <G title={L('market', 'Market')}>
          <SettingRow label={L('pair', 'Coin pair')}>
            <PopUp value={(w.cfg || {}).pair || 'BTCUSDT'} onChange={(v) => onCfg({ pair: v })} width={170}
              options={CRYPTO_PAIRS.map((x) => [x, x.slice(0, -4) + ' / ' + x.slice(-4)])} />
          </SettingRow>
        </G>
      ) : null}
      {w.kind === 'media' ? (
        <G title={L('whenIdle', 'When nothing is playing')}>
          <PopUp value={(w.cfg || {}).idle || 'idle'} onChange={(v) => onCfg({ idle: v })} width={200}
            options={[['idle', L('idleCard', 'Show a quiet card')], ['hide', L('idleHide', 'Hide the widget')]]} />
        </G>
      ) : null}

      <G title={L('placeTitle', 'Place it')}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <View>
            {['top', 'center-y', 'bottom'].map((ye) => (
              <View key={ye} style={{ flexDirection: 'row', gap: 4, marginBottom: 4 }}>
                {['left', 'center-x', 'right'].map((xe) => (
                  <View key={xe + ye} onClick={() => onAlignXY(xe, ye)} style={{ width: 30, height: 26, borderRadius: 7, cursor: 'pointer',
                    justifyContent: 'center', alignItems: 'center', backgroundColor: t.control }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.textDim }} />
                  </View>
                ))}
              </View>
            ))}
          </View>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <Button small label="←" onClick={() => nudge(-8, 0)} />
              <Button small label="→" onClick={() => nudge(8, 0)} />
              <Button small label="↑" onClick={() => nudge(0, -8)} />
              <Button small label="↓" onClick={() => nudge(0, 8)} />
            </View>
            <Button small label={L('spaceEvenly', 'Space all widgets evenly')} onClick={onSpace} />
          </View>
        </View>
        <Text style={{ fontSize: 11, color: t.textDim, textAlign: 'start' }}>{L('placeHint', 'Tap a spot to snap the widget there; the arrows nudge it gently.')}</Text>
      </G>

      <G title={L('styleTitle', 'Style it')}>
        {isTexty || w.kind === 'notes' || w.kind === 'quote' || w.kind === 'agenda' ? (
          <SettingRow label={L('textSize', 'Text size')} stack>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Button small label={L('tsTheme', 'Theme default')} onClick={() => textSize(null)} />
              {sizeChips.map(([k, label, px]) => (
                <Button key={k} small label={L(k, label)} onClick={() => textSize(px)} />
              ))}
            </View>
          </SettingRow>
        ) : null}
        <SettingRow label={L('color', 'Text colour')} stack>
          <Swatches colors={w._palette || ['#1d1d1f', '#f5f5f7']} value={st.color} onPick={(c) => set({ color: c })} clearLabel="A" />
        </SettingRow>
        <SettingRow label={L('cardColor', 'Card colour')} stack>
          <Swatches colors={['#f4f1e7', '#1d1d1f', '#2b48d9', '#c8f14c', '#d24a3a']} value={st.paper} onPick={(c) => set({ paper: c })} clearLabel="T" />
        </SettingRow>
        <SettingRow label={L('seeThrough', 'See-through')} stack hint={L('seeThroughHint', 'Slide left for a solid card, right for a see-through one.')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1, maxWidth: 220 }}>
              <Slider value={st.alpha ?? 0.7} min={0.16} max={1} step={0.02} onChange={(v) => set({ alpha: v })} />
            </View>
            <Text style={{ fontSize: 11, color: t.textDim, width: 34 }}>{`${Math.round((st.alpha ?? 0.7) * 100)}%`}</Text>
          </View>
        </SettingRow>
        <SettingRow label={L('roundness', 'Corner roundness')} stack>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1, maxWidth: 220 }}>
              <Slider value={st.radius ?? 16} min={0} max={28} step={1} onChange={(v) => set({ radius: Math.round(v) })} />
            </View>
            <Text style={{ fontSize: 11, color: t.textDim, width: 34 }}>{`${Math.round(st.radius ?? 16)}`}</Text>
          </View>
        </SettingRow>
        <SettingRow label={L('shadow', 'Shadow')}>
          <PopUp value={st.shadow || 'soft'} onChange={(v) => set({ shadow: v === 'soft' ? null : v })} width={150}
            options={[['soft', L('shadowSoft', 'Soft shadow')], ['lift', L('shadowLift', 'Lifted')], ['none', L('shadowNone', 'No shadow')]]} />
        </SettingRow>
        {isTexty ? (
          <SettingRow label={L('italic', 'Slanted text')}>
            <Toggle small on={!!st.italic} onChange={(v) => set({ italic: v ? true : null })} />
          </SettingRow>
        ) : null}
      </G>

      <View onClick={() => setAdv(!adv)} style={{ cursor: 'pointer', paddingVertical: 6 }}>
        <Text style={{ fontSize: 12, fontWeight: 600, color: t.accent, textAlign: 'start' }}>
          {adv ? L('hideAdvanced', '− Hide advanced options') : L('showAdvanced', '+ Show advanced options')}</Text>
      </View>
      {adv ? (
        <G title={L('advanced', 'Advanced')}>
          <StyleControl label={L('typeface', 'Typeface')}>
            <PopUp value={st.font || ''} onChange={(v) => set({ font: v || null })} width={190}
              options={[['', L('themeFont', 'Theme default')], ...TS_FONTS.map((f) => [f.id, f.name])]} />
          </StyleControl>
          {isTexty ? (
            <StyleControl label={L('weight', 'Thickness')}>
              <PopUp value={st.weight ?? ''} onChange={(v) => set({ weight: v === '' ? null : v })} width={150}
                options={[['', L('themeWeight', 'Theme default')], [400, L('weightNormal', 'Normal')], [500, L('weightMedium', 'Medium')], [700, L('weightBold', 'Bold')]]} />
            </StyleControl>
          ) : null}
          <StyleControl label={L('color', 'Text colour')}>
            <TextInput value={st.color || ''} onChange={(v) => set({ color: v ? v : null })} placeholder="#hex" style={{ width: 110 }} />
          </StyleControl>
          <StyleControl label={L('cardColor', 'Card colour')}>
            <TextInput value={st.paper || ''} onChange={(v) => set({ paper: v || null })} placeholder="#hex" style={{ width: 110 }} />
          </StyleControl>
          <StyleControl label={L('blur', 'Frosted glass')}>
            <View style={{ flex: 1, maxWidth: 220 }}>
              <Slider value={st.blur ?? 0.4} min={0} max={1} step={0.05} onChange={(v) => set({ blur: v || null })} />
            </View>
            <Text style={{ fontSize: 11, color: t.textDim, width: 34 }}>{`${Math.round((st.blur ?? 0.4) * 100)}%`}</Text>
          </StyleControl>
          <StyleControl label={L('textAlign', 'Text align')}>
            <PopUp value={st.align || 'left'} onChange={(v) => set({ align: v === 'left' ? null : v })} width={130}
              options={[['left', L('alignLeft', 'Left')], ['center', L('alignCentre', 'Centre')], ['right', L('alignRight', 'Right')]]} />
          </StyleControl>
          <StyleControl label={L('order', 'In front of / behind')}>
            <Button small label={L('forward', 'Bring forward')} onClick={() => onZ('forward')} />
            <Button small label={L('backward', 'Send back')} onClick={() => onZ('backward')} />
          </StyleControl>
        </G>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- the add-widget dialog

// 105 kinds: a flat list is unusable. Category chips + a search field; the grid shows names only
// (never raw pixel sizes). Adding places the widget at a free spot of the real work area.
const ROUTE_NAMES = { classic: 'Classic', glass: 'See-through', solid: 'Filled', outline: 'Border only', vivid: 'Colourful' };
const CRYPTO_PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'];

export function AddDialog({ onAdd, onClose }) {
  const t = useTheme();
  const [cat, setCat] = useState('time');
  const [route, setRoute] = useState(null);            // null: all routes
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const all = variantEntries();                        // 525: kind × style route, real data underneath
  const list = (ql ? all.filter((sp) => sp.label.toLowerCase().includes(ql))
    : all.filter((sp) => sp.cat === cat && (!route || sp.route === route)));
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
          {!ql ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {[null, ...TS_ROUTES].map((r) => {
                const name = r ? (ROUTE_NAMES[r.id] || r.label) : L('styleAll', 'All styles');
                const on = route === (r ? r.id : null) || (route === null && !r);
                return (
                  <View key={r ? r.id : 'all'} onClick={() => setRoute(r ? r.id : null)} style={{ paddingHorizontal: 10, height: 22,
                    borderRadius: 11, justifyContent: 'center', cursor: 'pointer',
                    backgroundColor: on ? t.accentSubtle : 'transparent',
                    border: `1px solid ${on ? t.accent : t.separator}` }}>
                    <Text style={{ fontSize: 11, color: on ? t.accent : t.textDim }}>{name}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
          <ScrollView style={{ height: 280 }} resetKey={`${cat}:${q}`}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 }}>
              {list.map((sp) => (
                <View key={sp.id} onClick={() => { onAdd(sp); onClose(); }} style={{ width: 168, paddingHorizontal: 10, height: 30,
                  borderRadius: 8, justifyContent: 'center', backgroundColor: t.control, cursor: 'pointer' }}>
                  <Text style={{ fontSize: 12, color: t.text, whiteSpace: 'nowrap', textOverflow: 'ellipsis', numberOfLines: 1 }}>{sp.label}</Text>
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
export function StudioCanvas({ widgets, area, selW, onSelect, histRef }) {
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


// ---------------------------------------------------------------- the theme look (Phase 2 ask)

// The theme's own background and glass: the wallpaper grid (the shipped collection + the user's),
// the solid/gradient background colour, and the three glass sliders — the same settings keys the
// rest of the desktop honours, so the change is live and the preset snapshot keeps it.
function ThemeLookSection({ s, set, onFlash }) {
  const t = useTheme();
  const glass = s.effects !== false;
  const pics = allWallpapers.slice(0, 12);
  return (
    <Section title={L('look', 'Theme look — background, blur, transparency')}
      footer={L('lookHint', 'The wallpaper and the glass sliders drive the whole desktop live. Saving the look as a preset keeps them with it.')}>
      <Text style={{ fontSize: 11, fontWeight: 700, color: t.textDim, letterSpacing: 1, marginBottom: 6 }}>{L('lookBg', 'BACKGROUND')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {pics.map((w) => (
          <View key={w.id} onClick={() => set({ wallpaper: w.id, wallpaperBg: null })}
            style={{ width: 118, height: 66, borderRadius: 8, overflow: 'hidden',
              border: `2px solid ${s.wallpaper === w.id && !s.wallpaperBg ? t.accent : t.separator}`, cursor: 'pointer' }}>
            <Image src={wThumb(w)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 11, color: t.textDim, width: 92 }}>{L('lookTint', 'Solid tint')}</Text>
        {['#141418', '#1e2a38', '#2a2140', '#f2efe6', '#e8e3d8', null].map((c, i) => (
          <View key={i} onClick={() => set({ wallpaperBg: c ? { kind: 'solid', a: c } : null })}
            style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c || 'transparent',
              border: `2px solid ${JSON.stringify(s.wallpaperBg || {}) === JSON.stringify(c ? { kind: 'solid', a: c } : {}) ? t.accent : t.separator}`,
              alignItems: 'center', justifyContent: 'center' }}>
            {c === null ? <Text style={{ fontSize: 9, color: t.textDim }}>Off</Text> : null}
          </View>
        ))}
      </View>
      <Text style={{ fontSize: 11, fontWeight: 700, color: t.textDim, letterSpacing: 1, marginTop: 12, marginBottom: 6 }}>{L('lookGlass', 'GLASS')}</Text>
      <SettingRow label={L('lookPresets', 'Quick looks')} stack hint={L('lookPresetsHint', 'One tap picks a whole feel: Frosted is soft and dreamy, Clear is almost invisible, Balanced sits between.')}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {[['lookFrosted', 'Frosted', 32, 0.25, 1.25], ['lookBalanced', 'Balanced', 24, 0.3, 1.2], ['lookClear', 'Clear', 8, 0.55, 1.1]].map(([k, label, b, tr_, sat]) => (
            <Button key={k} small label={L(k, label)} onClick={() => set({ glassBlur: b, glassTransparency: tr_, glassSaturate: sat })} />
          ))}
        </View>
      </SettingRow>
      <SettingRow label={L('lookBlur', 'Blur behind windows')} stack>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 11, color: t.textDim }}>0</Text>
          <Slider value={Number.isFinite(s.glassBlur) ? s.glassBlur : 24} min={0} max={64} width={200}
            onChange={(v) => set({ glassBlur: Math.round(v) })} />
          <Text style={{ fontSize: 11, color: t.textDim, width: 40 }}>{`${Number.isFinite(s.glassBlur) ? Math.round(s.glassBlur) : 24} px`}</Text>
        </View>
      </SettingRow>
      <SettingRow label={L('lookTransparency', 'See-through')} stack>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 11, color: t.textDim }}>{L('lookSolid', 'Solid')}</Text>
          <Slider value={Number.isFinite(s.glassTransparency) ? s.glassTransparency : 0.3} min={0} max={1} width={200}
            onChange={(v) => set({ glassTransparency: Math.round(v * 100) / 100 })} />
          <Text style={{ fontSize: 11, color: t.textDim, width: 40 }}>{`${Math.round((Number.isFinite(s.glassTransparency) ? s.glassTransparency : 0.3) * 100)}%`}</Text>
        </View>
      </SettingRow>
      <SettingRow label={L('lookSaturate', 'Colour pop')} stack>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 11, color: t.textDim }}>1×</Text>
          <Slider value={Number.isFinite(s.glassSaturate) ? s.glassSaturate : 1.2} min={1} max={2} width={200}
            onChange={(v) => set({ glassSaturate: Math.round(v * 100) / 100 })} />
          <Text style={{ fontSize: 11, color: t.textDim, width: 40 }}>{`${Math.round((Number.isFinite(s.glassSaturate) ? s.glassSaturate : 1.2) * 100)}%`}</Text>
        </View>
      </SettingRow>
    </Section>
  );
}

// ---------------------------------------------------------------- the page

// ---------------------------------------------------------------- the theme store
// The video's Plugins page, honest version: everything here is generated on this machine from the
// built-ins (a wallpaper swap, an accent remix) — no network, nothing to download, install is one
// click and lands in the gallery as the person's own preset.
const STORE_WALLPAPERS = ['crystal-apple', 'lumo-aurora', 'violet-horizon', 'event-horizon', 'anime-3', 'wallpaper-3'];
const STORE_PACKS = [
  { id: 'wallpapers', name: 'Fresh wallpapers', desc: 'The themes you know, each on a new picture from the collection.' },
  { id: 'accents', name: 'Accent remix', desc: 'The themes you know, wearing a different colour.' },
];
const storeItems = () => {
  const defs = (tsAllThemes() || []).filter((x) => !x.custom);
  const pick = (ids) => ids.map((id) => defs.find((d) => d.id === id)).filter(Boolean);
  const wall = pick(['bouquet-atelier', 'zen-paper', 'slate-grid', 'dawn-meridian', 'iris-night', 'crimson-ninja']);
  const acc = pick(['zen-paper', 'slate-grid', 'bouquet-atelier', 'violet-ninja', 'dawn-meridian', 'meadow-study']);
  const accents = ['#30d158', '#0a84ff', '#bf5af2', '#ff2e88', '#ff9f0a', '#30b0c7'];
  return [
    ...wall.map((d, i) => ({ key: `wall-${d.id}`, pack: 'wallpapers', name: `${d.name} · ${STORE_WALLPAPERS[i % STORE_WALLPAPERS.length].split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')}`,
      desc: 'Same widgets, same typography — a new picture.', base: d.id,
      appearance: { wallpaper: STORE_WALLPAPERS[i % STORE_WALLPAPERS.length], wallpaperBg: null }, def: d })),
    ...acc.map((d, i) => ({ key: `acc-${d.id}`, pack: 'accents', name: `${d.name} · ${accents[i]}`, desc: 'Same everything — a new accent colour.',
      base: d.id, appearance: { accent: accents[i] }, def: d })),
  ];
};

export function ThemesSettings() {
  const t = useTheme();
  const { t: tr } = useLocale();
  const [s, setS] = useSettings();
  const live = useStore(tsLive);
  const [sel, setSel] = useState(null);            // the theme in the preview dialog
  const [selW, setSelW] = useState(null);          // the selected widget in the editor
  const [view, setView] = useState('gallery');     // 'gallery': the cards | 'customize': the workshop
  const [note, setNote] = useState(null);
  const [presetName, setPresetName] = useState('');
  const [presetOpen, setPresetOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const hist = useRef(tsHistory);                  // shared with the desktop customize bar
  const area = { x: 0, y: 28, w: screen.width, h: Math.max(200, screen.height - 28 - 80) };
  const themes = useMemo(() => tsAllThemes(), [s.themeStudio]);
  const activeDef = live.def;
  const widgets = live.widgets || [];
  const selected = widgets.find((w) => w.id === selW) || null;

  const say = (msg) => setNote({ ok: !msg.err, text: msg.err ? msg.err : msg });
  const open = (id) => setSel(id);
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
  const act = (fn) => {
    if (!live.active) return;
    hist.current.push(tsLive.get().widgets);
    try { fn(); } catch (e) { say({ err: errorText(e) }); }
  };
  const actSoft = (fn) => {
    const now = Date.now();
    if (now - lastSoft.current > 800) { hist.current.push(tsLive.get().widgets); lastSoft.current = now; }
    try { fn(); } catch (e) { say({ err: errorText(e) }); }
  };
  const lastSoft = useRef(0);
  const undo = () => { const prev = hist.current.undo(tsLive.get().widgets); if (prev) tsMutate(() => prev, area); };
  const redo = () => { const next = hist.current.redo(tsLive.get().widgets); if (next) tsMutate(() => next, area); };
  const canUndo = hist.current.canUndo;
  const canRedo = hist.current.canRedo;
  const tsMutateList = (fn) => act(() => tsMutate(fn, area));

  const cur = () => (tsLive.get().widgets || []).find((x) => x.id === selW) || {};
  const onStyle = (patch) => actSoft(() => tsSetInstance(selW, { style: { ...(cur().style || {}), ...patch } }));
  const onCfg = (patch) => act(() => tsSetInstance(selW, { cfg: { ...(cur().cfg || {}), ...patch } }));
  const onGeom = (nx, ny, nw, nh) => {
    if (nx != null || ny != null) act(() => tsMove(selW, nx ?? cur().x, ny ?? cur().y, area));
    if (nw != null || nh != null) act(() => tsResize(selW, nw ?? cur().w, nh ?? cur().h, area));
  };

  const exportPreset = (id) => {
    try {
      const def = themes.find((x) => x.id === id);
      if (!def) return;
      const saved = settings.get().themeStudio || {};
      const rec = saved.customs && saved.customs[id];
      if (!rec) return;
      const payload = { insane: 'theme', version: 1, name: rec.name, base: rec.base, widgets: rec.widgets, appearance: rec.appearance || {} };
      const safe = rec.name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'theme';
      fs.write(`${fs.home()}/Desktop/${safe}.insanetheme.json`, JSON.stringify(payload, null, 1));
      say(L('exportedNote', 'Exported to the Desktop.'));
    } catch (e) { say({ err: errorText(e) }); }
  };
  const importTheme = (path) => {
    try {
      const txt = fs.read(path);
      if (!txt) { say({ err: L('importBad', 'That file could not be read.') }); return; }
      const j = JSON.parse(txt);
      if (j.insane !== 'theme' || typeof j.name !== 'string' || !Array.isArray(j.widgets)) {
        say({ err: L('importBad', 'That file is not an exported Insane OS theme.') }); return;
      }
      const id = tsSaveCustom(String(j.name).slice(0, 60) || 'Imported');
      const saved = settings.get().themeStudio || {};
      const rec = saved.customs && saved.customs[id];
      if (!rec) { say({ err: L('importBad', 'The preset could not be written.') }); return; }
      const rec2 = { ...rec, base: typeof j.base === 'string' ? j.base : rec.base, appearance: j.appearance && typeof j.appearance === 'object' ? j.appearance : rec.appearance };
      settings.set({ themeStudio: { ...saved, customs: { ...saved.customs, [id]: { ...rec2, widgets: j.widgets } } } });
      tsPersistFlush();
      say(L('importedNote', 'Imported — it is in the gallery now.'));
    } catch (e) { say({ err: errorText(e) }); }
  };

  const byZ = [...widgets].sort((a, b) => a.z - b.z);
  const selTheme = sel ? themes.find((x) => x.id === sel) : null;
  const pal = activeDef ? (activeDef.colors || []) : [];

  const goCustomize = (th) => {
    if (live.active !== th.id) apply(th.id);
    const first = (tsLive.get().widgets || [])[0];
    tsSelected.set(first ? first.id : null);
    setSelW(first ? first.id : null);
    setView('customize');
  };
  const goDesktop = () => {
    const first = (tsLive.get().widgets || [])[0];
    tsSelected.set(first ? first.id : null);
    try { wm.minimize?.(useAppWindow().id); } catch (e) { /* wm older */ }
    tsEnterArrange();
  };

  // ---------------- the customize workshop: the whole theme, one focused page ----------------
  if (view === 'customize' && activeDef) {
    const backBar = (
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Button small label={'← ' + L('back', 'Back to the themes')} onClick={() => { setView('gallery'); setSelW(null); }} />
          <Text style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{activeDef.name}</Text>
          <View style={{ flex: 1 }} />
          <Button small label={L('undo', 'Undo')} onClick={undo} disabled={!canUndo} />
          <Button small label={L('redo', 'Redo')} onClick={redo} disabled={!canRedo} />
          <Button small label={L('startOver', 'Start over')} onClick={() => act(() => tsResetTheme(area))} />
          <Button small label={L('editDesktop', 'Edit on the desktop')} onClick={goDesktop} />
          <Button small label={L('stopTheme', 'Stop using')} onClick={stop} />
        </View>
        <Note>{L('stepsHint', 'Three steps: click a widget on the canvas, style it below, drag it where you like. Everything is live — Undo takes any change back, and Start over puts the theme back exactly as it came.')}</Note>
      </View>
    );
    return (
      <Stack>
        <Message msg={note} />
        {backBar}
        <Section title={L('livePreview', 'Live preview')}
          footer={L('livePreviewHint', 'Click a block to select it; drag it and the real desktop follows. The centre lines are the alignment guides.')}>
          <StudioCanvas widgets={live.widgets} area={area} selW={selW} onSelect={setSelW} histRef={hist} />
        </Section>
        <Columns>
          <Section title={L('widgetsTitle', 'Your widgets')}
            footer={L('widgetsHint', 'Click one to edit it. The dot hides a widget without deleting it; × removes it — Undo brings it back.')}
            accessory={<Button small label={L('addWidget', 'Add a widget…')} onClick={() => setAddOpen(true)} />}>
            {byZ.length ? [...byZ].reverse().map((w) => (
              <LayerRow key={w.id} w={w} selected={selW === w.id}
                onSelect={setSelW}
                onEye={() => act(() => tsSetInstance(w.id, { hidden: !w.hidden }))}
                onRemove={() => { act(() => tsRemove(w.id, area)); if (selW === w.id) setSelW(null); }} />
            )) : <Text style={{ fontSize: 12, color: t.textDim }}>{L('noWidgets', 'This theme carries no widgets on the desktop.')}</Text>}
          </Section>
          <Section title={L('customize', 'Customize')}>
            {selected ? (
              <WidgetEditor w={{ ...selected, _palette: pal }} area={area}
                onStyle={onStyle} onCfg={onCfg} onGeom={onGeom}
                onLock={(on) => act(() => tsSetInstance(selected.id, { locked: on }))}
                onAlignXY={(xe, ye) => { tsMutateList((l) => tsAlignW(l, selected.id, xe, area)); tsMutateList((l) => tsAlignW(l, selected.id, ye, area)); }}
                onSpace={() => tsMutateList((l) => tsDistributeW(l, 'x', area))}
                onZ={(d) => act(() => tsZ(selected.id, d, area))}
                onDup={() => act(() => tsDuplicate(selected.id, area))}
                onRemove={() => { act(() => tsRemove(selected.id, area)); setSelW(null); }}
                onReset={() => act(() => tsResetInstance(selected.id, area))} />
            ) : (
              <Text style={{ fontSize: 12, color: t.textDim, paddingVertical: 8 }}>{L('pickWidget', 'Click a widget — here or on the canvas — and its controls appear here.')}</Text>
            )}
          </Section>
        </Columns>
        <ThemeLookSection s={s} set={setS} />
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
        {importOpen ? (
          <FilePicker modal title={L('importTitle', 'Choose a theme file')} filter={/\.json$/i}
            onPick={(f) => { importTheme(typeof f === 'string' ? f : f.path); setImportOpen(false); }}
            onClose={() => setImportOpen(false)} />
        ) : null}
        {addOpen ? (
          <AddDialog onAdd={(sp) => act(() => {
            const made = tsAddVariant(sp.kind, sp.style, area);
            if (made) tsSetInstance(made.id, { cfg: { ...(made.cfg || {}), variantRoute: sp.route } });
          })} onClose={() => setAddOpen(false)} />
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
      </Stack>
    );
  }

  // ---------------- the gallery: the cards, nothing else ----------------
  return (
    <Stack>
      <Message msg={note} />
      <Section
        title={L('gallery', 'Themes')}
        footer={L('galleryHint', 'Each theme is a whole desktop: a wallpaper, a palette, its widgets and their typography. Applying follows the live desktop and survives a reboot; the originals never change.')}
        accessory={null}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, width: '100%' }}>
          {themes.map((th) => (
            <ThemeCard key={th.id} theme={th} active={live.active === th.id}
              onSet={() => apply(th.id)}
              onPreview={() => open(th.id)}
              onCustomize={() => goCustomize(th)} />
          ))}
        </View>
      </Section>
      <Section
        title={L('storeTitle', 'Theme store')}
        footer={L('storeHint', 'Ready-made twists of the built-ins, made here on this machine — one click installs one into your gallery as your own.')}
        accessory={null}>
        {STORE_PACKS.map((pack) => {
          const items = storeItems().filter((it) => it.pack === pack.id);
          const installedNames = new Set(themes.filter((x) => x.custom).map((x) => x.name));
          return (
            <View key={pack.id} style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: 700, color: t.textDim, letterSpacing: 1, marginBottom: 6, textAlign: 'start' }}>{pack.name}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {items.map((it) => {
                  const done = installedNames.has(it.name);
                  const def = { ...it.def, id: `store-${it.key}`, name: it.name, desc: it.desc, custom: true,
                    appearance: { ...(it.def.appearance || {}), ...it.appearance },
                    widgets: tsResolvePlan(it.def.widgets || [], area, it.def.sw || 1280, it.def.sh || 720), sw: it.def.sw || 1280, sh: it.def.sh || 720 };
                  return (
                    <View key={it.key} style={{ width: 190, gap: 6, padding: 6, borderRadius: 12, border: `1px solid ${t.separator}` }}>
                      <ThemeMiniature theme={def} width={176} height={99} />
                      <Text style={{ fontSize: 12, fontWeight: 600, color: t.text, textAlign: 'start' }}>{it.name}</Text>
                      <Text style={{ fontSize: 10.5, color: t.textDim, minHeight: 24, textAlign: 'start' }}>{it.desc}</Text>
                      <Button small primary={!done} label={done ? L('storeInstalled', 'In your gallery') : L('storeInstall', 'Install')} disabled={done}
                        onClick={() => {
                          try {
                            const saved = settings.get().themeStudio || {};
                            const id = `custom-${Date.now().toString(36)}-${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;
                            settings.set({ themeStudio: { ...saved, customs: { ...(saved.customs || {}), [id]: { name: it.name, base: it.base,
                              widgets: tsResolvePlan(it.def.widgets || [], area, it.def.sw || 1280, it.def.sh || 720),
                              appearance: { ...(it.def.appearance || {}), ...it.appearance } } } } });
                            tsPersistFlush();
                            say(L('storeInstalledNote', 'Installed — it is in the gallery now.'));
                          } catch (e) { say({ err: errorText(e) }); }
                        }} />
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </Section>
      {selTheme ? (
        <PreviewDialog theme={selTheme} active={live.active === selTheme.id}
          onApply={() => { apply(selTheme.id); }}
          onDeactivate={() => { stop(); }}
          onClose={() => setSel(null)} />
      ) : null}
    </Stack>
  );
}
