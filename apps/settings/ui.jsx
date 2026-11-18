// ui.jsx — the building blocks of every Settings page, on top of the SDK's GroupBox (docs/DESIGN.md,
// "Settings"): a page column, titled sections (inset grouped boxes with hairlines between rows),
// rows with the control or the value at the trailing edge, form rows, a pop-up button, a page header, badges and notes.
import { View, Text, useTheme, addListener, GroupBox as InsetBox, spacing, typeScale, createStore, useStore, screen, ScrollView, Overlay, useAppWindow, useWindows } from '@insaneos/sdk';
import { createElement as h, useEffect, useRef, useState } from 'react';


// Status colors used by the pages (standard system colors).
export const tint = { ok: '#30d158', warn: '#ff9f0a', error: '#ff453a', off: '#8e8e93' };

// A row of a GroupBox: label (and an optional hint below it) at the start, the control at the end.
// Rows are 28 px of content with 4 px above and below (36 px between hairlines), taller with a hint.
// stack: the control goes under the label instead of at the trailing edge (wide segmented controls).
export function SettingRow({ label, hint, children, icon, disabled, onClick, minHeight = 36, labelStyle, stack }) {
  const t = useTheme();
  return (
    <View onClick={disabled ? undefined : onClick} style={{ minHeight, flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingVertical: hint ? 7 : 4,
      opacity: disabled ? 0.45 : 1 }}>
      {icon || null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[{ fontSize: typeScale.body, color: t.text, textAlign: 'start' }, labelStyle]}>{label}</Text>
        {hint ? <Text style={{ fontSize: typeScale.caption, color: t.textDim, lineHeight: 1.35, textAlign: 'start' }}>{hint}</Text> : null}
        {stack && children != null && children !== false ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.s, marginTop: spacing.xs }}>{children}</View>
        ) : null}
      </View>
      {!stack && children != null && children !== false ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>{children}</View>
      ) : null}
    </View>
  );
}

// A key/value row: the label at the start, the value right-aligned in the secondary color.
export function ValueRow({ label, value, children, mono }) {
  const t = useTheme();
  return (
    <View style={{ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingVertical: 4 }}>
      <Text style={{ fontSize: typeScale.body, color: t.text, whiteSpace: 'nowrap', textAlign: 'start' }}>{label}</Text>
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.s }}>
        {value != null ? (
          <Text style={{ flex: 1, minWidth: 0, fontSize: typeScale.body, color: t.textDim, textAlign: 'end', whiteSpace: 'nowrap', overflow: 'hidden',
            ...(mono ? { fontFamily: 'monospace', fontSize: 12, direction: 'ltr' } : {}) }}>{String(value)}</Text>
        ) : null}
        {children}
      </View>
    </View>
  );
}

// A form row: the label at the start and a field of a fixed width at the trailing edge (forms
// inside a grouped box). The field shrinks in narrow windows.
export function FieldRow({ label, children, hint, width = 240 }) {
  const t = useTheme();
  return (
    <View style={{ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingVertical: 4 }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ fontSize: typeScale.body, color: t.text, textAlign: 'start' }}>{label}</Text>
        {hint ? <Text style={{ fontSize: typeScale.caption, color: t.textDim, textAlign: 'start' }}>{hint}</Text> : null}
      </View>
      <View style={{ width, flexShrink: 1, minWidth: 120, flexDirection: 'row', alignItems: 'center', gap: spacing.s, justifyContent: 'flex-end' }}>{children}</View>
    </View>
  );
}

// Buttons at the trailing edge, under a group or as the last row of one.
export function Actions({ children, start, style }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.s, justifyContent: start ? 'flex-start' : 'flex-end' }, style]}>
      {children}
    </View>
  );
}

