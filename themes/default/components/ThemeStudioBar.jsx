// ThemeStudioBar.jsx — the desktop customize mode's control surface (Phase 2 §4's "direct visual
// manipulation", on the real desktop). While tsArranging is on: the picked card wears its ring,
// and this glass bar rides bottom-centre — the card's own controls (size, align, type, ink,
// surface, corners, lock, duplicate, remove) and the mode's (undo/redo, reset, Cancel, Save &
// Apply). Save flushes the debounced persist and leaves; Cancel puts the entry look back
// (tsEntrySnapshot) — the PlaceLayer contract, for whole themes.
import { createElement as h, useState } from 'react';
import {
  View, Text, Button, Slider, TextInput, useStore, useTheme, useLocale, tOptional,
  screen, tsLive, tsArranging, tsSelected, tsExitArrange, tsEnterArrange,
  tsMove, tsResize, tsSetInstance, tsDuplicate, tsRemove, tsZ, tsAlignW, tsMutate, tsPersistFlush,
  TS_FONTS,
} from '@insaneos/sdk';

const STEPS = [12, 13, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 44, 48, 56, 64, 72, 80, 96];
const WEIGHTS = [400, 500, 600, 700, 800];

function BarButton({ t, label, onClick, primary, danger, disabled, wide }) {
  return (
    <View onClick={disabled ? undefined : onClick} style={{ height: 28, paddingHorizontal: wide ? 12 : 10,
      borderRadius: t.controlRadius, justifyContent: 'center', alignItems: 'center', cursor: disabled ? 'default' : 'pointer',
      backgroundColor: primary ? t.accent : danger ? 'rgba(229,72,77,0.16)' : 'rgba(127,127,127,0.18)',
      opacity: disabled ? 0.4 : 1 }}>
      <Text style={{ fontSize: 12, fontWeight: 600, color: primary ? '#ffffff' : danger ? '#ff5f57' : t.text,
        whiteSpace: 'nowrap' }}>{label}</Text>
    </View>
  );
}

function Chip({ t, label, onClick, active, disabled }) {
  return (
    <View onClick={disabled ? undefined : onClick} style={{ height: 22, minWidth: 22, paddingHorizontal: 6,
      borderRadius: 6, justifyContent: 'center', alignItems: 'center', cursor: disabled ? 'default' : 'pointer',
      backgroundColor: active ? t.accentSubtle : 'transparent', border: `1px solid ${active ? t.accent : t.separator}`,
      opacity: disabled ? 0.35 : 1 }}>
      <Text style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? t.accent : t.textDim }}>{label}</Text>
    </View>
  );
}

