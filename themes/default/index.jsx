// "Insane Flow" theme (id default) — an island strip and dock layout, with its own assets.
// The theme builds the desktop (wallpaper, the left island strip, dock, app launcher, quick settings)
// and the window frames. Apps come from apps/ through the SDK. The top menu bar is gone: its work
// went to the strip (IslandStrip.jsx), so windows use the full height.
import {
  startShell,
  View,
  Text,
  Image,
  screen,
  ThemeProvider,
  useSettings,
  useWindows,
  configureWindows,
  getApp,
  wm,
  addListener,
  t as tr,
  useLauncherApps,
  launchApp,
  useDockEntries,
  dockActivate,
  dockMenu,
  dockPrefs,
  DOCK_LAUNCHER,
  useTrash,
  openTrash,
  emptyTrash,
  trashMenu,
  ConfirmDialog,
  DesktopWidgets,
  registerGestureActions,
  screenDisplays,
  mainDisplay,
  settings,
  Layer,
  PowerDialog,
  findWallpaper,
  wallpaperSrc,
  wallpaperMedia,
  MotionWallpaper,
  Backdrop,
  useShortcuts,
  AppSwitcher,
  openSwitcher,
  switcherKeys,
  switcherGrabs,
  switcherHold,
  cycleAppWindows,
  hideApp,
  hideOthers,
  toggleShowDesktop,
  appSettingsItem,
  flowDesktopKeys,
  flowGrabs,
  desktopSwipe,
  DesktopHud,
  OverviewBackdrop,
  OverviewChrome,
  openOverview,
  closeOverview,
  toggleOverview,
  LevelHud,
  useStore,
  dockIconRects,
  dockIdOfWindow,
  DUR,
  windows,
  playFx,
} from '@insaneos/sdk';
import { apps } from '@insaneos/apps';
import { useEffect, useRef, useState } from 'react';
import { makeTheme, wallpaperAccent, hexFromRgb } from './tokens.js';
import { IslandStrip } from './components/IslandStrip.jsx';
import { Dock, LaunchpadIcon, dockThickness } from './components/Dock.jsx';
import { Window } from './components/Window.jsx';
import { Launchpad } from './components/Launchpad.jsx';
import { WidgetGallery, widgetsEditing } from './components/DesktopWidgets.jsx';   // registers the widgets (clock, stats, calendar, battery, media)
import { Menu } from './components/Menu.jsx';

const MENU_H = 0;   // the top bar is gone — the island strip lives on the left edge (IslandStrip.jsx)
// The defaults: Files first and the app launcher after it; the Trash is always last (sdk/dockmodel.js).
const DOCK_ORDER = ['files', DOCK_LAUNCHER, 'terminal', 'calculator', 'settings', 'about'];

// Area for windows: the whole display, minus the Dock's side (unless it hides, always or only under windows),
// so maximized and new windows don't end up under the Dock. The island strip floats over the left edge
// (Layer "menubar"), the way floating panels always have — windows may slide under it.
// Several displays (docs/DISPLAYS.md): the Dock goes on the main one.
function workAreaFor(p, d) {
  const a = { x: d.x, y: d.y, w: d.w, h: d.h };
  if (!d.main || p.dockAutohide) return a;
  const k = dockThickness(p.dockSize);
  if (p.dockPosition === 'left') { a.x += k; a.w -= k; }
  else if (p.dockPosition === 'right') a.w -= k;
  else a.h -= k;
  return a;
}
const areaFn = (d) => { const s = settings.get(); return workAreaFor(dockPrefs(s), d); };

// chrome: borders (1 + 1) and title bar (40 + 1 separator) of Window.jsx's frame
configureWindows({ apps, workArea: areaFn, chrome: { w: 2, h: 43 } });

// Pinned by default (the user changes the Dock by dragging and with «Keep in Dock»: settings.dockPinned).
const DOCK_DEFAULT = [...DOCK_ORDER, ...apps.filter((a) => a.dock && !DOCK_ORDER.includes(a.id)).map((a) => a.id)];