// A titled section: a 13/600 header, the inset box and an optional footer.
// A section without rows (children) shows only its header and footer.
export function Section({ title, footer, children, accessory, icon, style }) {
  const t = useTheme();
  const rows = (Array.isArray(children) ? children.flat() : [children]).filter((c) => c != null && c !== false && c !== '');
  return (
    <View style={[{ gap: 6 }, style]}>
      {title || accessory ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s, minHeight: 22, paddingHorizontal: spacing.xs }}>
          {icon || null}
          <Text style={{ flex: 1, minWidth: 0, fontSize: typeScale.body, fontWeight: 600, color: t.text, textAlign: 'start' }}>{title || ''}</Text>
          {accessory || null}
        </View>
      ) : null}
      {rows.length ? <InsetBox>{rows}</InsetBox> : null}
      {footer ? <Note>{footer}</Note> : null}
    </View>
  );
}

// The hardware pages call it GroupBox (same props as the SDK's: title, footer, rows).
export const GroupBox = Section;

// Page header: a big icon, the title and one line of explanation (the top of a settings pane).
export function PageHeader({ icon, title, subtitle, children }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.l, padding: spacing.l, borderRadius: t.groupRadius,
      backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)', border: `1px solid ${t.separator}` }}>
      {icon}
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={{ fontSize: typeScale.headline, fontWeight: 600, color: t.text, textAlign: 'start' }}>{title}</Text>
        {subtitle ? <Text style={{ fontSize: typeScale.callout, color: t.textDim, lineHeight: 1.4, textAlign: 'start' }}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

// "#rrggbb" a bit lighter (f > 1) or darker (f < 1), for the badges' gradient.
export function shade(hex, f) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f)));
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('')}`;
}

// A rounded square with a glyph and a soft top-to-bottom gradient, as in the sidebar (also used in rows).
export function Badge({ glyph, color, size = 26, children }) {
  return (
    <View style={{ width: size, height: size, borderRadius: Math.round(size * 0.24), alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(180deg, ${shade(color, 1.18)}, ${color})` }}>
      {children || <Text style={{ fontSize: Math.round(size * 0.55), fontWeight: 600, color: '#fff', lineHeight: size, textAlign: 'center' }}>{glyph}</Text>}
    </View>
  );
}

