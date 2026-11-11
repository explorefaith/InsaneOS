#!/usr/bin/env python3
"""
gen-brand-insane.py — the Insane OS mark and wordmark, rendered with nothing but the standard library.

Design: a clean apple silhouette (body, stem, leaf) with an amber → orange → deep-orange radial
gradient and a soft gloss, on the app icon's dark rounded square. The "Insane OS" wordmark paths
come straight from the brand face (assets/fonts/PlusJakartaSans-ExtraBold.ttf, parsed here: cmap,
loca, glyf, hmtx) — the same face sdk/logo.js draws live. The same vectors are exported as SVG
(assets/brand/) and rasterized to the PNGs (assets/icons/, tools/boot/plymouth/insaneos/,
tools/iso/grub/insaneos/, docs/brand/png/) — asset file names are kept, so nothing else changes.

    python3 tools/gen-brand-insane.py          # write SVGs + render all PNGs

No third-party modules: PNG via zlib, rasterizing by scanline, TrueType by hand.
"""
import os, struct, sys, zlib, math

REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
BRAND = os.path.join(REPO, 'assets', 'brand')
ICONS = os.path.join(REPO, 'assets', 'icons')
DOCS_PNG = os.path.join(REPO, 'docs', 'brand', 'png')
FONT = os.path.join(REPO, 'assets', 'fonts', 'PlusJakartaSans-ExtraBold.ttf')

# ---- colours ----
CORE = (255, 178, 74)      # amber heart
MID = (247, 112, 28)       # orange (the brand colour)
EDGE = (196, 58, 8)        # deep orange
BG_DARK = (24, 13, 9)      # app-icon rounded square (warm dark)
GLOSS = (255, 255, 255)
BAR_HI = (255, 154, 60)    # boot progress bar: start cap → end
BAR_LO = (235, 92, 20)
GLOW_RGB = (255, 122, 34)  # splash glow; particle tints below keep the old file names
AMBER = (255, 186, 92)
WHITE = (240, 240, 255)
BG_TOP, BG_BOTTOM = (18, 18, 42), (11, 11, 28)          # splash / menu background, navy
INK_DARK = (255, 255, 255)     # wordmark ink on dark backgrounds
INK_LIGHT = (18, 18, 42)       # wordmark ink on light backgrounds
GRUB_VIOLET = (247, 112, 28)   # menu selection fill (was violet)
GRUB_LILAC = (255, 154, 60)    # menu selection stroke (was lilac)

CX, CY = 256.0, 252.0          # gradient centre (the apple's visual centre)

# ---- the apple: body + stem + leaf, in the 512 design box ----
def body_points():
    right = [(256, 132), (294, 110), (336, 100), (376, 106), (408, 124), (432, 154),
             (446, 196), (449, 244), (443, 296), (429, 346), (406, 390), (374, 424),
             (336, 450), (298, 464), (268, 468)]
    pts = list(right)
    for x, y in reversed(right[1:-1]):
        pts.append((512 - x, y))
    return pts

def stem_points():
    return [(244, 134), (250, 100), (256, 64), (274, 62), (266, 104), (262, 136)]

def _quad(p0, p1, p2, n=14):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])
            for t in (i / n for i in range(n + 1))]

def leaf_points():
    # a pointed leaf from base B up-right to tip T, two quadratic arcs
    B, T = (282, 106), (392, 28)
    up = _quad(B, (368, 44), T)
    dn = _quad(T, (300, 124), B)
    return up + dn[1:-1]

SHAPES = (body_points(), stem_points(), leaf_points())

def lerp(a, b, t): return a + (b - a) * t

def grad(t):
    """radial gradient: 0 core → 1 edge"""
    t = max(0.0, min(1.0, t))
    if t < 0.42:
        u = t / 0.42
        return tuple(lerp(CORE[i], MID[i], u) for i in range(3))
    u = (t - 0.42) / 0.58
    return tuple(lerp(MID[i], EDGE[i], u) for i in range(3))

