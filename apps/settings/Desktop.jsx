// Desktop.jsx — Settings → Desktop: the whole desktop as one live, controllable copy. The canvas
// is not a picture — it is the same composition the real desktop renders, driven by the same
// tsLive store, so every drag and every edit here lands on the real one immediately (and the
// desktop's own arrangement mode shares the same undo history). Pick a widget, style it, drag it,
// add or remove, or hand the session over to the desktop bar — everything from this one window.
import {
  View, Text, Button, useTheme, useLocale, useSettings, tOptional, useStore, screen, spacing,
  tsLive, tsHistory, tsMutate, tsMove, tsResize, tsSetInstance, tsResetInstance, tsDuplicate,
  tsRemove, tsZ, tsAlignW, tsDistributeW, tsAddVariant, tsEnterArrange, wm, useAppWindow, errorText,
  addListener,
} from '@insaneos/sdk';
import { useRef, useState } from 'react';
import { Section, SettingRow, Note, Stack, Message } from './ui.jsx';
import { WidgetEditor, StudioCanvas, AddDialog } from './Themes.jsx';

const L = (k, fb) => tOptional(`settings.themes.${k}`) || fb;

export default function DesktopStudio() {
  const t = useTheme();
  const { t: tr } = useLocale();
  const [s] = useSettings();
  const live = useStore(tsLive);
  const [selW, setSelW] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [note, setNote] = useState(null);
  const hist = useRef(tsHistory);
  const area = { x: 0, y: 28, w: screen.width, h: Math.max(200, screen.height - 28 - 80) };
  const widgets = live.widgets || [];
  const selected = widgets.find((w) => w.id === selW) || null;
  const pal = live.def ? (live.def.colors || []) : [];
  const lastSoft = useRef(0);

  const say = (msg) => setNote({ ok: !msg.err, text: msg.err ? msg.err : msg });
  const act = (fn) => {
    hist.current.push(tsLive.get().widgets);
    try { fn(); } catch (e) { say({ err: errorText(e) }); }
  };
  const actSoft = (fn) => {
    const now = Date.now();
    if (now - lastSoft.current > 800) { hist.current.push(tsLive.get().widgets); lastSoft.current = now; }
    try { fn(); } catch (e) { say({ err: errorText(e) }); }
  };
  const undo = () => { const prev = hist.current.undo(tsLive.get().widgets); if (prev) tsMutate(() => prev, area); };
  const redo = () => { const next = hist.current.redo(tsLive.get().widgets); if (next) tsMutate(() => next, area); };
  const tsMutateList = (fn) => act(() => tsMutate(fn, area));
  const cur = () => (tsLive.get().widgets || []).find((x) => x.id === selW) || {};
  const onStyle = (patch) => actSoft(() => tsSetInstance(selW, { style: { ...(cur().style || {}), ...patch } }));
  const onCfg = (patch) => act(() => tsSetInstance(selW, { cfg: { ...(cur().cfg || {}), ...patch } }));
  const onGeom = (nx, ny, nw, nh) => {
    if (nx != null || ny != null) act(() => tsMove(selW, nx ?? cur().x, ny ?? cur().y, area));
    if (nw != null || nh != null) act(() => tsResize(selW, nw ?? cur().w, nh ?? cur().h, area));
  };
  const goDesktop = () => {
    try { wm.minimize?.(useAppWindow().id); } catch (e) { /* wm older */ }
    tsEnterArrange();
  };

  return (
    <Stack>
      <Message msg={note} />
      <Note>{L('studioHint', 'This is your desktop, live. Click a widget to select it, drag it where you like, style it below — the real desktop follows every move. Undo takes any change back.')}</Note>
      <Section title={L('studioCanvas', 'Your desktop — live copy')}
        footer={L('studioCanvasHint', 'Drag a widget here and the real one moves with it. The centre lines are the alignment guides.')}
        accessory={
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Button small label={L('undo', 'Undo')} onClick={undo} disabled={!hist.current.canUndo} />
            <Button small label={L('redo', 'Redo')} onClick={redo} disabled={!hist.current.canRedo} />
            <Button small label={L('editDesktop', 'Edit on the desktop')} onClick={goDesktop} />
            <Button small label={L('addWidget', 'Add a widget…')} onClick={() => setAddOpen(true)} />
          </View>
        }>
        <StudioCanvas widgets={widgets} area={area} selW={selW} onSelect={setSelW} histRef={hist} />
      </Section>
      <Section title={selected ? L('editing', 'Editing') : L('pickOne', 'Pick a widget')}>
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
          <Text style={{ fontSize: 12, color: t.textDim, paddingVertical: 8 }}>{L('pickWidget', 'Click a widget — here or on the canvas above — and its controls appear here.')}</Text>
        )}
      </Section>
      {addOpen ? (
        <AddDialog onAdd={(sp) => act(() => {
          const made = tsAddVariant(sp.kind, sp.style, area);
          if (made) tsSetInstance(made.id, { cfg: { ...(made.cfg || {}), variantRoute: sp.route } });
        })} onClose={() => setAddOpen(false)} />
      ) : null}
    </Stack>
  );
}