// PaneGlyph — one drawn, monochrome pictogram per Settings section, shared by the sidebar and the
// pages that need the same pictures (Privacy's permissions, Network's devices…). Every glyph lives
// on the same 20×20 grid, drawn with 2-unit strokes (or fills of the same weight) and rounded caps
// in one color, so the set reads consistent — no unicode symbols whose weight and size vary with
// the font. The engine has no vector paths, so each glyph is a small composition of views; a new
// one is a case in the map below. size is the side of the square the glyph is drawn in.
export function PaneGlyph({ id, size = 14, color = '#fff' }) {
  const s = size / 20;                        // every coordinate below is a 20-unit grid fraction
  const bar = (x, y, w, h, r) => ({ position: 'absolute', left: x * s, top: y * s, width: w * s, height: h * s, borderRadius: (r === undefined ? 1 : r) * s, backgroundColor: color });
  const ring = (x, y, d, t) => ({ position: 'absolute', left: x * s, top: y * s, width: d * s, height: d * s, borderWidth: t * s, borderColor: color, borderRadius: (d * s) / 2 });
  const disc = (x, y, d) => ({ position: 'absolute', left: x * s, top: y * s, width: d * s, height: d * s, borderRadius: (d * s) / 2, backgroundColor: color });
  const turn = (deg) => ({ transform: `rotate(${deg}deg)` });
  const G = {
    general: () => [<View key="r" style={ring(2.5, 2.5, 15, 2)} />, <View key="d" style={bar(9, 5.5, 2, 2, 1)} />, <View key="s" style={bar(9, 9, 2, 6)} />],
    appearance: () => [<View key="r" style={ring(2.5, 2.5, 15, 2)} />,
      <View key="f" style={{ position: 'absolute', left: 4.5 * s, top: 4.5 * s, width: 5.5 * s, height: 11 * s, borderTopLeftRadius: 5.5 * s, borderBottomLeftRadius: 5.5 * s, backgroundColor: color }} />],
    wallpaper: () => [<View key="r" style={{ position: 'absolute', left: 2 * s, top: 4 * s, width: 16 * s, height: 12 * s, borderWidth: 2 * s, borderColor: color, borderRadius: 2.5 * s, overflow: 'hidden' }}>
      <View key="m" style={{ ...bar(-0.5, 1.5, 7, 7, 1), ...turn(45) }} />
      <View key="n" style={{ ...bar(4.5, 3.5, 5, 5, 1), ...turn(45) }} />
      <View key="u" style={bar(9.5, 0.5, 2, 2, 1)} />
    </View>],
    dock: () => [<View key="b" style={bar(1.5, 15, 17, 3, 1.5)} />, <View key="d1" style={bar(3, 9.5, 3, 3, 1)} />, <View key="d2" style={bar(8.5, 9.5, 3, 3, 1)} />, <View key="d3" style={bar(14, 9.5, 3, 3, 1)} />],
    display: () => [<View key="r" style={{ position: 'absolute', left: 2 * s, top: 3.5 * s, width: 16 * s, height: 11 * s, borderWidth: 2 * s, borderColor: color, borderRadius: 2.5 * s }} />,
      <View key="n" style={bar(8.5, 15.5, 3, 1.6)} />, <View key="b" style={bar(6, 17.4, 8, 1.6)} />],
    globe: () => [<View key="r" style={ring(2.5, 2.5, 15, 2)} />, <View key="h" style={bar(4, 9, 12, 2)} />,
      <View key="v" style={{ position: 'absolute', left: 7.5 * s, top: 2.5 * s, width: 5 * s, height: 15 * s, borderWidth: 2 * s, borderColor: color, borderRadius: 2.5 * s }} />],
    wifi: () => [<View key="a1" style={{ position: 'absolute', left: 3.5 * s, top: 7 * s, width: 13 * s, height: 6.5 * s, borderTopWidth: 2 * s, borderLeftWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6.5 * s, borderTopRightRadius: 6.5 * s, borderColor: color }} />,
      <View key="a2" style={{ position: 'absolute', left: 6.5 * s, top: 10.5 * s, width: 7 * s, height: 3.5 * s, borderTopWidth: 2 * s, borderLeftWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 3.5 * s, borderTopRightRadius: 3.5 * s, borderColor: color }} />,
      <View key="d" style={bar(8.5, 14, 3, 3, 1.5)} />],
    bt: () => [<View key="s" style={bar(9, 1.5, 2, 17)} />, <View key="a" style={{ ...bar(5, 6.5, 7, 2), ...turn(38) }} />, <View key="b" style={{ ...bar(8, 11.5, 7, 2), ...turn(-38) }} />],
    sound: () => [<View key="b1" style={bar(3.5, 7, 2.5, 6)} />, <View key="b2" style={bar(8.5, 4, 2.5, 12)} />, <View key="b3" style={bar(13.5, 8, 2.5, 4)} />],
    bell: () => [<View key="d" style={{ position: 'absolute', left: 4.5 * s, top: 3.5 * s, width: 11 * s, height: 9 * s, borderTopLeftRadius: 5.5 * s, borderTopRightRadius: 5.5 * s, backgroundColor: color }} />,
      <View key="l" style={bar(3, 12.5, 14, 2, 1)} />, <View key="c" style={bar(8.5, 16, 3, 2.5, 1.25)} />],
    printer: () => [<View key="p" style={bar(5.5, 2.5, 9, 3, 1)} />,
      <View key="b" style={{ position: 'absolute', left: 2.5 * s, top: 6.5 * s, width: 15 * s, height: 8 * s, borderWidth: 2 * s, borderColor: color, borderRadius: 2 * s }} />,
      <View key="s" style={bar(6, 9.5, 8, 2, 1)} />, <View key="o" style={bar(5.5, 15, 9, 3, 1)} />],
    clipboard: () => [<View key="b" style={{ position: 'absolute', left: 3.5 * s, top: 3 * s, width: 13 * s, height: 14.5 * s, borderWidth: 2 * s, borderColor: color, borderRadius: 2 * s }} />,
      <View key="c" style={bar(7, 1.5, 6, 3.5, 1.5)} />, <View key="l1" style={bar(6.5, 8, 7, 1.8, 0.9)} />, <View key="l2" style={bar(6.5, 11, 5, 1.8, 0.9)} />],
    share: () => [<View key="a" style={bar(2.5, 5.5, 11, 2, 1)} />, <View key="h1" style={{ ...bar(11, 3.5, 6, 6, 1), ...turn(45) }} />,
      <View key="b" style={bar(6.5, 12.5, 11, 2, 1)} />, <View key="h2" style={{ ...bar(3, 10.8, 6, 6, 1), ...turn(45) }} />],
    cloud: () => [<View key="c1" style={disc(3.5, 8.5, 7)} />, <View key="c2" style={disc(7, 5.5, 8)} />, <View key="c3" style={disc(11.5, 8.5, 6.5)} />, <View key="b" style={bar(3.5, 12.5, 13.5, 3.5, 1.75)} />],
    language: () => [<View key="l" style={{ ...bar(4.5, 3, 2.2, 13.5), ...turn(-14) }} />, <View key="r" style={{ ...bar(13.3, 3, 2.2, 13.5), ...turn(14) }} />, <View key="c" style={bar(6, 10.5, 8, 2.2, 1)} />],
    clock: () => [<View key="r" style={ring(2.5, 2.5, 15, 2)} />, <View key="h" style={bar(9.1, 5.5, 1.8, 5.5, 0.9)} />, <View key="m" style={bar(9.1, 9.2, 5, 1.8, 0.9)} />],
    keyboard: () => [<View key="r" style={{ position: 'absolute', left: 1.5 * s, top: 5 * s, width: 17 * s, height: 10 * s, borderWidth: 2 * s, borderColor: color, borderRadius: 2 * s }} />,
      ...[4, 6.6, 9.2, 11.8, 14.4].map((x, i) => <View key={`k${i}`} style={bar(x, 7.5, 1.6, 1.6, 0.8)} />), <View key="sp" style={bar(5.5, 11, 9, 1.8, 0.9)} />],
    trackpad: () => [<View key="r" style={{ position: 'absolute', left: 2.5 * s, top: 2.5 * s, width: 15 * s, height: 15 * s, borderWidth: 2 * s, borderColor: color, borderRadius: 2.5 * s }} />, <View key="l" style={bar(4.5, 11.5, 11, 1.8, 0.9)} />],
    grid: () => [<View key="a" style={bar(2.5, 2.5, 6.5, 6.5, 1.5)} />, <View key="b" style={bar(11, 2.5, 6.5, 6.5, 1.5)} />, <View key="c" style={bar(2.5, 11, 6.5, 6.5, 1.5)} />, <View key="d" style={bar(11, 11, 6.5, 6.5, 1.5)} />],
    ai: () => [<View key="v" style={{ ...bar(6.5, 1, 7, 18, 1), ...turn(45) }} />, <View key="h" style={{ ...bar(1, 6.5, 18, 7, 1), ...turn(45) }} />],
    power: () => [<View key="t" style={bar(8, 1.5, 4, 8, 1)} />, <View key="m" style={bar(5.5, 8, 9, 2.6, 1)} />, <View key="b" style={bar(7.5, 9.5, 4, 9, 1)} />],
    cooling: () => [0, 120, 240].map((r, i) => (
      <View key={`f${i}`} style={{ position: 'absolute', left: 0, top: 0, width: 20 * s, height: 20 * s, ...turn(r) }}>
        <View style={{ position: 'absolute', left: 8 * s, top: 0.5 * s, width: 4.5 * s, height: 7 * s, borderTopRightRadius: 4.5 * s, borderTopLeftRadius: 1.5 * s, borderBottomRightRadius: 1.5 * s, backgroundColor: color }} />
      </View>
    )).concat([<View key="h" style={disc(8.25, 8.25, 3.5)} />]),
    firmware: () => [<View key="b" style={bar(6, 6, 8, 8, 1.5)} />,
      ...[4, 8.5, 13].flatMap((y, i) => [<View key={`l${i}`} style={bar(1, y, 4, 1.8, 0.9)} />, <View key={`r${i}`} style={bar(15, y, 4, 1.8, 0.9)} />])],
    lock: () => [<View key="s" style={{ position: 'absolute', left: 6 * s, top: 2.5 * s, width: 8 * s, height: 9 * s, borderWidth: 2 * s, borderBottomWidth: 0, borderColor: color, borderTopLeftRadius: 4 * s, borderTopRightRadius: 4 * s }} />,
      <View key="b" style={bar(3.5, 8, 13, 9, 2)} />],
    users: () => [<View key="h" style={disc(6.5, 3, 7)} />, <View key="s" style={{ position: 'absolute', left: 3.5 * s, top: 11.5 * s, width: 13 * s, height: 6.5 * s, borderTopLeftRadius: 6.5 * s, borderTopRightRadius: 6.5 * s, backgroundColor: color }} />],
    updates: () => [<View key="s" style={bar(9, 2.5, 2, 8)} />, <View key="h" style={{ ...bar(6.8, 8.5, 6.4, 6.4, 1), ...turn(45) }} />,
      <View key="t" style={bar(3, 15.5, 14, 2, 1)} />, <View key="l" style={bar(3, 12, 2, 5, 1)} />, <View key="r" style={bar(15, 12, 2, 5, 1)} />],
    session: () => [<View key="r" style={{ position: 'absolute', left: 2.5 * s, top: 2.5 * s, width: 15 * s, height: 15 * s, borderWidth: 2 * s, borderTopWidth: 0, borderColor: color, borderRadius: (15 * s) / 2 }} />, <View key="s" style={bar(9, 1, 2, 8)} />],
    camera: () => [<View key="b" style={{ position: 'absolute', left: 1.5 * s, top: 4.5 * s, width: 17 * s, height: 12 * s, borderWidth: 2 * s, borderColor: color, borderRadius: 2.5 * s }} />,
      <View key="v" style={bar(6.5, 2.5, 7, 3, 1.5)} />, <View key="l" style={disc(7.5, 8, 5)} />],
    mic: () => [<View key="c" style={{ position: 'absolute', left: 6.5 * s, top: 2 * s, width: 7 * s, height: 11 * s, borderWidth: 2 * s, borderColor: color, borderRadius: 3.5 * s }} />,
      <View key="a" style={{ position: 'absolute', left: 4 * s, top: 7 * s, width: 12 * s, height: 9 * s, borderTopWidth: 0, borderLeftWidth: 2 * s, borderRightWidth: 2 * s, borderBottomWidth: 2 * s, borderBottomLeftRadius: 6 * s, borderBottomRightRadius: 6 * s, borderColor: color }} />,
      <View key="s" style={bar(9, 16, 2, 3)} />],
    folder: () => [<View key="t" style={bar(2, 4, 7, 3, 1)} />, <View key="b" style={bar(2, 6, 16, 10.5, 2)} />],
    usb: () => [<View key="h" style={{ ...bar(6.8, 1, 6.4, 6.4, 1), ...turn(45) }} />, <View key="s" style={bar(9, 4, 2, 12)} />,
      <View key="l" style={{ ...bar(4, 5.5, 2, 6.5), ...turn(22) }} />, <View key="r" style={{ ...bar(14, 5.5, 2, 6.5), ...turn(-22) }} />,
      <View key="e1" style={bar(2.2, 4, 2.6, 2.6, 0.8)} />, <View key="e2" style={bar(15.2, 4, 2.6, 2.6, 0.8)} />, <View key="e3" style={bar(7.75, 14.5, 4.5, 4.5, 1)} />],
    statusitem: () => [<View key="r" style={ring(3, 3, 14, 2)} />, <View key="n" style={{ ...bar(9, 9.2, 6.5, 2), ...turn(-40) }} />],
  };
  const draw = G[id] || G.grid;
  return <View style={{ width: size, height: size, direction: 'ltr' }}>{draw().filter(Boolean)}</View>;
}