// The style sheet for the picked card: the same controls the Themes page's editor carries,
// written against the store so edits land live on the desktop behind the bar.
function CardStyleSheet({ t, w, area, hist }) {
  const st = w.style || {};
  const cur = () => (tsLive.get().widgets || []).find((x) => x.id === w.id) || {};
  const lastSoft = { current: 0 };
  const soft = (patch) => {
    const now = Date.now();
    if (now - lastSoft.current > 800) { hist.current.push(tsLive.get().widgets); lastSoft.current = now; }
    try { tsSetInstance(w.id, { style: { ...(cur().style || {}), ...patch } }); } catch (e) { /* clamped */ }
  };
  const cfg = (patch) => {
    hist.current.push(tsLive.get().widgets);
    try { tsSetInstance(w.id, { cfg: { ...(cur().cfg || {}), ...patch } }); } catch (e) { /* guarded */ }
  };
  const setGeom = (dx, dy, dw, dh) => {
    hist.current.push(tsLive.get().widgets);
    try {
      if (dx != null || dy != null) tsMove(w.id, dx != null ? cur().x + dx : cur().x, dy != null ? cur().y + dy : cur().y, area);
      if (dw != null || dh != null) tsResize(w.id, dw != null ? cur().w + dw : cur().w, dh != null ? cur().h + dh : cur().h, area);
    } catch (e) { /* clamped */ }
  };
  const scale = (f) => setGeom(null, null, Math.round((cur().w * f) / 4) * 4, Math.round((cur().h * f) / 4) * 4);
  const swatch = (c, i) => (
    <View key={i} onClick={() => soft({ color: c })} style={{ width: 18, height: 18, borderRadius: 9,
      backgroundColor: c || 'transparent', border: `2px solid ${(st.color || null) === c ? t.accent : t.separator}`,
      alignItems: 'center', justifyContent: 'center' }}>
      {c === null ? <Text style={{ fontSize: 8, color: t.textDim }}>A</Text> : null}
    </View>
  );
  return (
    <View style={{ gap: 8, padding: 10, borderRadius: 12, backgroundColor: t.panelBg, backdropFilter: t.glassFilter,
      border: `1px solid ${t.windowBorder}`, boxShadow: '0 14px 40px rgba(0,0,0,0.4)' }}>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Text style={{ fontSize: 11, color: t.textDim, width: 64 }}>Size</Text>
        <Chip t={t} label="S" onClick={() => scale(0.8)} />
        <Chip t={t} label="M" onClick={() => scale(1)} />
        <Chip t={t} label="L" onClick={() => scale(1.25)} />
        <Chip t={t} label="−" onClick={() => setGeom(null, null, -8, -8)} />
        <Chip t={t} label="+" onClick={() => setGeom(null, null, 8, 8)} />
      </View>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 11, color: t.textDim, width: 64 }}>Align</Text>
        {[['left', '⇤'], ['center-x', '⇔'], ['right', '⇥'], ['top', '⇧'], ['center-y', '⇕'], ['bottom', '⇩']].map(([edge, glyph]) => (
          <Chip key={edge} t={t} label={glyph} onClick={() => tsMutate((l) => tsAlignW(l, w.id, edge, area))} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 11, color: t.textDim, width: 64 }}>Type</Text>
        <PopIn t={t} value={st.font || ''} options={[['', 'Theme'], ...TS_FONTS.map((f) => [f.id, f.name])]}
          onChange={(v) => soft({ font: v || null })} width={150} />
        <PopIn t={t} value={st.size ?? ''} options={[['', 'Size'], ...STEPS.map((x) => [x, `${x}`])]}
          onChange={(v) => soft({ size: v === '' ? null : v })} width={90} />
        <PopIn t={t} value={st.weight ?? ''} options={[['', 'W'], ...WEIGHTS.map((x) => [x, `${x}`])]}
          onChange={(v) => soft({ weight: v === '' ? null : v })} width={80} />
        <Chip t={t} label="Italic" active={!!st.italic} onClick={() => soft({ italic: st.italic ? null : true })} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 11, color: t.textDim, width: 64 }}>Ink</Text>
        {[null, '#f5f5f7', '#1d1d1f'].map(swatch)}
        <TextInput value={st.color || ''} onChange={(v) => soft({ color: v || null })} placeholder="#hex" style={{ width: 90, height: 24, fontSize: 11 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 11, color: t.textDim, width: 64 }}>Background</Text>
        {[null, '#f4f1e7', '#1d1d1f', '#2b48d9', '#c8f14c', '#d24a3a'].map((c, i) => (
          <View key={i} onClick={() => soft({ paper: c })} style={{ width: 18, height: 18, borderRadius: 9,
            backgroundColor: c || 'transparent', border: `2px solid ${(st.paper || null) === c ? t.accent : t.separator}`,
            alignItems: 'center', justifyContent: 'center' }}>
            {c === null ? <Text style={{ fontSize: 8, color: t.textDim }}>T</Text> : null}
          </View>
        ))}
        <TextInput value={st.paper || ''} onChange={(v) => soft({ paper: v || null })} placeholder="#hex" style={{ width: 84, height: 24, fontSize: 11 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 11, color: t.textDim, width: 64 }}>Blur</Text>
        <Slider value={st.blur ?? 0.4} min={0} max={1} step={0.05} width={140} onChange={(v) => soft({ blur: v || null })} />
        <Text style={{ fontSize: 10, color: t.textDim, width: 32 }}>{`${Math.round((st.blur ?? 0.4) * 100)}%`}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 11, color: t.textDim, width: 64 }}>Surface</Text>
        <Slider value={st.alpha ?? 0.7} min={0.16} max={1} step={0.02} width={140} onChange={(v) => soft({ alpha: v })} />
        <Text style={{ fontSize: 10, color: t.textDim, width: 32 }}>{`${Math.round((st.alpha ?? 0.7) * 100)}%`}</Text>
        <Text style={{ fontSize: 11, color: t.textDim }}>Corners</Text>
        <Slider value={st.radius ?? 16} min={0} max={28} step={1} width={110} onChange={(v) => soft({ radius: Math.round(v) })} />
        <Text style={{ fontSize: 10, color: t.textDim, width: 20 }}>{`${Math.round(st.radius ?? 16)}`}</Text>
      </View>
      {w.kind === 'clock-digital' ? (
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: t.textDim, width: 64 }}>Clock</Text>
          <Chip t={t} label="24 h" active={(cur().cfg || {}).h24 !== false} onClick={() => cfg({ h24: (cur().cfg || {}).h24 === false ? true : false })} />
          <Chip t={t} label="Seconds" active={!!(cur().cfg || {}).seconds} onClick={() => cfg({ seconds: !(cur().cfg || {}).seconds })} />
        </View>
      ) : null}
      {w.kind === 'media' ? (
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: t.textDim, width: 64 }}>Idle</Text>
          <Chip t={t} label="Quiet card" active={(cur().cfg || {}).idle !== 'hide'} onClick={() => cfg({ idle: 'idle' })} />
          <Chip t={t} label="Hide" active={(cur().cfg || {}).idle === 'hide'} onClick={() => cfg({ idle: 'hide' })} />
        </View>
      ) : null}
      {w.kind === 'notes' || w.kind === 'quote' || w.kind === 'headline' || w.kind === 'label' ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: t.textDim, width: 64 }}>Text</Text>
          <TextInput value={(cur().cfg || {}).text || ''} onChange={(v) => cfg({ text: v })} style={{ width: 220, height: 24, fontSize: 12 }} />
        </View>
      ) : null}
    </View>
  );
}

