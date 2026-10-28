#!/usr/bin/env python3
"""Create a portable single-file demonstration copy from the maintained source tree."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / "index.html").read_text(encoding="utf-8")

# Inline the maintained CSS in declaration order.
css_links = re.findall(r'<link\s+rel="stylesheet"\s+href="([^"]+)"\s*>', html)
styles: list[str] = []
for href in css_links:
    css_path = ROOT / href
    if not css_path.is_file():
        raise FileNotFoundError(f"Cannot inline missing stylesheet: {href}")
    css_text = css_path.read_text(encoding="utf-8")
    svg = ROOT / "assets/img/contours.svg"
    if "../img/contours.svg" in css_text:  # embed the contour background so the single file stays portable
        import base64
        css_text = css_text.replace("../img/contours.svg", "data:image/svg+xml;base64," + base64.b64encode(svg.read_bytes()).decode())
    styles.append(f"/* ===== {href} ===== */\n" + css_text)

html = re.sub(r'\s*<link\s+rel="stylesheet"\s+href="[^"]+"\s*>', "", html)
style_block = "\n  <style>\n" + "\n\n".join(styles) + "\n  </style>\n"
html = html.replace("</head>", style_block + "</head>", 1)

# Inline classic JavaScript at the end of body, after the DOM exists. Module code is
# preserved as a separate inline module so the import map continues to resolve Three.js.
module_paths = re.findall(r'<script\s+type="module"\s+src="([^"]+)"\s*>\s*</script>', html)
script_paths = re.findall(r'<script\s+defer\s+src="([^"]+)"\s*>\s*</script>', html)
script_parts: list[str] = []
for rel in script_paths:
    if rel == "experiments/believe/manifest.js":
        runtime_path = ROOT / "experiments/believe/runtime.js"
        runtime_source = runtime_path.read_text(encoding="utf-8")
        script_parts.append(f"/* ===== embedded experiments/believe/runtime.js ===== */\n{runtime_source}")
        source = (ROOT / rel).read_text(encoding="utf-8")
        source = source.replace(
            'load: () => window.Aloop.loadScript("experiments/believe/runtime.js")',
            "load: () => Promise.resolve()",
        )
        if 'load: () => Promise.resolve()' not in source:
            raise RuntimeError("Could not patch manifest lazy-load hook for standalone copy")
        script_parts.append(f"/* ===== {rel} (standalone loader) ===== */\n{source}")
    else:
        path = ROOT / rel
        if not path.is_file():
            raise FileNotFoundError(f"Cannot inline missing script: {rel}")
        script_parts.append(f"/* ===== {rel} ===== */\n" + path.read_text(encoding="utf-8"))

html = re.sub(r'\s*<script\s+defer\s+src="[^"]+"\s*>\s*</script>', "", html)
html = re.sub(r'\s*<script\s+type="module"\s+src="[^"]+"\s*>\s*</script>', "", html)
combined = "\n\n".join(script_parts).replace("</script", "<\\/script")
script_block = "\n  <script>\n" + combined + "\n  </script>\n"
module_blocks: list[str] = []
for rel in module_paths:
    path = ROOT / rel
    if not path.is_file():
        raise FileNotFoundError(f"Cannot inline missing ES module: {rel}")
    module_source = path.read_text(encoding="utf-8").replace("</script", "<\\/script")
    module_blocks.append(f"  <script type=\"module\">\n/* ===== {rel} ===== */\n{module_source}\n  </script>")
html = html.replace("</body>", script_block + "\n".join(module_blocks) + "\n</body>", 1)

# The application script is fully inlined. Its pinned third-party runtime and model are
# intentionally remote because a local copy of either would add >2 MB to the hand-off.
if re.search(r'<script\s+[^>]*src=', html) or re.search(r'<link\s+rel="stylesheet"\s+href="assets/', html):
    raise RuntimeError("standalone.html still contains external CSS/JS source references")

out = ROOT / "standalone.html"
out.write_text(html, encoding="utf-8")
print(f"Built {out.relative_to(ROOT)} ({out.stat().st_size:,} bytes) with {len(css_links)} stylesheets, {len(script_paths) + 1} classic script blocks, and {len(module_paths)} inline ES modules.")
