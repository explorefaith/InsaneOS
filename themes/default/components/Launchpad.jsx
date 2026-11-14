// App launcher ("Apps"): all apps in full screen, with keyboard search (arrow keys move the
// selection through the grid, Enter opens it, Esc closes) and Spotlight's scorer for the matches
// (sdk/spotlight.js), so typing "term" puts Terminal first, not merely first found.
// An app is pinned to the Dock by dragging it onto the Dock (the launcher steps aside as soon as the
// drag starts, and the app lands where it is dropped) or with a right click → Keep in Dock. It works
// the same for Insane OS apps, .lpk packages and Linux apps (sdk/dock.js).
import { View, Text, TextInput, ScrollView, screen, t as tr, appName, refreshApps, APP_CATEGORIES, appCategory, dock, dockIdOf, useStore, settings,
  beginDockDrag, dockDragJustEnded, scoreText, useTween, addListener } from '@insaneos/sdk';
import { useEffect, useRef, useState } from 'react';
import { Menu } from './Menu.jsx';

const COLS = 6, CELL = 130, ICON = 72;

// area: the display it covers (the main one; global coordinates)
export function Launchpad({ t, apps, onOpen, onClose, area = { x: 0, y: 0, w: screen.width, h: screen.height } }) {
  useEffect(refreshApps, []);
  const A = useRef(area);
  A.current = area;
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState(null);                      // null: all
  const [sel, setSel] = useState(0);                         // the grid's roving selection
  const glass = !!t.effects;
  // entrance fade over the panel duration (Reduce Motion jumps to 1); closing stays instant
  const enter = useTween(1, { from: 0 });
  const q = query.trim().toLowerCase();
  const scoreOf = (a) => Math.max(0,
    scoreText(appName(a), q),
    ...[a.name, a.genericName, a.comment].map((v) => scoreText(v || '', q, false) * 0.7),
    ...((Array.isArray(a.keywords) ? a.keywords : [a.keywords]).filter(Boolean).map((v) => scoreText(String(v), q, false) * 0.6)));
  const present = APP_CATEGORIES.filter((c) => apps.some((a) => appCategory(a) === c));
  const list = q ? apps.map((a) => [scoreOf(a), a]).filter(([s]) => s > 0).sort((x, y) => y[0] - x[0]).map(([, a]) => a)
    : apps.filter((a) => !cat || appCategory(a) === cat);
  useEffect(() => { setSel(0); }, [query, cat]);
  const rows = [];
  for (let i = 0; i < list.length; i += COLS) rows.push(list.slice(i, i + COLS));
  const open = (id) => { onClose(); onOpen(id); };
  // the arrows and Enter belong to the grid while the launcher is open (the search field keeps the
  // letters; the caret sliding along a one-line field costs nothing)
  useEffect(() => addListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { setSel((n) => Math.min(list.length - 1, n + 1)); e.stopPropagation?.(); }
    else if (e.key === 'ArrowLeft') { setSel((n) => Math.max(0, n - 1)); e.stopPropagation?.(); }
    else if (e.key === 'ArrowDown') { setSel((n) => Math.min(list.length - 1, n + COLS)); e.stopPropagation?.(); }
    else if (e.key === 'ArrowUp') { setSel((n) => Math.max(0, n - COLS)); e.stopPropagation?.(); }
    else if (e.key === 'Enter' && list[sel]) { open(list[sel].id); e.stopPropagation?.(); }
  }), [list, sel]);
  useStore(settings);                                         // «Keep in Dock» changes immediately
  const [ctx, setCtx] = useState(null);                       // { app, x, y }
  const fg = glass ? '#fff' : t.text;

  return (
    <View onClick={onClose} style={{
      position: 'absolute', left: area.x, top: area.y, width: area.w, height: area.h, alignItems: 'center',
      backgroundColor: glass ? t.scrim : t.scrimPanel, backdropFilter: glass ? `blur(32px) saturate(${t.glassSaturate || 1.2})` : undefined,
      opacity: 0.3 + 0.7 * enter,
    }}>
      <View onClick={(e) => e.stopPropagation()} style={{ marginTop: 48, width: 260 }}>
        <TextInput value={query} onChange={setQuery} placeholder={tr('shell.launchpad.search')} autoFocus
          onSubmit={() => list[sel] && open(list[sel].id)} onCancel={onClose}
          style={{ backgroundColor: glass ? 'rgba(255,255,255,0.14)' : t.inputBg, border: `1px solid ${glass ? 'rgba(255,255,255,0.22)' : t.separator}` }} />
      </View>
      {!q && (
        <View onClick={(e) => e.stopPropagation()} style={{ marginTop: 22, flexDirection: 'row', gap: 6 }}>
          {[null, ...present].map((c) => (
            <View key={c || 'all'} onClick={() => setCat(c)} style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14,
              backgroundColor: c === cat ? (glass ? 'rgba(255,255,255,0.32)' : t.accentSubtle) : (glass ? 'rgba(255,255,255,0.1)' : t.hover) }}>
              <Text style={{ fontSize: 12, fontWeight: 600, color: fg }}>{c ? tr(`shell.category.${c}`) : tr('shell.category.all')}</Text>
            </View>
          ))}
        </View>
      )}
      <ScrollView onClick={(e) => e.stopPropagation()} style={{ marginTop: q ? 40 : 14, height: area.h - 190, width: Math.min(COLS * CELL, area.w - 20) }}>
      <View style={{ gap: 26, paddingVertical: 16 }}>
        {rows.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row' }}>
            {row.map((a, c) => {
              const i = r * COLS + c;
              return (
                <View key={a.id} onClick={(e) => { e.stopPropagation(); if (!dockDragJustEnded()) open(a.id); }}
                  onMouseDown={(e) => { if (!e.button && dockIdOf(a)) beginDockDrag({ id: dockIdOf(a), Icon: a.Icon, x: e.x, y: e.y, source: 'launcher', onStart: onClose }); }}
                  onContextMenu={(e) => { e.stopPropagation(); setCtx({ app: a, x: e.x, y: e.y }); }}
                  style={{ width: CELL, alignItems: 'center', gap: 10 }}>
                  <View style={{ borderRadius: 20, padding: 2, border: `2px solid ${i === sel ? t.accent : 'transparent'}` }}>
                    <a.Icon size={ICON} />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: 500, color: fg, whiteSpace: 'nowrap', maxWidth: CELL - 10, overflow: 'hidden' }}>{appName(a)}</Text>
                </View>
              );
            })}
          </View>
        ))}
        {list.length === 0 && <Text style={{ fontSize: 14, color: glass ? 'rgba(255,255,255,0.7)' : t.textDim, textAlign: 'center' }}>{tr('shell.launchpad.empty')}</Text>}
      </View>
      </ScrollView>
      {ctx && (
        <Menu x={ctx.x} y={ctx.y} onClose={() => setCtx(null)} items={[
          { label: tr('shell.dock.open'), onClick: () => open(ctx.app.id) },
          ...(dockIdOf(ctx.app) ? [{ label: tr('shell.dock.keep'), checked: dock.isPinned(ctx.app), disabled: dock.isPinned(ctx.app) && !dock.canRemove(ctx.app),
            onClick: () => (dock.isPinned(ctx.app) ? dock.unpin(ctx.app) : dock.pin(ctx.app)) }] : []),
        ]} />
      )}
    </View>
  );
}