// Minimize effect: a window that was just minimized stays drawn for DUR.minimize while the genie
// warps its cached raster into its Dock icon (insane-server's canvas_genie_blit; layout doesn't
// change). The icon's place comes from the Dock itself (dockIconRects), with a bottom-centre
// fallback; reduce motion fades instead (Window.jsx).
const MIN_MS = DUR.minimize;
const RESTORE_MS = DUR.restore;
// The restore genie: a window that was just un-minimized warps back out of its Dock icon — the same
// engine warp the minimize effect uses (canvas_genie_blit), driven 1 → 0 so the strips fly the other
// way. Its raster is the window's own, live again. Reduce Motion keeps the plain appearance, and a
// fullscreen or pip window never had an icon to come out of. Nothing here blocks input: the window
// is interactive while it settles, the warp only changes how it is painted.
function useRestoring(windows) {
  const prev = useRef(new Map());
  const [anim, setAnim] = useState([]);                 // [{ id, t0 }]
  useEffect(() => {
    const started = [];
    for (const w of windows) {
      if (!w.minimized && prev.current.get(w.id) === true && !w.fullscreen && !w.pip) started.push({ id: w.id, t0: Date.now() });
      prev.current.set(w.id, !!w.minimized);
    }
    if (started.length) setAnim((a) => [...a.filter((x) => !started.some((y) => y.id === x.id)), ...started]);
  }, [windows]);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!anim.length) return undefined;
    let raf = requestAnimationFrame(function step() {
      const now = Date.now();
      if (anim.some((x) => now - x.t0 >= RESTORE_MS)) setAnim((a) => a.filter((x) => now - x.t0 < RESTORE_MS));
      else { tick((n) => n + 1); raf = requestAnimationFrame(step); }
    });
    return () => cancelAnimationFrame(raf);
  }, [anim]);
  const now = Date.now();
  return anim.map((x) => ({ win: windows.find((w) => w.id === x.id), q: Math.min(1, (now - x.t0) / RESTORE_MS) }))
    .filter((x) => x.win && !x.win.minimized);
}

function useMinimizing(windows) {
  const prev = useRef(new Map());
  const [anim, setAnim] = useState([]);                 // [{ id, t0 }]
  useEffect(() => {
    const started = [];
    for (const w of windows) {
      if (w.minimized && prev.current.get(w.id) === false && !w.fullscreen && !w.pip) started.push({ id: w.id, t0: Date.now() });
      prev.current.set(w.id, !!w.minimized);
    }
    if (started.length) setAnim((a) => [...a.filter((x) => !started.some((y) => y.id === x.id)), ...started]);
  }, [windows]);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!anim.length) return undefined;
    let raf = requestAnimationFrame(function step() {
      const now = Date.now();
      if (anim.some((x) => now - x.t0 >= MIN_MS)) setAnim((a) => a.filter((x) => now - x.t0 < MIN_MS));
      else { tick((n) => n + 1); raf = requestAnimationFrame(step); }
    });
    return () => cancelAnimationFrame(raf);
  }, [anim]);
  const now = Date.now();
  return anim.map((x) => ({ win: windows.find((w) => w.id === x.id), p: Math.min(1, (now - x.t0) / MIN_MS) }))
    .filter((x) => x.win && x.win.minimized);
}

// Insane Flow's own shortcuts (the common ones are in sdk/shortcuts.js).
const onFront = (fn) => () => { const id = wm.focused(); if (id) fn(id); };
const minimizeFront = onFront(wm.minimize);
const hideFront = onFront(hideApp);
const hideOtherApps = onFront(hideOthers);
const openForceQuit = () => wm.open('forcequit');
const toggleDockAutohide = () => settings.set({ dockAutohide: !dockPrefs(settings.get()).dockAutohide });
const frontSettings = () => { const id = wm.focused(); return id ? appSettingsItem(id) : null; };
const openFrontSettings = () => frontSettings()?.onClick();
const switchApps = (e) => openSwitcher(switcherHold(e), e.shift);
const cycleWindows = (e) => cycleAppWindows(e.shift);

