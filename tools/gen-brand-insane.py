#!/usr/bin/env python3
"""
gen-brand-insane.py — the Insane OS mark, rendered with nothing but the standard library.

Design: a chaotic jagged burst (irregular 9-spike star) with a hot-pink → violet radial
gradient, a misaligned red copy peeking out behind it (the "insane" glitch), and a soft
gloss. The same polygons are exported as SVG (assets/brand/) and rasterized to the PNGs
(assets/icons/) that sdk/logo.js picks up — the asset file names are kept, so nothing
else in the tree needs to change.

    python3 tools/gen-brand-insane.py          # write SVGs + render all PNGs

No third-party modules: PNG via zlib, rasterizing by scanline.
"""
import os, struct, sys, zlib, math
TINT = (168, 85, 247)

REPO = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
BRAND = os.path.join(REPO, 'assets', 'brand')
ICONS = os.path.join(REPO, 'assets', 'icons')

# ---- the mark: irregular spike star in a 512 design box, centre (256, 256) ----
# (angle°, outer radius, inner radius) — hand-tuned: chaotic but balanced
SPIKES = [(0, 232, 96), (42, 205, 88), (81, 244, 102), (126, 196, 84), (163, 236, 98),
          (204, 208, 90), (243, 246, 104), (288, 199, 86), (326, 238, 100)]
CX = CY = 256.0
ROT = -9.0                                   # the whole burst leans, on purpose

def burst_points(cx, cy, scale=1.0, rot=0.0):
    pts = []
    a0 = math.radians(ROT + rot)
    for i, (deg, ro, ri) in enumerate(SPIKES):
        a_out = a0 + math.radians(deg)
        a_in = a0 + math.radians(deg + 360 / (len(SPIKES) * 2))
        pts.append((cx + math.cos(a_out) * ro * scale, cy + math.sin(a_out) * ro * scale))
        rr = ri * (0.92 + 0.16 * ((i * 7) % 5) / 4)          # jitter the valleys too
        pts.append((cx + math.cos(a_in) * rr * scale, cy + math.sin(a_in) * rr * scale))
    return pts

def glitch_points(cx, cy, scale=1.0):
    return burst_points(cx + 16 * scale, cy - 11 * scale, scale * 0.97, rot=17)

# ---- colours ----
CORE = (255, 64, 160)      # hot pink
MID = (168, 85, 247)       # violet (the OS accent)
EDGE = (76, 29, 149)       # deep purple
GLITCH = (255, 45, 60)     # misaligned red copy
BG_DARK = (11, 11, 18)     # app-icon rounded square
GLOSS = (255, 255, 255)

def lerp(a, b, t): return a + (b - a) * t

def grad(t):
    """radial gradient: 0 core → 1 edge"""
    t = max(0.0, min(1.0, t))
    if t < 0.45:
        u = t / 0.45
        return tuple(lerp(CORE[i], MID[i], u) for i in range(3))
    u = (t - 0.45) / 0.55
    return tuple(lerp(MID[i], EDGE[i], u) for i in range(3))

