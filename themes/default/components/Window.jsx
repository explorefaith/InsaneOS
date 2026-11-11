// Window frame: draggable title bar, traffic lights, shadow. The content is the app
// (the SDK's AppHost); the theme only decides how the frame looks. Moving and resizing (invisible
// borders on all 4 sides and 4 corners, <WindowShell>) is done by lord-server in C
// (docs/WINDOWS.md); the JS drag below is only kept for a maximized window.
import { View, Text, addListener, wm, AppHost, windowTitle, WindowShell, moveToDesktopItems, t as tr, solidOver, useSettings } from '@lordos/sdk';
import { useEffect, useRef, useState } from 'react';
import { Menu } from './Menu.jsx';

const TITLE_H = 40;
const DRAG_START = 6;      // px the pointer moves before a maximized window is dragged out
const LIGHT = 13;          // a traffic light's diameter
// bars: the glyph shown on hover, as [length, angle] bars crossing the light's center
const LIGHTS = [
  { key: 'close', color: '#ff5f57', bars: [[8, 45], [8, -45]], act: (id) => wm.close(id) },
  { key: 'min', color: '#febc2e', bars: [[7, 0]], act: (id) => wm.minimize(id) },
  { key: 'max', color: '#28c840', bars: [[7, 0], [7, 90]], act: (id) => wm.toggleMaximize(id) },
];

// The ×, − and + drawn as bars centered on the light (issue #69: text glyphs sat off-center by their
// font metrics). Solid colors, so where two bars cross the color does not darken twice.
function LightGlyph({ l }) {
  const color = solidOver('rgba(0,0,0,0.6)', l.color), w = 1.5;
  return l.bars.map(([len, deg], i) => (
    <View key={i} style={{ position: 'absolute', left: (LIGHT - len) / 2, top: (LIGHT - w) / 2, width: len, height: w, borderRadius: w / 2,
      backgroundColor: color, pointerEvents: 'none', transform: deg ? `rotate(${deg}deg)` : undefined }} />
  ));
}

// fx: the minimize effect ({ p: 0..1, x, y: where the Dock is}): the frame shrinks towards it.
function fxStyle(fx, geo) {
  if (!fx) return null;
  const e = fx.p * fx.p;                                // ease-in
  const dx = (fx.x - (geo.x + geo.w / 2)) * e, dy = (fx.y - (geo.y + geo.h / 2)) * e;
  return { transform: `translate(${dx}px, ${dy}px) scale(${1 - 0.9 * e})`, opacity: 1 - 0.7 * e, pointerEvents: 'none' };
}

