// Window frame: draggable title bar, traffic lights, shadow. The content is the app
// (the SDK's AppHost); the theme only decides how the frame looks. Moving and resizing (invisible
// borders on all 4 sides and 4 corners, <WindowShell>) is done by insane-server in C
// (docs/WINDOWS.md); the JS drag below is only kept for a maximized window.
import { View, Text, addListener, wm, AppHost, windowTitle, WindowShell, moveToDesktopItems, t as tr, solidOver, useSettings, DUR, easeOutCubic, useTween , moveResizeItems } from '@insaneos/sdk';
import { useEffect, useRef, useState } from 'react';
import { Menu } from './Menu.jsx';

const TITLE_H = 40;
const DRAG_START = 6;      // px the pointer moves before a maximized window is dragged out
const LIGHT = 13;          // a traffic light's diameter
const HIT = 24;            // a traffic light's click target (round 4): the circle sits centred in it,
                           // neighbours overlap by 3 px so the visible gap stays 8 px
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

// fx: the minimize effect, on its way into the Dock icon.
//   genie: { p, x, y, w, h } — the icon's rect: the engine warps the window's cached raster into
//   it strip by strip (insane-server paint.c → canvas_genie_blit); no transform here.
//   fade: reduce motion — a plain fade, no geometry moves.
//   otherwise the fallback shrink: transform + opacity towards (x, y).
function fxStyle(fx, geo) {
  if (!fx) return null;
  if (fx.genie) return { genieP: fx.p, genieX: fx.x, genieY: fx.y, genieW: fx.w, genieH: fx.h, pointerEvents: 'none' };
  if (fx.fade) return { opacity: 1 - fx.p, pointerEvents: 'none' };
  const e = fx.p * fx.p;                                // ease-in
  const dx = (fx.x - (geo.x + geo.w / 2)) * e, dy = (fx.y - (geo.y + geo.h / 2)) * e;
  return { transform: `translate(${dx}px, ${dy}px) scale(${1 - 0.9 * e})`, opacity: 1 - 0.7 * e, pointerEvents: 'none' };
}