# ---------------------------------------------------------------- TrueType ----
class Face:
    """The slice of TrueType we need: cmap format 4, glyf simple glyphs, hmtx, head."""
    def __init__(self, path):
        d = open(path, 'rb').read()
        n = struct.unpack('>H', d[4:6])[0]
        tables = {}
        for i in range(n):
            off = 12 + 16 * i
            tag = d[off:off + 4]
            toff, tlen = struct.unpack('>II', d[off + 8:off + 16])
            tables[tag] = (toff, tlen)
        self.d = d
        th, thlen = tables[b'head']
        self.units_per_em = struct.unpack('>H', d[th + 18:th + 20])[0]
        self.index_to_loc = struct.unpack('>h', d[th + 50:th + 52])[0]
        tm = tables[b'maxp'][0]
        self.num_glyphs = struct.unpack('>H', d[tm + 4:tm + 6])[0]
        nhm = struct.unpack('>H', d[tm + 34:tm + 36])[0]     # numberOfHMetrics
        tc = tables[b'cmap'][0]
        ntab = struct.unpack('>H', d[tc + 2:tc + 4])[0]
        best = None
        best_rank = -1
        for i in range(ntab):
            pid, eid, off = struct.unpack('>HHI', d[tc + 4 + 8 * i:tc + 12 + 8 * i])
            fmt = struct.unpack('>H', d[tc + off:tc + off + 2])[0]
            if fmt != 4:
                continue
            rank = {(3, 1): 3, (0, 3): 2, (0, 4): 2, (0, 6): 2}.get((pid, eid), 1)
            if rank > best_rank:
                best, best_rank = tc + off, rank
        assert best is not None, 'no usable format 4 cmap'
        segx2 = struct.unpack('>H', d[best + 6:best + 8])[0]
        seg = segx2 // 2
        ends = struct.unpack(f'>{seg}H', d[best + 14:best + 14 + segx2])
        starts = struct.unpack(f'>{seg}H', d[best + 16 + segx2:best + 16 + 2 * segx2])
        deltas = struct.unpack(f'>{seg}h', d[best + 16 + 2 * segx2:best + 16 + 3 * segx2])
        rng_base = best + 16 + 3 * segx2
        self.cmap = {}
        for i in range(seg - 1):
            for c in range(starts[i], ends[i] + 1):
                ro = struct.unpack('>H', d[rng_base + 2 * i:rng_base + 2 * i + 2])[0]
                if ro:
                    # glyphIdArray: address relative to the idRangeOffset entry itself; no delta
                    addr = rng_base + 2 * i + ro + 2 * (c - starts[i])
                    gi = struct.unpack('>H', d[addr:addr + 2])[0]
                else:
                    gi = (c + deltas[i]) & 0xFFFF
                if gi:
                    self.cmap[c] = gi
        self.loca_off, loca_len = tables[b'loca']
        self.glyf_off, _ = tables[b'glyf']
        # trust the table length over the header field: this font's header says long, its loca is short
        if loca_len == 2 * (self.num_glyphs + 1):
            self.index_to_loc = 1
        elif loca_len == 4 * (self.num_glyphs + 1):
            self.index_to_loc = 0
        thm = tables[b'hmtx'][0]
        self.adv = {}
        for g in range(self.num_glyphs):
            i = min(g, nhm - 1)
            self.adv[g] = struct.unpack('>H', d[thm + 4 * i:thm + 4 * i + 2])[0]

    def glyph(self, ch):
        gi = self.cmap[ord(ch)]
        if self.index_to_loc == 0:
            o = struct.unpack('>I', self.d[self.loca_off + 4 * gi:self.loca_off + 4 * gi + 4])[0]
            o2 = struct.unpack('>I', self.d[self.loca_off + 4 * gi + 4:self.loca_off + 4 * gi + 8])[0]
        else:
            o = struct.unpack('>H', self.d[self.loca_off + 2 * gi:self.loca_off + 2 * gi + 2])[0] * 2
            o2 = struct.unpack('>H', self.d[self.loca_off + 2 * gi + 2:self.loca_off + 2 * gi + 4])[0] * 2
        adv = self.adv[gi]
        if o == o2:
            return (0, 0, 0, 0, [], adv)
        g = self.glyf_off + o
        nc, xmin, ymin, xmax, ymax = struct.unpack('>hhhhh', self.d[g:g + 10])
        endpts = struct.unpack(f'>{nc}H', self.d[g + 10:g + 10 + 2 * nc])
        ni = endpts[-1] + 1
        ins = struct.unpack('>h', self.d[g + 10 + 2 * nc:g + 12 + 2 * nc])[0]
        p = g + 12 + 2 * nc + ins
        flags = []
        while len(flags) < ni:
            f = self.d[p]; p += 1
            flags.append(f)
            if f & 8:
                rep = self.d[p]; p += 1
                flags += [f] * rep
        xs, x = [], 0
        for f in flags:
            if f & 2:
                dx = self.d[p]; p += 1
                x += dx if f & 16 else -dx
            elif not f & 16:
                x += struct.unpack('>h', self.d[p:p + 2])[0]; p += 2
            xs.append(x)
        ys, y = [], 0
        for f in flags:
            if f & 4:
                dy = self.d[p]; p += 1
                y += dy if f & 32 else -dy
            elif not f & 32:
                y += struct.unpack('>h', self.d[p:p + 2])[0]; p += 2
            ys.append(y)
        contours, start = [], 0
        for e in endpts:
            contours.append([(xs[k], ys[k], flags[k] & 1) for k in range(start, e + 1)])
            start = e + 1
        return (xmin, ymin, xmax, ymax, contours, adv)

