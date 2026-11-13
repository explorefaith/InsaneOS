#!/usr/bin/env python3
"""gen-cleaner-status.py — the Cleaner's menu-bar status icon, replacing the old Lord OS crown
(assets/cleaner/status-*.png, the glyph that sat next to the battery in the top panel).

A flat one-ink four-point spark — the Cleaner's own mark (assets/cleaner/spark.png), the same
shape macOS-style cleanup icons use — drawn at 16 px like the item uses it (sdk/cleanerstatus.jsx).
Same pure-stdlib rendering as tools/gen-brand-insane.py: per-pixel painter, 4x supersampled,
straight into PNG. Two files:

    status-dark.png   dark ink  (drawn on the light menu bar)
    status-light.png  light ink (drawn on the dark menu bar)

One inky colour per file; the bar tints nothing."""
import math
import struct
import sys
import zlib

OUT = "assets/cleaner"
SIZE = 16
SS = 4

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

def in_spark(px, py, cx, cy, r):
    """a four-point star (the Cleaner's own spark, assets/cleaner/spark.png): thin arms,
    a small solid core, concave sides — reads as "cleanup" at 16 px where a rotated broom muddles"""
    x, y = abs(px - cx), abs(py - cy)
    if x + y > r:
        return False
    if min(x, y) <= r * 0.16:            # the arms
        return True
    return x + y <= r * 0.52             # the core

def shape(mx, my):
    return in_spark(mx, my, 8.0, 8.0, 7.2)

def render(ink):
    def painter(mx, my):
        return (*ink, 255) if shape(mx, my) else (0, 0, 0, 0)
    # inline copy of gen-brand-insane.py's render_rgba (that file is a script, not a module)
    px = bytearray(SIZE * SS * SIZE * SS * 4)
    for y in range(SIZE * SS):
        my = (y + 0.5) / SS
        for x in range(SIZE * SS):
            mx = (x + 0.5) / SS
            r, g, b, a = painter(mx, my)
            px[(y * SIZE * SS + x) * 4:(y * SIZE * SS + x) * 4 + 4] = bytes((r, g, b, a))
    out = bytearray(SIZE * SIZE * 4)
    inv = SS * SS
    for yy in range(SIZE):
        for xx in range(SIZE):
            R = G = B = A = 0
            for dy in range(SS):
                sr = ((yy * SS + dy) * SIZE * SS + xx * SS) * 4
                for dx in range(SS):
                    p = sr + dx * 4
                    A += px[p + 3]; R += px[p]; G += px[p + 1]; B += px[p + 2]
            out[(yy * SIZE + xx) * 4:(yy * SIZE + xx) * 4 + 4] = bytes((R // inv, G // inv, B // inv, A // inv))
    return bytes(out)

for name, ink in [("status-dark.png", (29, 29, 31)), ("status-light.png", (245, 245, 247))]:
    write_png(f"{OUT}/{name}", SIZE, SIZE, render(ink))
    print(f"wrote {OUT}/{name}")
