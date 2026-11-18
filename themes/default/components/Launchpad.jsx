// App launcher ("Apps"): all apps in full screen, with keyboard search (arrow keys move the
// selection through the grid, Enter opens it, Esc closes) and Spotlight's scorer for the matches
// (sdk/spotlight.js), so typing "term" puts Terminal first, not merely first found.
// An app is pinned to the Dock by dragging it onto the Dock (the launcher steps aside as soon as the
// drag starts, and the app lands where it is dropped) or with a right click → Keep in Dock. It works
// the same for Insane OS apps, .lpk packages and Linux apps (sdk/dock.js).
import { View, Text, TextInput, ScrollView, screen, t as tr, appName, refreshApps, APP_CATEGORIES, appCategory, dock, dockIdOf, useStore, settings,
  beginDockDrag, dockDragJustEnded, scoreText, useTween, addListener, Button, errorText, playFx, canUninstall, uninstallApp, Progress, Spinner, wm } from '@insaneos/sdk';
import { useEffect, useRef, useState } from 'react';
import { Menu } from './Menu.jsx';

const SETTINGS_SECTIONS = ['general', 'appearance', 'wallpaper', 'themes', 'widgets', 'network', 'sound', 'displays', 'keyboard', 'users', 'updates', 'session'];
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
  // the settings sections match the query too (the same list Spotlight offers; opening jumps to
  // the section) — shown as rows under the app grid while searching
  const settingsHits = q ? SETTINGS_SECTIONS
    .map((id) => ({ id, name: tOptional(`settings.section.${id}`) || '', kw: tOptional(`settings.keywords.${id}`) || '' }))
    .filter((x) => x.name && (x.name.toLowerCase().includes(q) || x.kw.toLowerCase().includes(q)))
    .slice(0, 4) : [];
  // the recently used apps (the Dock records them), shown above the grid when not searching
  const recents = !q ? (settings.get().dockRecentApps || [])
    .map((id) => apps.find((a) => a.id === id || a.launcherId === id)).filter(Boolean).slice(0, 6) : [];
  const list = q ? apps.map((a) => [scoreOf(a), a]).filter(([s]) => s > 0).sort((x, y) => y[0] - x[0]).map(([, a]) => a)
    : apps.filter((a) => !cat || appCategory(a) === cat);
  useEffect(() => { setSel(0); }, [query, cat]);
  const rows = [];
  for (let i = 0; i < list.length; i += COLS) rows.push(list.slice(i, i + COLS));
  const open = (id) => { onClose(); onOpen(id); };
  const [ctx, setCtx] = useState(null);                       // { app, x, y }
  const [uninst, setUninst] = useState(null);                 // { app, busy, pct, done, error } — the uninstall sheet.
  // Declared BEFORE the keyboard effect below: the effect's deps array names `uninst`, and a deps
  // array is evaluated at call time — a declaration below it would put the binding in its temporal
  // dead zone on every render (the launcher opened, the shell died with "M is not initialized").
  // the arrows and Enter belong to the grid while the launcher is open (the search field keeps the
  // letters; the caret sliding along a one-line field costs nothing) — and to nobody while the
  // uninstall sheet is up: Enter there would open the app the sheet is about
  useEffect(() => addListener('keydown', (e) => {
    if (uninst) return;
    if (e.key === 'ArrowRight') { setSel((n) => Math.min(list.length - 1, n + 1)); e.stopPropagation?.(); }
    else if (e.key === 'ArrowLeft') { setSel((n) => Math.max(0, n - 1)); e.stopPropagation?.(); }
    else if (e.key === 'ArrowDown') { setSel((n) => Math.min(list.length - 1, n + COLS)); e.stopPropagation?.(); }
    else if (e.key === 'ArrowUp') { setSel((n) => Math.max(0, n - COLS)); e.stopPropagation?.(); }
    else if (e.key === 'Enter' && list[sel]) { open(list[sel].id); e.stopPropagation?.(); }
  }), [list, sel, uninst]);
  useStore(settings);                                         // «Keep in Dock» changes immediately
  const fg = glass ? '#fff' : t.text;
  // The removal runs in the background (sdk/packages.js uninstallApp): a .lpk is gone at once, a
  // Linux app's package reports its progress lines. The trash sound is the delete feedback.
  const runUninstall = () => {
    const app = uninst.app;
    setUninst({ app, busy: true });
    uninstallApp(app, (p) => setUninst((u) => (u && u.app === app ? { ...u, pct: p.total > 0 ? Math.round((p.done / p.total) * 100) : null } : u))).then((r) => {
      if (r.ok) playFx('trash');
      setUninst((u) => (u && u.app === app ? { ...u, busy: false, done: !!r.ok, error: r.ok ? null : r.error } : u));
    });
  };

  return (
    <View onClick={onClose} style={{
      position: 'absolute', left: area.x, top: area.y, width: area.w, height: area.h, alignItems: 'center',
      backgroundColor: glass ? t.scrim : t.scrimPanel, backdropFilter: glass ? `blur(32px) saturate(${t.glassSaturate || 1.2})` : undefined,
      opacity: 0.3 + 0.7 * enter,
    }}>
      <View onClick={(e) => e.stopPropagation()} style={{ marginTop: 48, width: 260 }}>
        <TextInput value={query} onChange={setQuery} placeholder={tr('shell.launchpad.search')} autoFocus
          onSubmit={() => list[sel] && open(list[sel].id)} onCancel={uninst ? (uninst.busy ? undefined : () => setUninst(null)) : onClose}
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
        {recents.length ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: 700, color: fg, opacity: 0.6, letterSpacing: 1 }}>{tr('shell.launchpad.recent') || 'RECENT'}</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {recents.map((a) => (
                <View key={`r-${a.id}`} onClick={(e) => { e.stopPropagation(); open(a.id); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
                  paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: glass ? 'rgba(255,255,255,0.12)' : t.hover, cursor: 'pointer' }}>
                  {a.Icon ? <a.Icon size={18} color={fg} /> : null}
                  <Text style={{ fontSize: 12, fontWeight: 600, color: fg }}>{appName(a)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        {settingsHits.length ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: 700, color: fg, opacity: 0.6, letterSpacing: 1 }}>{tr('shell.spotlight.inSettings') || 'IN SETTINGS'}</Text>
            {settingsHits.map((x) => (
              <View key={`s-${x.id}`} onClick={(e) => { e.stopPropagation(); onClose(); wm.open('settings', { args: { section: x.id } }); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
                  backgroundColor: glass ? 'rgba(255,255,255,0.12)' : t.hover, cursor: 'pointer' }}>
                <Text style={{ fontSize: 14 }}>⚙</Text>
                <Text style={{ fontSize: 13, fontWeight: 600, color: fg }}>{x.name}</Text>
              </View>
            ))}
          </View>
        ) : null}
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
          // Uninstall: only what can be removed (a .lpk package or a Linux app's own package; the
          // built-in apps are Insane OS itself and never offer it — canUninstall, sdk/packages.js)
          ...(canUninstall(ctx.app) ? [{ label: tr('shell.launchpad.uninstall'), onClick: () => setUninst({ app: ctx.app }) }] : []),
        ]} />
      )}
      {uninst && (
        <View onClick={() => { if (!uninst.busy) setUninst(null); }} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%',
          alignItems: 'center', justifyContent: 'center', backgroundColor: glass ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.35)' }}>
          <View onClick={(e) => e.stopPropagation()} style={{ width: 360, padding: 18, gap: 12, borderRadius: 14,
            backgroundColor: t.windowBg || (glass ? 'rgba(40,40,46,0.92)' : '#ffffff'), border: `1px solid ${t.separator}`, boxShadow: '0 16px 44px rgba(0,0,0,0.5)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <uninst.app.Icon size={40} />
              <Text style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: fg, textAlign: 'start' }}>{tr('shell.launchpad.uninstallTitle', { name: appName(uninst.app) })}</Text>
            </View>
            <Text style={{ fontSize: 12, color: glass ? 'rgba(255,255,255,0.8)' : t.textDim, lineHeight: 1.5, textAlign: 'start' }}>{tr('shell.launchpad.uninstallBody')}</Text>
            {uninst.busy ? (
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 12, color: fg, textAlign: 'start' }}>{tr('shell.launchpad.uninstalling')}</Text>
                  {uninst.pct == null ? <Spinner size={14} /> : null}
                </View>
                {uninst.pct != null ? <Progress pct={uninst.pct} width={324} /> : null}
              </View>
            ) : null}
            {uninst.error ? <Text style={{ fontSize: 12, color: '#ff453a', lineHeight: 1.45, textAlign: 'start' }}>{tr('shell.launchpad.uninstallFailed', { name: appName(uninst.app), error: errorText(uninst.error) })}</Text> : null}
            {uninst.done && !uninst.error ? <Text style={{ fontSize: 12, color: fg, textAlign: 'start' }}>{tr('shell.launchpad.uninstalled', { name: appName(uninst.app) })}</Text> : null}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              {uninst.busy ? null : uninst.done || uninst.error ? (
                <Button small label={tr('shell.launchpad.done')} onClick={() => setUninst(null)} />
              ) : (
                <>
                  <Button small label={tr('shell.picker.cancel')} onClick={() => setUninst(null)} />
                  <Button small destructive label={tr('shell.launchpad.uninstall')} onClick={runUninstall} />
                </>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