def contour_segments(c):
    """One closed contour of (x, y, on_curve) → ('L', p) / ('Q', ctrl, p) segments from its start."""
    if not any(p[2] for p in c):
        # entirely off-curve contour: implied on-curve points at the midpoints
        n = len(c)
        mid = lambda a, b: ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        segs = [('L', mid(c[-1], c[0]))]
        for k in range(n):
            segs.append(('Q', c[k][:2], mid(c[k], c[(k + 1) % n])))
        return segs
    i = 0
    while not c[i][2]:
        i += 1
    pts = c[i:] + c[:i]
    segs = [('L', pts[0][:2])]
    n = len(pts)
    k = 1
    while k <= n:
        p = pts[k % n]
        if p[2]:
            segs.append(('L', p[:2])); k += 1
        else:
            nxt = pts[(k + 1) % n]
            if nxt[2]:
                segs.append(('Q', p[:2], nxt[:2])); k += 2
            else:
                mid = ((p[0] + nxt[0]) / 2, (p[1] + nxt[1]) / 2)
                segs.append(('Q', p[:2], mid)); k += 1
    return segs

def quad_flatten(res, p0, pc, p1, n=8):
    for j in range(1, n + 1):
        t = j / n
        mt = 1 - t
        res.append((mt * mt * p0[0] + 2 * mt * t * pc[0] + t * t * p1[0],
                    mt * mt * p0[1] + 2 * mt * t * pc[1] + t * t * p1[1]))

def segments_to_poly(segs):
    res = [segs[0][1]]
    for s in segs[1:]:
        if s[0] == 'L':
            res.append(s[1])
        else:
            quad_flatten(res, res[-1], s[1], s[2])
    return res

# ------------------------------------------------------------- wordmark ----
TEXT = 'Insane OS'
LOCKUP_W, LOCKUP_H = 812.0, 240.0
TEXT_X0, TEXT_X1 = 247.0, 800.0
BASE_Y = 186.0

def wordmark_metrics():
    """(glyphs, advs, sc, x0): parsed glyphs, per-glyph advances (px at the lockup scale),
    the lockup scale and the text's left edge."""
    face = Face(FONT)
    glyphs = [face.glyph(c) for c in TEXT]
    cap = glyphs[0][3]                                    # ymax of 'I'
    # this font's space sits past numberOfHMetrics and inherits the last entry's advance (651
    # units — far too wide for a wordmark); a normal word space is used instead
    SPACE_ADV = 300
    advs = [SPACE_ADV if c == ' ' else g[5] for c, g in zip(TEXT, glyphs)]
    adv_units = sum(advs)
    sc = 114.0 / cap
    if adv_units * sc > TEXT_X1 - TEXT_X0:                # fit the width, not just the cap height
        sc = (TEXT_X1 - TEXT_X0) / adv_units
    adv_px = adv_units * sc
    x0 = TEXT_X0 + ((TEXT_X1 - TEXT_X0) - adv_px) / 2
    return glyphs, [a * sc for a in advs], sc, x0