def render(size, mode, ss=2):
    """mode: 'icon' (rounded dark square + burst), 'glyph-light'/'glyph-dark' (mono burst),
    'mark' (transparent, gradient burst only — the wordmark's front mark),
    'glow' (soft violet radial glow for the boot splash), 'blank' (fully transparent)."""
    S = size * ss
    px = bytearray(S * S * 4)
    cx = cy = S / 2.0
    sc = S / 512.0
    main = burst_points(cx, cy, sc)
    gli = glitch_points(cx, cy, sc)
    r_out = 246 * sc
    mono = (237, 237, 242) if mode == 'glyph-light' else (29, 29, 31)
    radius_sq_bg = 0.22 * S

    def poly_spans(pts, y):
        xs = []
        n = len(pts)
        for i in range(n):
            x1, y1 = pts[i]; x2, y2 = pts[(i + 1) % n]
            if (y1 <= y < y2) or (y2 <= y < y1):
                xs.append(x1 + (y - y1) * (x2 - x1) / (y2 - y1))
        xs.sort()
        return xs

    for y in range(S):
        row = y * S * 4
        my = (y + 0.5) / ss
        mxs = poly_spans(main, y + 0.5)
        gxs = poly_spans(gli, y + 0.5)
        gi = 0
        for x in range(S):
            mx = (x + 0.5) / ss
            r, g, b, a = 0, 0, 0, 0
            if mode == 'icon':
                # rounded dark square
                dx = abs(mx - cx) - (S / 2 - radius_sq_bg)
                dy = abs(my - cy) - (S / 2 - radius_sq_bg)
                dist = math.hypot(max(dx, 0), max(dy, 0)) + min(max(dx, dy), 0)
                if dist <= 0:
                    r, g, b, a = *BG_DARK, 255
            # glitch copy behind
            while gi < len(gxs) and gxs[gi] <= mx: gi += 1
            in_g = (len(gxs) >= 2) and (gi % 2 == 1)
            if in_g and my >= 0:
                r, g, b, a = GLITCH[0], GLITCH[1], GLITCH[2], (a if a else 0)
                a = 150
            # main burst over it
            mi = 0
            while mi < len(mxs) and mxs[mi] <= mx: mi += 1
            if len(mxs) >= 2 and mi % 2 == 1:
                t = math.hypot(mx - cx, my - cy) / r_out
                cr, cg, cb = grad(t)
                r, g, b, a = cr, cg, cb, 255
                # gloss: soft highlight top-left
                gd = math.hypot(mx - cx * 0.72, my - cy * 0.62) / (S * 0.42)
                if gd < 1:
                    k = (1 - gd) * 0.22
                    r = lerp(r, GLOSS[0], k); g = lerp(g, GLOSS[1], k); b = lerp(b, GLOSS[2], k)
            elif mode == 'dot':
                # soft glowing particle: radial falloff, tinted
                t = math.hypot(mx - cx, my - cy) / (S / 2)
                if t < 1:
                    k = (1 - t) ** 1.8
                    r, g, b = int(TINT[0] * k + 255 * k * 0.25), int(TINT[1] * k + 255 * k * 0.25), int(TINT[2] * k + 255 * k * 0.3)
                    a = int(255 * k)
            elif mode == 'glow':
                t = math.hypot(mx - cx, my - cy) / (S / 2)
                if t < 1:
                    k = (1 - t) ** 2 * 0.5
                    r, g, b, a = int(110 * k), int(75 * k), int(255 * k), int(255 * k)
            elif mode == 'blank':
                r = g = b = a = 0
            elif mode.startswith('glyph') and not in_g:
                # mono glyph: everything outside the burst stays transparent
                pass
            if mode.startswith('glyph'):
                if len(mxs) >= 2 and mi % 2 == 1:
                    r, g, b, a = *mono, 255
                elif in_g:
                    # the glitch copy in the mono glyph: a bite out of the silhouette
                    r, g, b, a = 0, 0, 0, 0
            px[row + x * 4:row + x * 4 + 4] = bytes((max(0, min(255, int(r))), max(0, min(255, int(g))), max(0, min(255, int(b))), max(0, min(255, int(a)))))
    # box downsample
    if ss > 1:
        out = bytearray(size * size * 4)
        inv = ss * ss
        for y in range(size):
            for x in range(size):
                o = (y * size + x) * 4
                R = G = B = A = 0
                for dy in range(ss):
                    sr = ((y * ss + dy) * S + x * ss) * 4
                    for dx in range(ss):
                        p = sr + dx * 4
                        A += px[p + 3]
                        if px[p + 3]:
                            R += px[p]; G += px[p + 1]; B += px[p + 2]
                        else:
                            R += px[p]; G += px[p + 1]; B += px[p + 2]
                out[o:o + 4] = bytes((R // inv, G // inv, B // inv, A // inv))
        return bytes(out)
    return bytes(px)

def write_png(path, size, rgba):
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    raw = b''.join(b'\x00' + rgba[y * size * 4:(y + 1) * size * 4] for y in range(size))
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw, 9))
           + chunk(b'IEND', b''))
    open(path, 'wb').write(png)