// Traffic lights for apps that draw their own frame (GTK, Chromium, Firefox): macOS-style
// circles floating at the window's top-left, above the app's own bar. They stay out of the
// app's way (only the three small circles take clicks; everything else passes through),
// dim on blurred windows and show the ×, − and + glyphs on hover, like the standard frame.
function CsdLights({ win, t, focused }) {
  const [hover, setHover] = useState(false);
  return (
    <View onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onMouseDown={(e) => e.stopPropagation()}
      style={{ position: 'absolute', left: 9, top: 8, flexDirection: 'row', gap: 6, zIndex: 50,
        borderRadius: 9, padding: 2, pointerEvents: 'auto',
        backgroundColor: focused || hover ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.12)' }}>
      {LIGHTS.map((l) => (
        <View key={l.key} onMouseDown={(e) => e.stopPropagation()} onClick={() => l.act(win.id)}
          style={{ width: LIGHT - 1, height: LIGHT - 1, borderRadius: (LIGHT - 1) / 2, direction: 'ltr',
            backgroundColor: focused || hover ? l.color : t.lightOff }}>
          {hover && <LightGlyph l={l} />}
        </View>
      ))}
    </View>
  );
}

export function Window({ win, app, t, focused, fx }) {
  const drag = useRef(null);
  const [hover, setHover] = useState(false);
  const geo = wm.frame(win);
  const fxs = fxStyle(fx, geo);
  // opening fade: the window rises a little and fades in, unless motion is reduced —
  // a JS ramp because the engine has no style transitions (the minimize effect works the same way)
  const [s] = useSettings();
  const [enter, setEnter] = useState(() => (s?.reduceMotion ? 1 : 0));
  useEffect(() => {
    if (!enter || enter >= 1) return undefined;
    const iv = setInterval(() => setEnter((v) => Math.min(1, v + 0.2)), 16);
    return () => clearInterval(iv);
  }, []);
  const enterStyle = enter < 1 && !fx
    ? { opacity: 0.2 + 0.8 * enter, transform: `translateY(${Math.round((1 - enter) * 12)}px) scale(${(0.984 + 0.016 * enter).toFixed(3)})` }
    : null;

  // A maximized window is dragged out of its place by JS, but only once the pointer really moved: a
  // click on its bar (to bring it forward) jitters a pixel or two on a trackpad, or half a pixel at
  // 200 %, and that must not restore it to its own size.
  useEffect(() => {
    const offMove = addListener('pointermove', (e) => {
      const d = drag.current;
      if (!d) return;
      if (!d.moving) {
        if (Math.abs(e.x - d.x0) + Math.abs(e.y - d.y0) < DRAG_START) return;
        d.moving = true;
        // back to its own size, under the pointer where it was grabbed
        d.dx = Math.round(d.rel * win.w);
        d.dy = Math.min(TITLE_H / 2, d.y0 - geo.y);
      }
      wm.move(win.id, e.x - d.dx, e.y - d.dy);
    });
    const offUp = addListener('pointerup', () => { drag.current = null; });
    return () => { offMove(); offUp(); };
  }, [win.id, win.w, geo.y]);

  // Linux app that draws its own frame (GTK, Chromium and Firefox with their own bar): only the
  // content, with the theme's shadow. A right click on its bar asks for the window menu
  // (w.windowMenu): the same items as the menu bar's Window menu.
  if (win.args?.csd || app.ownFrame) {
    const wmenu = win.windowMenu;
    return (
      <WindowShell win={win} leaving={!!fx} onMouseDown={() => wm.focus(win.id)}
        style={[{ ...(app.ownFrame ? { borderRadius: win.maximized ? 0 : 12, overflow: 'hidden' } : null), boxShadow: focused ? '0 24px 56px rgba(0,0,0,0.5)' : '0 10px 28px rgba(0,0,0,0.3)', ...fxs }, enterStyle]}>
        <AppHost id={win.id} focused={focused} />
        {!win.fullscreen ? <CsdLights win={win} t={t} focused={focused} /> : null}
        {wmenu && (
          <Menu x={wmenu.x} y={wmenu.y} onClose={() => wm.closeWindowMenu(win.id)} items={[
            { label: tr('shell.window.minimize'), onClick: () => wm.minimize(win.id) },
            { label: tr('shell.window.maximize'), checked: !!win.maximized, onClick: () => wm.toggleMaximize(win.id) },
            { label: tr('shell.desktops.moveTo'), submenu: moveToDesktopItems(win.id) },
            '-',
            { label: tr('shell.window.close'), onClick: () => wm.close(win.id) },
          ]} />
        )}
      </WindowShell>
    );
  }

  return (
    <WindowShell win={win} leaving={!!fx} onMouseDown={() => wm.focus(win.id)} style={[{
      borderRadius: win.maximized ? 0 : 12, backgroundColor: app.transparent ? 'transparent' : t.windowBg, overflow: 'hidden',
      // a transparent app (the Terminal) has nothing behind its border: the border is drawn opaque
      border: `1px solid ${app.transparent ? solidOver(t.windowBorder, t.titleBg) : t.windowBorder}`,
      boxShadow: focused ? '0 24px 56px rgba(0,0,0,0.55)' : '0 10px 28px rgba(0,0,0,0.32)',
      ...fxs,
    }, enterStyle]}>
      <View onMouseDown={(e) => { if (!wm.beginMove(win.id)) drag.current = { x0: e.x, y0: e.y, rel: geo.w ? (e.x - geo.x) / geo.w : 0.5, moving: false }; }}
        onDoubleClick={() => wm.toggleMaximize(win.id)}
        style={{ height: TITLE_H, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, backgroundColor: t.titleBg }}>
        <Text style={{ position: 'absolute', left: 0, right: 0, top: 0, lineHeight: TITLE_H, textAlign: 'center',
          fontSize: 13, fontWeight: 600, color: focused ? t.text : t.textDim, pointerEvents: 'none', whiteSpace: 'nowrap',
          paddingHorizontal: 80 }}>{windowTitle(win)}</Text>
        <View onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
          style={{ flexDirection: 'row', gap: 8, paddingVertical: 6 }}>
          {LIGHTS.map((l) => (
            <View key={l.key} onMouseDown={(e) => e.stopPropagation()} onClick={() => l.act(win.id)}
              style={{ width: LIGHT, height: LIGHT, borderRadius: LIGHT / 2, direction: 'ltr',
                backgroundColor: focused || hover ? l.color : t.lightOff }}>
              {hover && <LightGlyph l={l} />}
            </View>
          ))}
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: app.transparent ? solidOver(t.separator, t.titleBg) : t.separator }} />
      <View style={{ flex: 1 }}><AppHost id={win.id} focused={focused} /></View>
    </WindowShell>
  );
}