def wordmark_letter_paths():
    """SVG path data per glyph, at the lockup scale (for logo-horizontal-*.svg). All contours of
    a glyph share one path element so counters (the hole in O) survive: TrueType winds them
    opposite, which the default non-zero fill rule turns into a hole."""
    glyphs, advs, sc, x0 = wordmark_metrics()
    out, pen = [], x0
    for (xmin, ymin, xmax, ymax, contours, adv), adv_px in zip(glyphs, advs):
        d = []
        for c in contours:
            segs = contour_segments(c)
            d.append(f'M{pen + segs[0][1][0] * sc:.1f} {BASE_Y - segs[0][1][1] * sc:.1f}')
            for s in segs[1:]:
                if s[0] == 'L':
                    d.append(f'L{pen + s[1][0] * sc:.1f} {BASE_Y - s[1][1] * sc:.1f}')
                else:
                    d.append(f'Q{pen + s[1][0] * sc:.1f} {BASE_Y - s[1][1] * sc:.1f} '
                             f'{pen + s[2][0] * sc:.1f} {BASE_Y - s[2][1] * sc:.1f}')
            d.append('Z')
        if d:
            out.append(''.join(d))
        pen += adv_px
    return out

# ---------------------------------------------------------------- fill ----
def poly_spans(pts, y):
    xs = []
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]; x2, y2 = pts[(i + 1) % n]
        if (y1 <= y < y2) or (y2 <= y < y1):
            xs.append(x1 + (y - y1) * (x2 - x1) / (y2 - y1))
    xs.sort()
    return xs

def spans_hit_union(span_lists, x):
    for spans in span_lists:
        i = 0
        while i < len(spans) and spans[i] <= x: i += 1
        if len(spans) >= 2 and i % 2 == 1:
            return True
    return False

def spans_hit_evenodd(span_lists, x):
    k = 0
    for spans in span_lists:
        for s in spans:
            if s > x:
                break
            k += 1
    return k % 2 == 1

# ------------------------------------------------------------- renderer ----
def render(size, mode, ss=2):
    """Square renders. mode: 'icon' (rounded dark square + apple), 'glyph-light'/'glyph-dark'
    (mono silhouette), 'mark' (transparent, gradient apple), 'glow', 'dot' (tint = TINT), 'blank'."""
    S = size * ss
    px = bytearray(S * S * 4)
    sc = S / 512.0
    f = {'icon': 1.08, 'mark': 1.06, 'glyph-light': 1.08, 'glyph-dark': 1.08}.get(mode, 1.0)
    polys = []
    if mode not in ('glow', 'dot', 'blank'):
        for pts in SHAPES:
            polys.append([((px_ - CX) * f * sc + CX * sc, (py_ - CY) * f * sc + CY * sc) for px_, py_ in pts])
    mono = (240, 240, 244) if mode == 'glyph-light' else (26, 26, 30)
    radius_sq_bg = 0.22 * S
    for y in range(S):
        row = y * S * 4
        my = y + 0.5                                   # S-space (polys are in S-space too)
        span_sets = [poly_spans(p, my) for p in polys] if polys else []
        for x in range(S):
            mx = x + 0.5                               # S-space
            r, g, b, a = 0, 0, 0, 0
            if mode == 'icon':
                half = S / 2
                r = radius_sq_bg
                dx = abs(mx - half) - (half - r)
                dy = abs(my - half) - (half - r)
                dist = math.hypot(max(dx, 0), max(dy, 0)) + min(max(dx, dy), 0) - r
                if dist <= 0:
                    r, g, b, a = BG_DARK[0], BG_DARK[1], BG_DARK[2], 255
            if span_sets and spans_hit_union(span_sets, mx):
                if mode.startswith('glyph'):
                    r, g, b, a = *mono, 255
                else:
                    t = math.hypot(mx - S / 2, my - S / 2) / (0.5 * S)
                    cr, cg, cb = grad(t)
                    r, g, b, a = cr, cg, cb, 255
                    gd = math.hypot(mx - S * 0.36, my - S * 0.30) / (S * 0.44)
                    if gd < 1:
                        kk = (1 - gd) * 0.20
                        r = lerp(r, GLOSS[0], kk); g = lerp(g, GLOSS[1], kk); b = lerp(b, GLOSS[2], kk)
            elif mode == 'dot':
                t = math.hypot(mx - S / 2, my - S / 2) / (S / 2)
                if t < 1:
                    k = (1 - t) ** 1.8
                    r = int(TINT[0] * k + 255 * k * 0.25); g = int(TINT[1] * k + 255 * k * 0.25)
                    b = int(TINT[2] * k + 255 * k * 0.3); a = int(255 * k)
            elif mode == 'glow':
                t = math.hypot(mx - S / 2, my - S / 2) / (S / 2)
                if t < 1:
                    k = (1 - t) ** 2 * 0.5
                    r, g, b, a = int(GLOW_RGB[0] * k), int(GLOW_RGB[1] * k), int(GLOW_RGB[2] * k), int(255 * k)
            px[row + x * 4:row + x * 4 + 4] = bytes((min(255, max(0, int(r))), min(255, max(0, int(g))),
                                                     min(255, max(0, int(b))), min(255, max(0, int(a)))))
    return downsample(px, S, size, ss) if ss > 1 else bytes(px)