def write_svg(path, w, h, body):
    open(path, 'w').write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">\n'
        + '<defs><radialGradient id="g" cx="0.5" cy="0.5" r="0.62">'
          f'<stop offset="0" stop-color="rgb{CORE}"/><stop offset="0.45" stop-color="rgb{MID}"/>'
          f'<stop offset="1" stop-color="rgb{EDGE}"/></radialGradient></defs>\n' + body + '\n</svg>\n')

def pts_attr(pts):
    return ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts)

def main():
    os.makedirs(ICONS, exist_ok=True); os.makedirs(BRAND, exist_ok=True)
    # SVGs (publish + future regen)
    write_svg(os.path.join(BRAND, 'crown.svg'), 512, 512,
              f'<polygon points="{pts_attr(glitch_points(256 + 16, 256 - 11, 0.97))}" fill="rgb{GLITCH}" opacity="0.55"/>'
              f'<polygon points="{pts_attr(burst_points(256, 256))}" fill="url(#g)"/>')
    write_svg(os.path.join(BRAND, 'app-icon.svg'), 512, 512,
              f'<rect width="512" height="512" rx="113" fill="rgb{BG_DARK}"/>'
              f'<polygon points="{pts_attr(glitch_points(256 + 16, 256 - 11, 0.86))}" fill="rgb{GLITCH}" opacity="0.55"/>'
              f'<polygon points="{pts_attr(burst_points(256, 256, 0.86))}" fill="url(#g)"/>')
    print('svg: crown.svg, app-icon.svg')
    # icon renders
    for s in (16, 32, 64, 128, 256, 512, 1024):
        write_png(os.path.join(ICONS, f'lordos-icon-{s}.png'), s, render(s, 'icon', ss=2 if s <= 256 else 1))
        print(f'icon {s}')
    # glyph renders (mono, light + dark ink)
    for tone in ('light', 'dark'):
        for s in (16, 32):
            write_png(os.path.join(ICONS, f'lordos-glyph-{tone}-{s}.png'), s, render(s, f'glyph-{tone}', ss=4))
            print(f'glyph {tone} {s}')
    # wordmark front mark
    for s in (256, 512):
        write_png(os.path.join(ICONS, f'lordos-crown{"-512" if s > 256 else ""}.png'), s, render(s, 'mark', ss=2 if s <= 256 else 1))
    print('crown (wordmark mark) 256, 512')
    # boot splash (Plymouth): the mark, its glow, and a transparent wordmark slot
    PLY = os.path.join(REPO, 'tools', 'boot', 'plymouth', 'lordos')
    if os.path.isdir(PLY):
        write_png(os.path.join(PLY, 'crown.png'), 112, render(112, 'mark', ss=4))
        write_png(os.path.join(PLY, 'crown@2x.png'), 224, render(224, 'mark', ss=2))
        write_png(os.path.join(PLY, 'glow.png'), 420, render(420, 'glow', ss=1))
        write_png(os.path.join(PLY, 'glow@2x.png'), 840, render(840, 'glow', ss=1))
        write_png(os.path.join(PLY, 'wordmark.png'), 54, render(54, 'blank'))
        write_png(os.path.join(PLY, 'wordmark@2x.png'), 108, render(108, 'blank'))
        # particle textures for the boot animation (soft glowing dots, three tints)
        global TINT
        for tint_name, tint in (('violet', (168, 85, 247)), ('pink', (255, 64, 160)), ('white', (235, 235, 255))):
            TINT = tint
            write_png(os.path.join(PLY, f'particle-{tint_name}.png'), 64, render(64, 'dot', ss=2))
        print('plymouth splash + particle assets rendered')
    print('done — Insane OS brand rendered')

if __name__ == '__main__':
    main()