// A tiny inline selector (the ui.jsx PopUp is a Settings-only module): opens a mini list panel.
function PopIn({ t, value, options, onChange, width }) {
  const [open, setOpen] = useState(false);
  const cur = options.find(([v]) => v === value) || options[0];
  return (
    <View style={{ position: 'relative' }}>
      <View onClick={() => setOpen(!open)} style={{ height: 24, minWidth: width / 2, paddingHorizontal: 8, borderRadius: 6,
        backgroundColor: 'rgba(127,127,127,0.18)', justifyContent: 'center', cursor: 'pointer' }}>
        <Text style={{ fontSize: 11, color: t.text }}>{String(cur[1])}</Text>
      </View>
      {open ? (
        <View style={{ position: 'absolute', left: 0, bottom: 28, width, borderRadius: 8, overflow: 'hidden',
          backgroundColor: t.panelBg, border: `1px solid ${t.windowBorder}`, zIndex: 5 }}>
          {options.map(([v, label], i) => (
            <View key={i} onClick={() => { onChange(v); setOpen(false); }} style={{ paddingHorizontal: 10, paddingVertical: 5,
              backgroundColor: v === value ? t.accentSubtle : 'transparent', cursor: 'pointer' }}>
              <Text style={{ fontSize: 11.5, color: v === value ? t.accent : t.text }}>{String(label)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function ThemeStudioBar({ area, hist }) {
  const t = useTheme();
  const { t: tr } = useLocale();
  const arranging = useStore(tsArranging);
  const live = useStore(tsLive);
  const selId = useStore(tsSelected);
  const [sheetOpen, setSheetOpen] = useState(false);
  const w = (live.widgets || []).find((x) => x.id === selId) || null;
  const label = w ? (tOptional(`settings.kind.${w.kind}`) || w.kind) : '';
  if (!arranging) return null;
  const act = (fn) => { hist.current.push(tsLive.get().widgets); try { fn(); } catch (e) { /* clamped */ } };
  return (
    <View style={{ position: 'absolute', left: screen.width / 2 - 320, top: screen.height - (sheetOpen ? 330 : 130),
      width: 640, borderRadius: 16, padding: 10, gap: 8,
      backgroundColor: t.panelBg, backdropFilter: t.glassFilter, border: `1px solid ${t.windowBorder}`,
      boxShadow: '0 18px 50px rgba(0,0,0,0.45)' }}
      onClick={(e) => e.stopPropagation?.()}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Text style={{ fontSize: 12, fontWeight: 700, color: t.text, width: w ? undefined : 160 }}>
          {w ? label : tr('shell.studio.pick') || 'Tap a card to edit it'}</Text>
        <View style={{ flex: 1 }} />
        <BarButton t={t} label="↶" onClick={() => { const prev = hist.current.undo(tsLive.get().widgets); if (prev) tsMutate(() => prev); }} />
        <BarButton t={t} label="↷" onClick={() => { const next = hist.current.redo(tsLive.get().widgets); if (next) tsMutate(() => next); }} />
        <BarButton t={t} label={tr('shell.studio.reset') || 'Reset layout'} onClick={() => { hist.current.push(tsLive.get().widgets); tsExitArrange(false); hist.current.reset(); tsEnterArrange(); }} />
        <BarButton t={t} label={tr('shell.studio.cancel') || 'Cancel'} onClick={() => tsExitArrange(true)} />
        <BarButton t={t} label={tr('shell.studio.save') || 'Save & Apply'} primary wide
          onClick={() => { tsPersistFlush(); tsExitArrange(false); }} />
      </View>
      {w ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <BarButton t={t} label={sheetOpen ? '▲ Style' : '▼ Style'} onClick={() => setSheetOpen(!sheetOpen)} />
          <BarButton t={t} label={w.locked ? '🔒' : '🔓'} onClick={() => act(() => tsSetInstance(w.id, { locked: !w.locked }))} />
          <BarButton t={t} label="⧉" onClick={() => act(() => tsDuplicate(w.id, area))} />
          <BarButton t={t} label="↑" onClick={() => act(() => tsZ(w.id, 'forward', area))} />
          <BarButton t={t} label="↓" onClick={() => act(() => tsZ(w.id, 'backward', area))} />
          <BarButton t={t} label="✕" danger onClick={() => { hist.current.push(tsLive.get().widgets); try { tsRemove(w.id, area); } catch (e) { /* gone */ } }} />
          <Text style={{ fontSize: 10, color: t.textDim }}>{`${w.x}, ${w.y}`}</Text>
        </View>
      ) : null}
      {w && sheetOpen ? <CardStyleSheet t={t} w={w} area={area} hist={hist} /> : null}
    </View>
  );
}