def downsample(px, S, size, ss):
    out = bytearray(size * size * 4)
    inv = ss * ss
    for yy in range(size):
        for xx in range(size):
            o = (yy * size + xx) * 4
            R = G = B = A = 0
            for dy in range(ss):
                sr = ((yy * ss + dy) * S + xx * ss) * 4
                for dx in range(ss):
                    p = sr + dx * 4
                    A += px[p + 3]
                    R += px[p]; G += px[p + 1]; B += px[p + 2]
            out[o:o + 4] = bytes((R // inv, G // inv, B // inv, A // inv))
    return bytes(out)

def render_rgba(w, h, painter, ss=2):
    """Generic per-pixel render: painter(mx, my) → (r, g, b, a) in output px units."""
    S = w * ss
    H = h * ss
    px = bytearray(S * H * 4)
    for y in range(H):
        row = y * S * 4
        my = (y + 0.5) / ss
        for x in range(S):
            mx = (x + 0.5) / ss
            r, g, b, a = painter(mx, my)
            px[row + x * 4:row + x * 4 + 4] = bytes((min(255, max(0, int(r))), min(255, max(0, int(g))),
                                                     min(255, max(0, int(b))), min(255, max(0, int(a)))))
    if ss > 1:
        out = bytearray(w * h * 4)
        inv = ss * ss
        for yy in range(h):
            for xx in range(w):
                o = (yy * w + xx) * 4
                R = G = B = A = 0
                for dy in range(ss):
                    sr = ((yy * ss + dy) * S + xx * ss) * 4
                    for dx in range(ss):
                        p = sr + dx * 4
                        A += px[p + 3]
                        R += px[p]; G += px[p + 1]; B += px[p + 2]
                out[o:o + 4] = bytes((R // inv, G // inv, B // inv, A // inv))
        return bytes(out)
    return bytes(px)

def write_png(path, w, h, rgba):
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    raw = b''.join(b'\x00' + rgba[y * w * 4:(y + 1) * w * 4] for y in range(h))
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw, 9))
           + chunk(b'IEND', b''))
    open(path, 'wb').write(png)

def render_wordmark(h_px, ink, ss=3):
    """The 'Insane OS' letters alone, transparent PNG, h_px tall — the plymouth wordmark."""
    glyphs, advs, sc0, x0 = wordmark_metrics()
    cap_px = glyphs[0][3] * sc0               # cap height at the lockup scale (width-fit may shrink it)
    pen = x0
    xs = []
    for g, adv_px in zip(glyphs, advs):
        xs.append(pen + g[2] * sc0)
        pen += adv_px
    text_x0 = x0
    tw = max(xs) - text_x0
    k = h_px / cap_px                         # lockup px → target px
    w_px = int(round(tw * k)) + 2
    base2 = float(h_px)                       # baseline at the bottom; caps start at y 0
    polys = []
    pen = x0
    for (xmin, ymin, xmax, ymax, contours, adv), adv_px in zip(glyphs, advs):
        for c in contours:
            segs = contour_segments(c)
            flat = [((pen + segs[0][1][0] * sc0 - text_x0) * k + 1,
                     base2 - segs[0][1][1] * sc0 * k)]
            for s in segs[1:]:
                if s[0] == 'L':
                    flat.append(((pen + s[1][0] * sc0 - text_x0) * k + 1,
                                 base2 - s[1][1] * sc0 * k))
                else:
                    quad_flatten(flat, flat[-1],
                                 ((pen + s[1][0] * sc0 - text_x0) * k + 1,
                                  base2 - s[1][1] * sc0 * k),
                                 ((pen + s[2][0] * sc0 - text_x0) * k + 1,
                                  base2 - s[2][1] * sc0 * k))
            polys.append(flat)
        pen += adv_px
    H = h_px + 1
    def painter(mx, my):
        return (*ink, 255) if spans_hit_evenodd([poly_spans(p, my) for p in polys], mx) else (0, 0, 0, 0)
    rgba = render_rgba(w_px, H, painter, ss=ss)
    return w_px, H, rgba

# ---------------------------------------------------------------- SVG ----
def pts_attr(pts):
    return ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts)