// Columns — two columns of sections on a wide window (the page opts in; the shared answer to the
// maximized dead space, not a per-page hack). Under the threshold, or with fewer than two pieces,
// the children simply stack as they always did. The threshold is the window's width: the sidebar
// and the page paddings come out of it before the content is measured.
export function Columns({ children, min = 1080 }) {
  const win = useAppWindow();
  const ws = useWindows();                 // { windows, visible, mounted, focused, desktop }
  const w = (ws.windows.find((x) => x.id === win?.id) || {}).w || 0;
  const kids = (Array.isArray(children) ? children.flat() : [children]).filter((c) => c != null && c !== false);
  if (!w || w < min || kids.length < 2) return <View style={{ gap: 20 }}>{kids}</View>;
  const half = Math.ceil(kids.length / 2);
  const col = (list) => <View style={{ flex: 1, minWidth: 0, gap: 20 }}>{list}</View>;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 20 }}>
      {col(kids.slice(0, half))}
      {col(kids.slice(half))}
    </View>
  );
}

// Informational text under a group, or a warning (tone 'warn') or an error/success message
// (tone 'error' / 'ok').
export function Note({ children, tone, style }) {
  const t = useTheme();
  const color = tone === 'warn' ? tint.warn : tone === 'error' ? tint.error : tone === 'ok' ? tint.ok : t.textDim;
  return <Text style={[{ fontSize: typeScale.caption, color, lineHeight: 1.4, marginHorizontal: spacing.xs, textAlign: 'start' }, style]}>{children}</Text>;
}