// Traffic lights for apps that draw their own frame (GTK, Chromium, Firefox): macOS-style
// circles floating at one end of the window's top edge, above the app's own bar. They stay out of the
// app's way (only the three small circles take clicks; everything else passes through),
// dim on blurred windows and show the ×, − and + glyphs on hover (or always: Settings →
// Appearance → Window Controls), like the standard frame.
function CsdLights({ win, t, focused, lights }) {
  const [hover, setHover] = useState(false);
  const glyphP = useTween((hover || lights?.glyphs === 'always') ? 1 : 0, { dur: DUR.hover });
  if (!lights.on) return null;
  return (
    <View onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onMouseDown={(e) => e.stopPropagation()}
      style={{ position: 'absolute', [lights.side]: 2, top: 6, flexDirection: 'row', zIndex: 50, padding: 1, borderRadius: 13, pointerEvents: 'auto',
        backgroundColor: focused || hover ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.12)' }}>
      {LIGHTS.map((l) => (
        <View key={l.key} onMouseDown={(e) => e.stopPropagation()} onClick={() => l.act(win.id)}
          style={{ width: HIT, height: HIT, marginHorizontal: -3, justifyContent: 'center', alignItems: 'center', direction: 'ltr' }}>
          <View style={{ width: LIGHT - 1, height: LIGHT - 1, borderRadius: (LIGHT - 1) / 2,
            backgroundColor: focused || hover ? l.color : t.lightOff }}>
            <View style={{ width: LIGHT - 1, height: LIGHT - 1, justifyContent: 'center', alignItems: 'center', opacity: glyphP }}>
              <LightGlyph l={l} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// Glass windows (0.8.8.8): an app whose manifest says "glass": true (Settings) gets a
// translucent background and a real backdrop blur, so the wallpaper — the live video — shows
// through faintly. The engine's backdrop blur samples the same canvas the wallpaper paints
// into (insane-server src/ui/paint.c), and it reads a margin of twice the radius, so the
// rounded corners take colour from outside like CSS. Sliders: Settings → Wallpaper → Glass.
function hexA(hex, a) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return hex;                                       // non-hex token: leave as it is
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
}
function glassPrefs(s) {
  const on = s.effects !== false;
  const t = on ? Math.max(0, Math.min(1, Number.isFinite(s.glassTransparency) ? s.glassTransparency : 0.3)) : 0;
  const blur = on ? Math.max(0, Math.min(64, Number.isFinite(s.glassBlur) ? Math.round(s.glassBlur) : 24)) : 0;
  const sat = on && blur ? Math.max(1, Math.min(2, Number.isFinite(s.glassSaturate) ? s.glassSaturate : 1.2)) : 1;
  // a window is bigger than a widget: it starts fully opaque and the slider pulls it towards
  // 30 % alpha, so 30 % transparency (the default) reads clearly as glass but stays readable
  const alpha = Math.max(0.25, 1 - 0.7 * t);
  return { on: on && blur > 0, alpha, blur, sat };
}

export function Window({ win, app, t, focused, fx }) {
  const drag = useRef(null);
  const [hover, setHover] = useState(false);
  const [s] = useSettings();
  // the traffic lights (Settings → Appearance → Window Controls): shown, at which end of the
  // title bar, and whether the × − + symbols wait for a hover or are always there.
  // Before the tween below reads it — declared after its use, every window frame threw
  // "lights is not initialized" at render (round 4 regression, dead sessions hid it).
  const lights = { on: !s || s.windowLights !== false, side: s?.windowLightsSide === 'right' ? 'right' : 'left',
    glyphs: s?.windowLightsGlyphs === 'always' ? 'always' : 'hover' };
  const glyphP = useTween((hover || lights?.glyphs === 'always') ? 1 : 0, { dur: DUR.hover });
  const geo = wm.frame(win);
  const fxs = fxStyle(fx, geo);
  // opening: the window rises from below and fades in, the motion reference's measured entrance
  // (~250 ms, a real rise, no scale wobble) — a JS ramp because the engine has no style transitions
  const [enter, setEnter] = useState(() => (s?.reduceMotion ? 1 : 0));
  // the close animation: the window drops away and fades, faster than it came (wm.close keeps it for DUR.close)
  const [closeP, setCloseP] = useState(0);
  useEffect(() => {
    if (!win.closing) return undefined;
    setCloseP(0);
    const t0 = performance.now();
    const iv = setInterval(() => setCloseP(Math.min(1, (performance.now() - t0) / DUR.close)), 16);
    return () => clearInterval(iv);
  }, [win.closing]);
  const glass = !win.fullscreen && !win.maximized && app.glass ? glassPrefs(s || {}) : { on: false, alpha: 1, blur: 0 };
  useEffect(() => {
    if (enter >= 1) return undefined;               // reduce motion starts at 1: no animation
    const t0 = performance.now();                   // a time-based ramp: DUR.open from mount
    const iv = setInterval(() => setEnter((v) => {
      const k = Math.min(1, (performance.now() - t0) / DUR.open);
      return k >= 1 ? 1 : Math.max(v, easeOutCubic(k));
    }), 16);
    return () => clearInterval(iv);
  }, []);
  const enterStyle = enter < 1 && !fx
    ? { opacity: enter, transform: `translateY(${Math.round((1 - enter) * 44)}px)` }
    : null;
  const closeStyle = win.closing
    ? { opacity: 1 - closeP, transform: `translateY(${Math.round(closeP * 16)}px)`, pointerEvents: 'none' }
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
        style={[{ ...(app.ownFrame ? { borderRadius: win.maximized ? 0 : 12, overflow: 'hidden' } : null), boxShadow: focused ? t.shadowWindow : t.shadowWindowDim, ...fxs }, enterStyle, closeStyle]}>
        <AppHost id={win.id} focused={focused} />
        {!win.fullscreen ? <CsdLights win={win} t={t} focused={focused} lights={lights} /> : null}
        {wmenu && (
          <Menu x={wmenu.x} y={wmenu.y} onClose={() => wm.closeWindowMenu(win.id)} items={[
            { label: tr('shell.window.minimize'), onClick: () => wm.minimize(win.id) },
            { label: tr('shell.window.maximize'), checked: !!win.maximized, onClick: () => wm.toggleMaximize(win.id) },
            { label: tr('shell.window.center') || 'Center', onClick: () => wm.center(win.id) },
            { label: tr('shell.window.moveResize') || 'Move & Resize', submenu: moveResizeItems(win.id) },
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
      borderRadius: win.maximized ? 0 : 12, backgroundColor: app.transparent ? 'transparent' : (glass.on ? hexA(t.windowBg, glass.alpha) : t.windowBg), overflow: 'hidden',
      backdropFilter: glass.on ? `blur(${glass.blur}px) saturate(${glass.sat})` : undefined,
      // a transparent app (the Terminal) has nothing behind its border: the border is drawn opaque
      border: `1px solid ${app.transparent ? solidOver(t.windowBorder, t.titleBg) : t.windowBorder}`,
      boxShadow: focused ? t.shadowWindow : t.shadowWindowDim,
      ...fxs,
    }, enterStyle, closeStyle]}>
      <View onMouseDown={(e) => { if (!wm.beginMove(win.id)) drag.current = { x0: e.x, y0: e.y, rel: geo.w ? (e.x - geo.x) / geo.w : 0.5, moving: false }; }}
        onDoubleClick={() => wm.toggleMaximize(win.id)}
        style={{ height: TITLE_H, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, backgroundColor: glass.on ? hexA(t.titleBg, glass.alpha * 0.55) : t.titleBg }}>
        <Text style={{ position: 'absolute', left: 0, right: 0, top: 0, lineHeight: TITLE_H, textAlign: 'center',
          fontSize: 13, fontWeight: 600, color: focused ? t.text : t.textDim, pointerEvents: 'none', whiteSpace: 'nowrap',
          paddingHorizontal: 80 }}>{windowTitle(win)}</Text>
        {lights.on && (
          <View onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
            style={{ position: 'absolute', top: 0, bottom: 0, [lights.side]: 10, flexDirection: 'row', alignItems: 'center' }}>
            {LIGHTS.map((l) => (
              <View key={l.key} onMouseDown={(e) => e.stopPropagation()} onClick={() => l.act(win.id)}
                style={{ width: HIT, height: HIT, marginHorizontal: -1.5, justifyContent: 'center', alignItems: 'center', direction: 'ltr' }}>
                <View style={{ width: LIGHT, height: LIGHT, borderRadius: LIGHT / 2,
                  backgroundColor: focused || hover ? l.color : t.lightOff }}>
                  <View style={{ width: LIGHT, height: LIGHT, justifyContent: 'center', alignItems: 'center', opacity: glyphP }}>
                    <LightGlyph l={l} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
      <View style={{ height: 1, backgroundColor: app.transparent ? solidOver(t.separator, t.titleBg) : t.separator }} />
      <View style={{ flex: 1 }}><AppHost id={win.id} focused={focused} /></View>
    </WindowShell>
  );
}