GRAD_DEFS = ('<defs><radialGradient id="g" cx="0.5" cy="0.58" r="0.62">'
             f'<stop offset="0" stop-color="rgb{CORE}"/><stop offset="0.42" stop-color="rgb{MID}"/>'
             f'<stop offset="1" stop-color="rgb{EDGE}"/></radialGradient></defs>')

def apple_group(fill):
    return ('<g transform="matrix(.5 0 0 .5 -12.5 -4)">'
            + ''.join(f'<polygon points="{pts_attr(p)}" fill="{fill}"/>' for p in SHAPES)
            + '</g>')

def write_svgs():
    open(os.path.join(BRAND, 'apple.svg'), 'w').write(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">\n'
        + GRAD_DEFS
        + ''.join(f'<polygon points="{pts_attr(p)}" fill="url(#g)"/>' for p in SHAPES) + '\n</svg>\n')
    open(os.path.join(BRAND, 'app-icon.svg'), 'w').write(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">\n'
        + GRAD_DEFS
        + f'<rect width="512" height="512" rx="113" fill="rgb{BG_DARK}"/>'
        + ''.join(f'<polygon points="{pts_attr([((px_ - CX) * 1.08 + CX, (py_ - CY) * 1.08 + CY) for px_, py_ in p])}" fill="url(#g)"/>'
                  for p in SHAPES)
        + '\n</svg>\n')
    letters = wordmark_letter_paths()
    for name, apple_fill, ink in (('logo-horizontal-dark', 'url(#g)', '#ffffff'),
                                  ('logo-horizontal-light', 'url(#g)', '#12122A'),
                                  ('logo-mono-white', '#ffffff', '#ffffff'),
                                  ('logo-mono-black', '#111111', '#111111')):
        open(os.path.join(BRAND, name + '.svg'), 'w').write(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 812 240" width="812" height="240">'
            '<title>InsaneOS</title>' + GRAD_DEFS + apple_group(apple_fill)
            + ''.join(f'<path d="{d}" fill="{ink}"/>' for d in letters)
            + '</svg>\n')
    print('svg: apple.svg, app-icon.svg, logo-horizontal-*, logo-mono-*')

# ---------------------------------------------------------------- main ----
TINT = GLOW_RGB

def rounded_rect_dist(mx, my, w, h, r, cx=0.0, cy=0.0):
    dx = abs(mx - (cx + w / 2)) - (w / 2 - r)
    dy = abs(my - (cy + h / 2)) - (h / 2 - r)
    return math.hypot(max(dx, 0), max(dy, 0)) + min(max(dx, dy), 0) - r