// A result message ({ ok, text }) under a group.
export const Message = ({ msg }) => (msg ? <Note tone={msg.ok ? 'ok' : 'error'}>{msg.text}</Note> : null);

// A short status line with a colored dot (connected, off…).
export function StatusDot({ color, size = 8 }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

// The page: a column of sections 20 px apart. It also hosts the open pop-up menu (PopUpLayer), which
// draws itself in the overlay layer (sdk/layers.js).
export function Stack({ children, gap = 20 }) {
  return (
    <View style={{ gap, paddingBottom: 24 }}>
      {children}
      <PopUpLayer />
    </View>
  );
}

const popup = createStore(null);       // { node, options, value, onChange, width }

// Pop-up button: shows the current value with ▲▼ and opens the list of options below it (or above,
// near the bottom of the screen). options = [[value, label]]; a value of '-' is a separator.
export function PopUp({ value, options, onChange, width = 190, disabled }) {
  const t = useTheme();
  const [hover, setHover] = useState(false);
  const btn = useRef(null);
  const open = useStore(popup, (p) => !!p && p.node === btn.current);
  useEffect(() => () => { if (popup.get()?.node === btn.current) popup.set(null); }, []);
  const cur = options.find(([v]) => v === value);
  const toggle = () => { if (disabled) return; popup.set(open ? null : { node: btn.current, options, value, onChange, width }); };
  return (
    <View ref={btn} onClick={toggle} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ width, height: 24, paddingHorizontal: 9, borderRadius: t.controlRadiusSmall, flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: t.control, opacity: disabled ? 0.45 : hover || open ? 0.88 : 1, boxShadow: '0 1px 1px rgba(0,0,0,0.12)',
        ...(t.buttonBorder ? { border: `1px solid ${t.separator}` } : null) }}>
      {cur && cur[2] ? h(cur[2], { size: 16 }) : null}
      <Text style={{ flex: 1, fontSize: 12, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textAlign: 'start' }}>{cur ? cur[1] : ''}</Text>
      {t.menuHighlight === 'subtle'
        // a drawn chevron (the themes with subtle menus, such as Classic)
        ? <View style={{ width: 16, height: 18, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 6, height: 6, marginTop: -3, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderColor: t.textDim, transform: 'rotate(45deg)' }} />
        </View>
        : <View style={{ width: 16, height: 18, borderRadius: 4, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 8, color: '#fff', lineHeight: 8 }}>▲</Text>
          <Text style={{ fontSize: 8, color: '#fff', lineHeight: 8 }}>▼</Text>
        </View>}
    </View>
  );
}