const flowTable = (toggleLauncher) => [
  { id: 'launcher', keys: ['F4'], show: ['❖', 'F4'], run: toggleLauncher, label: 'shell.shortcuts.launcher', group: 'system' },
  { id: 'showDesktop', keys: ['Meta+F11'], run: toggleShowDesktop, label: 'shell.shortcuts.showDesktop', group: 'system' },
  { id: 'dockAutohide', keys: ['Meta+Alt+D'], run: toggleDockAutohide, label: 'shell.shortcuts.dockAutohide', group: 'system' },
  { id: 'switchApps', keys: switcherKeys('meta'), run: switchApps, label: 'shell.shortcuts.switchApps', group: 'windows' },
  { id: 'cycleWindows', keys: ['Meta+`', 'Meta+Shift+`'], run: cycleWindows, label: 'shell.shortcuts.cycleWindows', group: 'windows' },
  { id: 'minimize', keys: ['Meta+M'], run: minimizeFront, label: 'shell.shortcuts.minimize', group: 'windows' },
  { id: 'hide', keys: ['Meta+H'], run: hideFront, label: 'shell.shortcuts.hide', group: 'windows' },
  { id: 'hideOthers', keys: ['Meta+Alt+H'], run: hideOtherApps, label: 'shell.shortcuts.hideOthers', group: 'windows' },
  { id: 'forceQuit', keys: ['Meta+Alt+Escape'], run: openForceQuit, label: 'shell.shortcuts.forceQuit', group: 'apps' },
  { id: 'appSettings', keys: ['Meta+,'], run: openFrontSettings, when: frontSettings, label: 'shell.shortcuts.appSettings', group: 'apps' },
  ...flowDesktopKeys,
];

// The Dock's right-click menus open toward the inside of the screen, next to the icon.
function DockMenu({ pos, at, items, onClose }) {
  return pos === 'bottom'
    ? <Menu above side="right" x={at.x - 110} y={at.y} onClose={onClose} items={items} />
    : <Menu centered side={pos === 'left' ? 'right' : 'left'} x={at.x} y={at.y} onClose={onClose} items={items} />;
}

