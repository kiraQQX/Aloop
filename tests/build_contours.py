#!/usr/bin/env python3
"""Build assets/img/contours.svg: seeded multi-octave noise -> marching squares -> RDP + Chaikin."""
import numpy as np
from scipy.ndimage import gaussian_filter
from skimage.measure import find_contours, approximate_polygon
from pathlib import Path

W, H, CELL, PAD = 1600, 1000, 5, 3
NX, NY = W // CELL, H // CELL
rng = np.random.default_rng(20261023)

def octave(sigma, weight):
    f = gaussian_filter(rng.standard_normal((NY + 2 * PAD, NX + 2 * PAD)), sigma, mode="wrap")
    return weight * f / f.std()

field = sum(octave(s, 0.5 ** i) for i, s in enumerate((26, 13, 6.5, 3.2)))
field = gaussian_filter(field, 1.2, mode="wrap")
lo, hi = np.percentile(field, [2, 98])
levels = np.linspace(lo, hi, 26)[1:-1]  # 24 contour levels

def chaikin(p, n=2):
    for _ in range(n):
        q = 0.75 * p[:-1] + 0.25 * p[1:]
        r = 0.25 * p[:-1] + 0.75 * p[1:]
        p = np.empty((len(q) * 2, 2)); p[0::2] = q; p[1::2] = r
    return p

def path(c):
    c = approximate_polygon(c, 0.7)
    if len(c) < 4: return ""
    c = chaikin(c, 1)
    pts = [((x - PAD) * CELL, (y - PAD) * CELL) for y, x in c]
    return "M" + "L".join(f"{x:.0f} {y:.0f}" for x, y in pts)

minor, index = [], []
for i, lv in enumerate(levels):
    d = "".join(filter(None, (path(c) for c in find_contours(field, lv))))
    (index if i % 5 == 0 else minor).append(d)

svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice" fill="none">'
       '<g stroke="#477EAE" stroke-opacity=".22" stroke-width=".8" vector-effect="non-scaling-stroke">'
       + "".join(f'<path vector-effect="non-scaling-stroke" d="{d}"/>' for d in minor) + '</g>'
       '<g stroke="#315E91" stroke-opacity=".38" stroke-width="1.4">'
       + "".join(f'<path vector-effect="non-scaling-stroke" d="{d}"/>' for d in index) + '</g></svg>')
out = Path(__file__).resolve().parent.parent / "assets/img/contours.svg"
out.write_text(svg)
print(out, f"{len(svg)/1024:.1f} KB")