function PopUpLayer() {
  const t = useTheme();
  const p = useStore(popup);
  const menu = useRef(null);
  useEffect(() => {
    if (!p) return undefined;
    return addListener('pointerdown', (e) => {
      const inside = (n) => { if (!n) return false; const [x, y, w, h] = insane.getLayout(n.id); return e.x >= x && e.x <= x + w && e.y >= y && e.y <= y + h; };
      if (!inside(menu.current) && !inside(p.node)) popup.set(null);
    });
  }, [p]);
  if (!p || !p.node) return null;
  const [, by, bw, bh] = insane.getLayout(p.node.id);
  const rows = p.options.length;
  const mh = rows * 24 + 12;
  const below = by + bh + 4 + Math.min(mh, 320) < screen.height - 70;
  const height = Math.min(mh, 320);
  // in the overlay layer (sdk/layers.js), placed against the button: above the rows below it and
  // not clipped by the page's scroll view
  return (
    <Overlay anchor={p.node}>
      <View ref={menu} style={{ position: 'absolute', left: 0, top: below ? bh + 4 : -4 - height, width: Math.max(bw, p.width), height, padding: 5, borderRadius: t.menuRadius, overflow: 'hidden',
        backgroundColor: t.popupBg || (t.mode === 'dark' ? '#2c2c31' : '#ffffff'), border: `1px solid ${t.separator}`, boxShadow: '0 10px 30px rgba(0,0,0,0.35)' }}>
        <ScrollView style={{ flex: 1 }}>
          {p.options.map(([v, label], i) => (v === '-' ? <View key={`s${i}`} style={{ height: 1, marginVertical: 4, marginHorizontal: 6, backgroundColor: t.separator }} />
            : <PopRow key={String(v)} label={label} Icon={p.options[i][2]} checked={v === p.value} onClick={() => { popup.set(null); if (v !== p.value) p.onChange(v); }} />))}
        </ScrollView>
      </View>
    </Overlay>
  );
}