function App() {
  const [s] = useSettings();
  const t = makeTheme(s);
  const { windows, mounted, focused } = useWindows();
  const minimizing = useMinimizing(windows);
  const restoring = useRestoring(windows);
  const dockRects = useStore(dockIconRects);
  const minFx = (id) => {
    const m = minimizing.find((x) => x.win.id === id);
    if (!m) return undefined;
    if (s.reduceMotion) return { fade: true, p: m.p };
    const r = dockRects[dockIdOfWindow(m.win)];
    return { genie: true, p: m.p, ...(!r ? { x: main.x + main.w / 2 - 27, y: main.y + main.h - 63, w: 54, h: 54 } : r) };
  };
  // the restore warp: the same icon rect, progress backwards from the icon (0.99: the first painted
  // frame already comes out of the icon, never a flash of the full window before it)
  const restFx = (id) => {
    const r = restoring.find((x) => x.win.id === id);
    if (!r || s.reduceMotion) return undefined;
    const rc = dockRects[dockIdOfWindow(r.win)];
    return { genie: true, p: Math.min(0.99, 1 - r.q), ...(!rc ? { x: main.x + main.w / 2 - 27, y: main.y + main.h - 63, w: 54, h: 54 } : rc) };
  };
  const [launchpad, setLaunchpad] = useState(false);
  const [context, setContext] = useState(null);
  const [dockCtx, setDockCtx] = useState(null);
  const [trashCtx, setTrashCtx] = useState(null);         // where the Trash's menu opens
  const [askEmpty, setAskEmpty] = useState(false);
  const trash = useTrash();
  const launcherApps = useLauncherApps();
  const dp = dockPrefs(s);
  // the work area follows the Dock live (position, size, auto-hide, another screen)
  useEffect(() => { configureWindows({ apps, workArea: areaFn }); },
    [dp.dockPosition, dp.dockSize, dp.dockAutohide, screen.mirror, screen.width, screen.height]);
  const main = mainDisplay();
  const all = screenDisplays();

  // F4 opens the app launcher; ❖ too, but only if released without being used in a shortcut.
  const toggleLauncher = () => { closeOverview(); setLaunchpad((v) => !v); };
  useShortcuts({ grabs: switcherGrabs(flowGrabs()), table: flowTable(toggleLauncher), onSuperTap: toggleLauncher, appsPaste: true });
  useEffect(() => addListener('keydown', (e) => { if (e.key === 'Escape') { setContext(null); } }), []);

  // Trackpad: a 3-finger swipe up opens the app launcher (4 fingers: the overview) and down closes
  // them; left/right switch desktops, or windows with only one desktop. See docs/TRACKPAD.md.
  useEffect(() => registerGestureActions({
    up: (g) => { if (g.fingers >= 4) { setLaunchpad(false); openOverview(); } else setLaunchpad(true); },
    down: () => { setLaunchpad(false); closeOverview(); },
    left: desktopSwipe('left'), right: desktopSwipe('right'),
  }), []);

  const wallpaper = findWallpaper(t.wallpapers, s.wallpaper);
  // The Auto accent (settings.accent === 'auto'): the accent follows the wallpaper. Live wallpapers sample
  // their playing frame (media.accent on the wallpaperMedia id); still wallpapers read the engine's decoded
  // picture cache (media.accentFrom — the picture the Backdrop paints, so no second decode and no media
  // job). The C side returns the dominant colour; the store write re-renders the shell and makeTheme
  // tone-maps the hex per mode. An older server without these APIs (or a picture that never opens) leaves
  // the store alone — makeTheme's violet fallback keeps the theme whole.
  const wpLive = useStore(wallpaperMedia);
  useStore(wallpaperAccent);
  useEffect(() => {
    if (s.accent !== 'auto') return undefined;
    try {
      const liveId = wallpaperMedia.get();
      if (liveId) {
        const a = insane.media.accent?.(liveId);
        if (a) wallpaperAccent.set({ hex: hexFromRgb(a) });
      } else if (wallpaper?.src) {
        const a = insane.media.accentFrom?.(wallpaper.src);
        if (a) wallpaperAccent.set({ hex: hexFromRgb(a) });
      }
    } catch { /* older server */ }
    return undefined;
  }, [s.accent, s.wallpaper, wpLive]);
  // Pinned and open apps; windows of the same app (Linux too) share a single icon. The app launcher
  // is a Dock item too (it moves, but can't be removed).
  const entries = useDockEntries(DOCK_DEFAULT, { recents: dp.dockRecents ? 3 : 0, launcher: { Icon: LaunchpadIcon, onOpen: () => setLaunchpad(true) } });
  const byId = new Map(entries.map((e) => [e.id, e]));

  return (
    <ThemeProvider tokens={t}>
      <View style={{ width: '100%', height: '100%' }}>
        <Backdrop wallpaper={wallpaper} bg={s.wallpaperBg || null} fit={s.wallpaperFit} displays={all}
          onContextMenu={(e) => setContext({ x: e.x, y: e.y })} />
        {all.map((d) => <MotionWallpaper key={d.id + ':' + d.x} display={d} />)}
        <DesktopWidgets layer="below" />
        <OverviewBackdrop />
        {mounted.map((w) => <Window key={w.id} win={w} app={getApp(w.id)} t={t} focused={w.id === focused} fx={minFx(w.id) || restFx(w.id)} />)}
        {minimizing.filter((x) => !mounted.includes(x.win)).map(({ win }) => <Window key={win.id} win={win} app={getApp(win.id)} t={t} focused={false} fx={minFx(win.id)} />)}
        <DesktopWidgets layer="above" />
        {/* Everything above the windows goes in its layer (sdk/layers.js, docs/LAYERS.md): the
            order is the layers', not this tree's, and clicks follow it. Menus go to «popover»
            by themselves (Menu.jsx). The island strip lives in the «menubar» layer, floating
            over the left edge — windows may slide under it, panels open above everything. */}
        <Layer name="menubar">
          <IslandStrip t={t} area={main} windows={mounted} focused={focused} />
        </Layer>
        <Layer name="dock">
        <Dock t={t} items={entries} running={entries.filter((e) => e.running).map((e) => e.id)}
          onOpen={(id) => byId.has(id) && dockActivate(byId.get(id))}
          onContext={(id, at) => byId.has(id) && setDockCtx({ entry: byId.get(id), at })}
          onTrash={openTrash} onTrashContext={(at) => setTrashCtx(at)} trashFull={trash.full}
          position={dp.dockPosition} size={dp.dockSize} magnify={dp.dockMagnify} maxSize={dp.dockMagnifySize}
          hideMode={dp.dockHide} top={MENU_H} keepOpen={!!dockCtx || !!trashCtx} area={main} />
        </Layer>
        {dockCtx && <DockMenu pos={dp.dockPosition} at={dockCtx.at} onClose={() => setDockCtx(null)} items={dockMenu(byId.get(dockCtx.entry.id) || dockCtx.entry)} />}
        {trashCtx && <DockMenu pos={dp.dockPosition} at={trashCtx} onClose={() => setTrashCtx(null)} items={trashMenu({ onEmpty: () => setAskEmpty(true) })} />}
        {askEmpty && (
          <Layer name="modal">
            <ConfirmDialog title={tr('shell.trash.confirmTitle')} detail={tr('shell.trash.confirmDetail')} okLabel={tr('shell.trash.empty')}
              cancelLabel={tr('shell.trash.cancel')} destructive area={main}
              onCancel={() => setAskEmpty(false)} onOk={() => { setAskEmpty(false); emptyTrash().then(() => playFx('trash')).catch(() => {}); }} />
          </Layer>
        )}
        {/* Restart… and Shut Down… (sdk/power.jsx): inside the ThemeProvider, so it takes the theme's colors */}
        <Layer name="modal"><PowerDialog /></Layer>
        <AppSwitcher />
        <OverviewChrome />
        <DesktopHud />
        <LevelHud />
        {context && (
          <Menu x={context.x} y={context.y} onClose={() => setContext(null)} items={[
            { label: tr('shell.desktop.wallpaper'), onClick: () => wm.open('settings', { args: { section: 'wallpaper' } }) },
            { label: tr('shell.desktop.openLaunchpad'), onClick: () => setLaunchpad(true) },
            { label: tr('shell.widgets.edit') || 'Edit Widgets', onClick: () => widgetsEditing.set(true) },
            { label: tr('shell.desktops.overview'), onClick: () => toggleOverview() },
            '-',
            { label: tr('shell.menu.settings'), onClick: () => wm.open('settings') },
            { label: tr('shell.menu.about'), onClick: () => wm.open('about') },
          ]} />
        )}
        {launchpad && <Layer name="overlay"><Launchpad t={t} apps={launcherApps} onOpen={launchApp} onClose={() => setLaunchpad(false)} area={main} /></Layer>}
        <Layer name="overlay"><WidgetGallery workArea={{ x: 0, y: MENU_H, w: main.w, h: main.h - MENU_H - 96 }} onClose={() => widgetsEditing.set(false)} /></Layer>

      </View>
    </ThemeProvider>
  );
}

startShell(<App />);