def disc(size, rgb):
    def painter(mx, my):
        d = math.hypot(mx - size / 2, my - size / 2)
        return (*rgb, 255) if d <= size / 2 else (0, 0, 0, 0)
    return painter


def main():
    os.makedirs(ICONS, exist_ok=True); os.makedirs(BRAND, exist_ok=True); os.makedirs(DOCS_PNG, exist_ok=True)
    write_svgs()
    for s in (16, 32, 64, 128, 256, 512, 1024):
        write_png(os.path.join(ICONS, f'insaneos-icon-{s}.png'), s, s, render(s, 'icon', ss=2 if s <= 256 else 1))
        print(f'icon {s}')
    for tone in ('light', 'dark'):
        for s in (16, 32):
            write_png(os.path.join(ICONS, f'insaneos-glyph-{tone}-{s}.png'), s, s, render(s, f'glyph-{tone}', ss=4))
            print(f'glyph {tone} {s}')
    for s, nm in ((256, 'insaneos-apple'), (512, 'insaneos-apple-512')):
        write_png(os.path.join(ICONS, nm + '.png'), s, s, render(s, 'mark', ss=2 if s <= 256 else 1))
        print('mark', nm)
    # plymouth splash (tools/boot/plymouth/insaneos/)
    PLY = os.path.join(REPO, 'tools', 'boot', 'plymouth', 'insaneos')
    if os.path.isdir(PLY):
        for sfx, s in (('', 112), ('@2x', 224)):
            write_png(os.path.join(PLY, f'apple{sfx}.png'), s, s, render(s, 'mark', ss=4 if s <= 112 else 2))
        for sfx, s in (('', 420), ('@2x', 840)):
            write_png(os.path.join(PLY, f'glow{sfx}.png'), s, s, render(s, 'glow', ss=1))
        for sfx, h in (('', 12), ('@2x', 24)):
            w, H, rgba = render_wordmark(h, INK_DARK, ss=3)
            write_png(os.path.join(PLY, f'wordmark{sfx}.png'), w, H, rgba)
            print(f'plymouth wordmark {w}x{H}')
        global TINT
        for name, tint in (('violet', GLOW_RGB), ('pink', AMBER), ('white', WHITE)):
            TINT = tint
            write_png(os.path.join(PLY, f'particle-{name}.png'), 64, 64, render(64, 'dot', ss=2))
        print('plymouth splash assets rendered')
    # grub menu mark + background + selection 9-slice (rsvg-free, was gen-boot-assets.py's job)
    GRUB = os.path.join(REPO, 'tools', 'iso', 'grub', 'insaneos')
    if os.path.isdir(GRUB):
        write_png(os.path.join(GRUB, 'apple.png'), 96, 96, render(96, 'mark', ss=4))
        W, H = 1920, 1080
        def bg(mx, my):
            t = my / H
            base = tuple(lerp(BG_TOP[i], BG_BOTTOM[i], t) for i in range(3))
            gx, gy = mx - W / 2, (my - H * 0.30) / 0.86
            d = math.hypot(gx, gy) / (H * 0.42)
            if d < 1:
                k = (1 - d) ** 2 * 0.20
                return (min(255, base[0] + GLOW_RGB[0] * k), min(255, base[1] + GLOW_RGB[1] * k),
                        min(255, base[2] + GLOW_RGB[2] * k), 255)
            return (*base, 255)
        write_png(os.path.join(GRUB, 'background.png'), W, H, render_rgba(W, H, bg, ss=1))
        write_png(os.path.join(GRUB, 'terminal_box_c.png'), 8, 8,
                  render_rgba(8, 8, lambda mx, my: (*BG_BOTTOM, 255), ss=1))
        # selection 9-slice: 24x24, 8 px corners, translucent orange with a light stroke
        c = 8
        def sel(mx, my):
            d = rounded_rect_dist(mx, my, 24, 24, c)
            if d <= 0:
                edge = rounded_rect_dist(mx, my, 23, 23, c - 0.5, cx=0.5, cy=0.5)
                if edge > 0:
                    return (*GRUB_LILAC, 255)
                return (*GRUB_VIOLET, 87)          # .34 alpha
            return (0, 0, 0, 0)
        sel_rgba = render_rgba(24, 24, sel, ss=4)
        for name, (sx, sy) in (('nw', (0, 0)), ('n', (c, 0)), ('ne', (2 * c, 0)),
                               ('w', (0, c)), ('c', (c, c)), ('e', (2 * c, c)),
                               ('sw', (0, 2 * c)), ('s', (c, 2 * c)), ('se', (2 * c, 2 * c))):
            piece = bytearray(c * c * 4)
            for yy in range(c):
                so = ((sy + yy) * 24 + sx) * 4
                piece[yy * c * 4:(yy + 1) * c * 4] = sel_rgba[so:so + c * 4]
            write_png(os.path.join(GRUB, f'select_{name}.png'), c, c, bytes(piece))
        print('grub assets rendered')
    # plymouth bar pieces, password field, lock (the script stretches/fades them)
    PLY = os.path.join(REPO, 'tools', 'boot', 'plymouth', 'insaneos')
    if os.path.isdir(PLY):
        for sfx, s in (('', 1), ('@2x', 2)):
            bw, bh = 200 * s, 6 * s
            def track(mx, my, bh=bh):
                if rounded_rect_dist(mx, my, bw, bh, bh / 2) <= 0:
                    return (255, 255, 255, 31)     # .12 white
                return (0, 0, 0, 0)
            write_png(os.path.join(PLY, f'track{sfx}.png'), bw, bh, render_rgba(bw, bh, track, ss=4))
            d = bh
            write_png(os.path.join(PLY, f'cap-start{sfx}.png'), d, d,
                      render_rgba(d, d, disc(d, BAR_HI), ss=4))
            write_png(os.path.join(PLY, f'cap-end{sfx}.png'), d, d,
                      render_rgba(d, d, disc(d, BAR_LO), ss=4))
            fw, fh = 64, 6 * s
            def fill(mx, my):
                t = mx / fw
                return (*(lerp(BAR_HI[i], BAR_LO[i], t) for i in range(3)), 255)
            write_png(os.path.join(PLY, f'fill{sfx}.png'), fw, fh, render_rgba(fw, fh, fill, ss=1))
            ew, eh = 280 * s, 40 * s
            def entry(mx, my):
                d1 = rounded_rect_dist(mx, my, ew, eh, 12 * s)
                d2 = rounded_rect_dist(mx, my, ew - 2 * s, eh - 2 * s, 12 * s, cx=s, cy=s)
                if d2 <= 0:
                    return (255, 255, 255, 18)     # .07 interior
                if d1 <= 0:
                    return (255, 255, 255, 56)     # .22 border
                return (0, 0, 0, 0)
            write_png(os.path.join(PLY, f'entry{sfx}.png'), ew, eh, render_rgba(ew, eh, entry, ss=2))
            dd = 8 * s
            write_png(os.path.join(PLY, f'bullet{sfx}.png'), dd, dd,
                      render_rgba(dd, dd, disc(dd, (255, 255, 255)), ss=4))
            lw, lh = 18 * s, 22 * s
            def lock(mx, my):
                # shackle: ring centred (9, 6.5), outer r 6, inner r 4, upper half
                dx, dy = mx - 9 * s, my - 6.5 * s
                rr = math.hypot(dx, dy)
                if dy <= 0 and 4 * s <= rr <= 6 * s:
                    return (255, 255, 255, 204)
                if rounded_rect_dist(mx, my, 14 * s, 11 * s, 3 * s, cx=2 * s, cy=9 * s) <= 0:
                    return (255, 255, 255, 204)
                return (0, 0, 0, 0)
            write_png(os.path.join(PLY, f'lock{sfx}.png'), lw, lh, render_rgba(lw, lh, lock, ss=3))
        print('plymouth bar + field assets rendered')
    # docs/brand pngs
    for s in (256, 512):
        write_png(os.path.join(DOCS_PNG, f'apple-{s}.png'), s, s, render(s, 'mark', ss=2))
    print('docs/brand apple renders')
    print('done — Insane OS brand rendered')

if __name__ == '__main__':
    main()