function PopRow({ label, checked, onClick, Icon }) {
  const t = useTheme();
  const [lit, setHover] = useState(false);
  const hover = lit && t.menuHighlight !== 'subtle';
  return (
    <View onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ height: 24, paddingHorizontal: 6, borderRadius: t.menuItemRadius, flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: hover ? t.accent : lit ? t.hover : 'transparent' }}>
      <Text style={{ width: 14, fontSize: 11, color: hover ? '#fff' : checked && !hover && t.menuHighlight === 'subtle' ? t.accent : t.text }}>{checked ? '✓' : ''}</Text>
      {Icon ? <Icon size={16} /> : null}
      <Text style={{ flex: 1, fontSize: 12, whiteSpace: 'nowrap', color: hover ? '#fff' : t.text, textAlign: 'start' }}>{label}</Text>
    </View>
  );
}

// "HH:MM" ↔ minutes after midnight, and a compact time field made of two steppers.
export const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function TimeField({ value, onChange, format }) {
  const t = useTheme();
  const step = (d) => onChange((((value + d) % 1440) + 1440) % 1440);
  const Arrow = ({ glyph, d }) => (
    <View onClick={() => step(d)} style={{ width: 16, height: 11, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 7, color: t.textDim }}>{glyph}</Text>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, direction: 'ltr' }}>
      <View style={{ height: 24, minWidth: 66, paddingHorizontal: 8, borderRadius: 6, backgroundColor: t.control, justifyContent: 'center' }}>
        <Text style={{ fontSize: 12, color: t.text, textAlign: 'center' }}>{format ? format(value) : hhmm(value)}</Text>
      </View>
      <View>
        <Arrow glyph="▲" d={15} />
        <Arrow glyph="▼" d={-15} />
      </View>
    </View>
  );
}
