#!/usr/bin/env python3
"""Fast static integrity checks for the zero-build Aloop site."""
from __future__ import annotations

import re
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ERRORS: list[str] = []
CHECKS = 0


def check(condition: bool, message: str) -> None:
    global CHECKS
    CHECKS += 1
    if not condition:
        ERRORS.append(message)


def read(rel: str) -> str:
    path = ROOT / rel
    if not path.exists():
        ERRORS.append(f"Missing required file: {rel}")
        return ""
    return path.read_text(encoding="utf-8")


html = read("index.html")
roadmap = read("roadmap.md")
design = read("design.md")

required_files = [
    "assets/css/tokens.css", "assets/css/base.css", "assets/css/topbar.css", "assets/css/theme-blue.css",
    "assets/css/home.css", "assets/css/responsive.css", "assets/i18n/site.js",
    "assets/js/core/env.js", "assets/js/core/store.js", "assets/js/core/audio.js",
    "assets/js/core/auth.js", "assets/js/core/perf.js", "assets/js/core/router.js",
    "assets/js/gl/engine.js", "assets/js/registry.js", "assets/js/ui/quickmenu.js",
    "assets/js/easysci/data.js", "assets/js/easysci/easysci.js", "assets/css/easysci.css",
    "assets/js/ui/authmodal.js", "assets/js/ui/topbar.js", "assets/js/ui/sections.js",
    "experiments/believe/manifest.js", "experiments/believe/runtime.js",
    "experiments/believe/believe.css", "README.md", "DEPLOY_GITHUB_PAGES.md",
]
for rel in required_files:
    check((ROOT / rel).is_file(), f"Required file missing: {rel}")

# Resolve every local stylesheet and classic script reference in the primary shell.
for attr, path in re.findall(r'\b(href|src)="([^"]+)"', html):
    if path.startswith(("http://", "https://", "data:", "#", "mailto:")):
        continue
    check((ROOT / path).is_file(), f"Broken local {attr} path in index.html: {path}")

# Script dependency order is intentional: storage before i18n, registry before manifest, router last.
scripts = re.findall(r'<script\s+defer\s+src="([^"]+)"\s*>\s*</script>', html)
order = [
    "assets/js/core/env.js", "assets/js/core/store.js", "assets/i18n/site.js",
    "assets/js/core/audio.js", "assets/js/core/auth.js", "assets/js/core/perf.js",
    "assets/js/gl/engine.js", "assets/js/ui/quickmenu.js", "assets/js/ui/authmodal.js",
    "assets/js/ui/topbar.js", "assets/js/ui/sections.js", "assets/js/registry.js",
    "experiments/believe/manifest.js", "assets/js/easysci/data.js", "assets/js/easysci/easysci.js", "assets/js/smartbrain/lessons.js", "assets/js/smartbrain/narration.js", "assets/js/smartbrain/learn.js", "assets/js/smartbrain/atlas/store.js", "assets/js/smartbrain/atlas/cards.js", "assets/js/smartbrain/atlas/data.js", "assets/js/smartbrain/atlas/assets.js", "assets/js/smartbrain/atlas/scene.js", "assets/js/smartbrain/atlas/sidebar.js", "assets/js/ui/transition.js", "assets/js/core/router.js",
]
check(scripts == order, "index.html script order differs from the required dependency order")

# Key design / routing / performance requirements.
tokens = read("assets/css/tokens.css")
engine = read("assets/js/gl/engine.js")
router = read("assets/js/core/router.js")
sections = read("assets/js/ui/sections.js")
manifest = read("experiments/believe/manifest.js")
runtime = read("experiments/believe/runtime.js")
i18n = read("assets/i18n/site.js")

for token in ("#F5F7FA", "#315E91", "#23466D", "#477EAE", "#F2CC4D", "#5AB7BD", "#FFFFFF", "#253449", "#5E6D82", "#DCE4ED"):
    check(token.lower() in tokens.lower(), f"Expected design token is missing: {token}")
check("position: fixed" in read("assets/css/topbar.css"), "Top bar is not fixed")
check("backdrop-filter: blur(16px)" in read("assets/css/topbar.css"), "Top bar blur recipe is missing")
brain_module = read("assets/js/gl/particle-cortex.js")
check('id="particleCortexStage"' in html and 'class="particle-cortex-canvas"' in html, "Homepage particle cortex stage is missing")
check('"three":"https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js"' in html, "Pinned Three.js import map is missing")
check("TetrahedronGeometry(1, 0)" in brain_module and "InstancedBufferGeometry" in brain_module and "bx_cat" in brain_module, "Particle cortex must be instanced particles sampled from cortex meshes")
check("MeshStandardMaterial" in brain_module and "brainRoot.visible = false" in brain_module and "brainRoot.visible = true" in brain_module, "Homepage must render the original anatomical mesh beneath surface particles")
check("const N = small || (navigator.hardwareConcurrency || 8) <= 4 ? 520 : 1100" in brain_module, "Homepage surface particles must remain sparse")
check("uClickT" in brain_module and "pointermove" in brain_module and "pointerdown" in brain_module and "prefers-reduced-motion" in brain_module and "IntersectionObserver" in brain_module, "Particle cortex interaction, reduced-motion or viewport gating is missing")
check("webglcontextlost" in brain_module and "hero.particleNoWebgl" in brain_module, "Particle cortex has no explicit WebGL failure handling")
check((ROOT / "assets/img/contours.svg").is_file() and (ROOT / "assets/img/contours.svg").stat().st_size <= 150*1024, "Contour background missing or larger than 150 KB")
check("contours.svg" in read("assets/css/revision3.css"), "Contour background is not wired into the stylesheet")
check('data-lang-set="zh"' in html and 'data-lang-set="en"' in html, "Language segmented control is missing")
check('Smart Brain' in read("assets/js/registry.js") and '#/smart-brain' in read("assets/js/registry.js") and 'smart-brain' in router, "Smart Brain product entry or route is missing")
check("SpeechSynthesisUtterance" in read("assets/js/smartbrain/narration.js") and "voiceschanged" in read("assets/js/smartbrain/narration.js"), "Narration provider is incomplete")
check("function makeDataSeaRenderer(stage)" in engine and "const DURATION = 10000" in engine, "Ten-second data-sea renderer is missing")
check('scene: "data-sea"' in manifest, "beLieve has not switched to the data-sea particle scene")
check('class="primary-pill experiment-enter" href="#/e/${item.id}/run"' in sections, "Explicit experiment entry button is missing")
check('<a class="experiment-tile"' not in sections, "Experiment tile remains clickable outside the Enter button")
check('<div class="experiment-tile data-sea-tile">' in sections, "Data-ocean tile layout positioning class is missing")
check('const ROWS = mobile ? 24 : 34;' in engine and 'ctx.strokeStyle = "rgba(242,204,77,.34)";' in engine, "Data ocean contrast/density settings are missing")
check("},120); // keep a quiet low-rate shimmer without a 60 FPS idle loop" in engine, "Idle particle loop should use the low-rate timer")
check('fallback.dataset.staticDots !== "true"' in engine, "Static fallback regeneration guard is missing")
check("IntersectionObserver" in engine, "Particle viewport gating is missing")
check("maxLiveContexts" in engine or "MAX_LIVE_CONTEXTS" in engine or "maxLive" in engine, "WebGL context cap is not discoverable in engine")
check("prefers-reduced-motion" in engine or "reducedMotion" in engine, "Reduced-motion handling is missing")
check("pauseAll(true)" in router and "pauseAll(false)" in router, "Particle engine is not paused/resumed by route lifecycle")
check('"site": "aloop"' in runtime or 'site: "aloop"' in runtime, "Experiment export/event metadata is missing site id")
check('experiment_id: "believe"' in runtime and 'app_version: "0.1.0"' in runtime, "Experiment export/event metadata is incomplete")
check('"aloop_believe_session_v1"' in runtime, "New beLieve session key is missing")
check('"llab_active_session_v2"' in runtime, "Legacy session migration is missing")
check('"aloop_lang_v1"' in i18n and '"llab_lang_v1"' in i18n, "Language preference migration is missing")
check('name: "beLieve"' in manifest, "Experiment name/casing is incorrect")
check('load: () => window.Aloop.loadScript("experiments/believe/runtime.js")' in manifest, "Runtime is not lazy-loaded in the regular site build")
check('"nav.experiments": "实验"' in i18n and '"nav.experiments": "Experiments"' in i18n, "Site i18n dictionary is incomplete")

# Products navigation and EasySci directory acceptance checks.
nav_match = re.search(r'<nav class="primary-nav"[^>]*>(.*?)</nav>', html, flags=re.S)
nav_html = nav_match.group(1) if nav_match else ""
check('id="experimentsToggle"' in nav_html and 'id="productsToggle"' in nav_html,
      "Products is not a sibling navigation item to Experiments")
check('id="productsMenu"' in html and 'aria-labelledby="productsToggle"' in html and 'route: "#/easysci"' in read("assets/js/registry.js"),
      "Products menu does not expose the EasySci destination")
check('aria-haspopup="menu"' in nav_html and 'aria-expanded="false"' in nav_html,
      "Top-level menu buttons lack menu disclosure semantics")
quickmenu = read("assets/js/ui/quickmenu.js")
check("Aloop.productsMenu" in quickmenu and 'event.key === "Escape"' in quickmenu,
      "Products menu is missing close/keyboard interaction behavior")
check('"nav.products": "产品"' in i18n and '"nav.products": "Products"' in i18n,
      "Products navigation is not translated in both languages")

# Parse the JSON-compatible resource records embedded in the classic script and audit data integrity.
data_source = read("assets/js/easysci/data.js")
data_match = re.search(r'const C=(\{.*?\});\s*const R=(\[.*?\]);\s*A\.easysciData', data_source, flags=re.S)
try:
    categories_data = json.loads(data_match.group(1)) if data_match else {}
    resources = json.loads(data_match.group(2)) if data_match else []
except Exception as exc:
    categories_data, resources = {}, []
    check(False, f"EasySci structured data cannot be parsed as JSON-compatible records: {exc}")
check(len(resources) >= 60, f"Expected an expanded resource directory with at least 60 records; found {len(resources)}")
check(len({item.get("id") for item in resources}) == len(resources), "EasySci record IDs are not unique")
urls = [item.get("officialUrl", "") for item in resources]
check(all(re.match(r"^https://[^/\s]+", url) for url in urls), "EasySci includes an empty, malformed, or non-HTTPS official URL")
check(len(set(urls)) == len(urls), "EasySci has duplicate official URLs")
category_counts = {category_id: sum(item.get("category") == category_id for item in resources) for category_id in categories_data}
check(len(category_counts) >= 8 and all(count >= 50 for count in category_counts.values()), f"Every EasySci category must contain at least 50 distinct tools/resources; found {category_counts}")
check(all(item.get("verificationStatus") == "needs-manual-confirmation" and item.get("lastVerifiedAt") is None for item in resources), "Unverified tool claims must not be presented as live-verified")
required_resource_fields = ("name", "category", "officialUrl", "accessModels", "description", "details", "useCases", "strengths", "limitations", "signIn", "freeTier", "licenseNote", "lastVerifiedAt")
check(all(all(field in item for field in required_resource_fields) for item in resources), "One or more EasySci resources lack required structured metadata")
check(all(item.get("category") in categories_data for item in resources), "EasySci resource references an undefined category")
# Primary taxonomy is Skill/MCP, with bundles cross-listed by the capabilities they contain.
kind_counts = {kind: sum(item.get("kind") == kind for item in resources) for kind in ("resource", "skill", "mcp", "plugin")}
capability_counts = {kind: sum(kind in item.get("capabilities", []) for item in resources) for kind in ("skill", "mcp")}
check(len(resources) >= 130, f"Expected legacy resources plus an expanded Skill/MCP/plugin shortlist; found {len(resources)}")
check(kind_counts["resource"] >= 68 and kind_counts["skill"] >= 30 and kind_counts["mcp"] >= 25 and kind_counts["plugin"] >= 8,
      f"Unexpected EasySci type inventory: {kind_counts}")
check(capability_counts["skill"] >= kind_counts["skill"] and capability_counts["mcp"] >= kind_counts["mcp"],
      f"Skill/MCP capability filters do not include their corresponding record types: {capability_counts}")
check(all(item.get("kind") in {"resource", "skill", "mcp", "plugin"} for item in resources), "EasySci has an unknown primary capability type")
check(all(set(item.get("capabilities", [])) <= {"skill", "mcp"} for item in resources), "EasySci contains an unsupported capability facet")
check(all(item.get("installation") for item in resources if item.get("kind") in {"skill", "mcp", "plugin"}), "New Skill/MCP/plugin entry is missing visible setup guidance")
check(all(not re.search(r"[\u4e00-\u9fff]", item.get("installation", {}).get("en", "")) for item in resources if item.get("kind") in {"skill", "mcp", "plugin"}), "An English Skill/MCP/plugin setup note contains untranslated Chinese text")
check(all(item.get("capabilities") for item in resources if item.get("kind") == "plugin"), "Plugin bundle lacks its Skill/MCP capability mapping")
check(all(f'"{name}"' in data_source for name in ("Grill Me", "Grill with Docs", "Improve Codebase Architecture", "Mem0 MCP", "World Monitor MCP", "Firecrawl Agent Plugin")), "One or more current Skill/MCP highlights are missing")
meta_ids = {"jasp-meta-analysis", "jamovi-metajam", "jamovi-major", "r-metafor", "r-meta-package", "r-robma", "robvis", "revman-web", "comprehensive-meta-analysis", "meta-essentials", "meta-analysis-skill", "meta-analysis-methodology-skill"}
meta_records = {item.get("id"): item for item in resources if item.get("id") in meta_ids}
check(meta_ids <= set(meta_records), f"Meta-analysis tool shortlist is incomplete: missing {sorted(meta_ids - set(meta_records))}")
check(all(item.get("category") == "data" and "meta-analysis" in item.get("tags", []) for item in meta_records.values()), "Meta-analysis items must appear in the data-analysis domain and carry meta-analysis tags")
check(meta_records.get("meta-analysis-skill", {}).get("accessModels") == ["Free"] and "PolyForm Noncommercial" in meta_records.get("meta-analysis-skill", {}).get("licenseNote", {}).get("en", ""), "Non-commercial terms for the new meta-analysis automation skill were not disclosed")
check(all(set(item.get("accessModels", [])) <= {"Free", "Freemium", "Paid", "Open Source"} for item in resources), "EasySci resource has an unknown access-model label")
check('target="_blank" rel="noopener noreferrer"' in read("assets/js/easysci/easysci.js"), "EasySci outbound links do not use safe external-link attributes")
check('data-expand="${esc(id)}"' in read("assets/js/easysci/easysci.js") and 'aria-expanded="${opened}"' in read("assets/js/easysci/easysci.js"), "EasySci cards lack explicit accessible disclosure controls")
check('data-access="${esc(v.id)}"' in read("assets/js/easysci/easysci.js") and "accessModels" in data_source, "EasySci access-model filters are missing")
check('data-kind="skill"' in read("assets/js/easysci/easysci.js") and 'data-kind="mcp"' in read("assets/js/easysci/easysci.js") and "hasCapability(item, state.kind)" in read("assets/js/easysci/easysci.js"), "EasySci Skill/MCP primary taxonomy or cross-listed plugin filter is missing")
check("--accent-yellow: #FFD84D" in tokens and "var(--accent-yellow)" in read("assets/css/easysci.css"), "Reusable bright-yellow accent token is missing from EasySci styling")
check("font-size:18px;font-weight:750" in read("assets/css/easysci.css"), "EasySci summary typography is not enlarged and bold")
check(".es-action-primary:hover,.es-action-primary:active,.es-action-primary:focus-visible" in read("assets/css/easysci.css"), "Yellow external-action interaction feedback is missing")
check('if (parts[0] === "easysci")' in router, "Direct EasySci routes are not supported by the existing hash router")
check('"hero.brainLabel"' in i18n and '"hero.brainCanvasLabel"' in i18n and '"hero.brainCredit"' in i18n and '"exp.enter"' in i18n, "Accessible 3D brain labels / model attribution are missing from i18n")
check('requireLogin: true' in manifest and 'item.requireLogin && !Aloop.auth?.user' in router, "Experiment login gate is missing")
auth = read("assets/js/core/auth.js")
check('String(email ?? "").trim() !== "1"' in auth and 'String(password ?? "") !== "1"' in auth, "Local debug account is not configured as requested")
check('TEXT_TRAVEL = 0.57' in engine and 'WAVE_SPEED = 0.8' in engine and 'addStop(0, "rgba(255,255,255,0)")' not in engine, "Data-ocean motion speed/glow tuning is missing")
check('"auth.debugHint"' in i18n and '"auth.validation.credentials"' in i18n and '"nav.account"' in i18n, "Bilingual local-login UI strings are incomplete")
check("?qa=1" in roadmap and "A/B/C" in roadmap, "Roadmap does not document QA-only condition routing")
check("<div id=\"experimentSections\"" in html, "Experiment sections mount point is missing")
check("id=\"experiment-root\"" in html, "Experiment runtime root is missing")
check("condition-card" not in sections and "arm=A" not in html, "Public homepage appears to expose condition cards/arm links")
check("accounts are not enabled" in read("README.md") or "账号" in read("README.md"), "README does not explain the mock auth state")

# Guard against accidentally reintroducing broken legacy rendering and heavyweight clones.
check("620.0" not in engine, "Legacy oversized point-size multiplier reappeared")
check("webclone-local-loader.js" not in html, "Heavy third-party site-clone loader should not be bundled")
check("GSAP" not in html and "ASScroll" not in html, "Large source-site animation bundles should not be imported")

# Ensure supplied source specs were copied intact for traceability.
source_pairs = [(ROOT / "design.md", Path("/mnt/data/design.md")), (ROOT / "roadmap.md", Path("/mnt/data/roadmap.md"))]
for project_copy, upload in source_pairs:
    if upload.exists():
        check(project_copy.read_bytes() == upload.read_bytes(), f"Copied source file changed unexpectedly: {project_copy.name}")

# JavaScript syntax check using Node if available.
js_files = sorted(ROOT.rglob("*.js"))
node = subprocess.run(["node", "--version"], capture_output=True, text=True)
if node.returncode == 0:
    for path in js_files:
        result = subprocess.run(["node", "--check", str(path)], capture_output=True, text=True)
        check(result.returncode == 0, f"JavaScript syntax error in {path.relative_to(ROOT)}: {(result.stderr or result.stdout).strip()}")
else:
    print("NOTE: Node.js not found; JavaScript syntax checks skipped.")

# Verify generated standalone file, when present.
standalone_path = ROOT / "standalone.html"
if standalone_path.exists():
    standalone = standalone_path.read_text(encoding="utf-8")
    check("<script src=\"" not in standalone and "<link rel=\"stylesheet\" href=\"assets/" not in standalone,
          "standalone.html still depends on local external resources")
    check("Aloop" in standalone and "beLieve" in standalone, "standalone.html lacks Aloop/beLieve app shell")
    inline_scripts = re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>", standalone, flags=re.S | re.I)
    if node.returncode == 0:
        app_scripts = [script for script in inline_scripts if "window.AloopGL" in script and "embedded experiments/believe/runtime.js" in script]
        if app_scripts:
            import tempfile
            with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8", delete=False) as tmp:
                tmp.write(app_scripts[-1].replace(r"<\/script", "</script"))
                tmp_path = Path(tmp.name)
            try:
                result = subprocess.run(["node", "--check", str(tmp_path)], capture_output=True, text=True)
                check(result.returncode == 0, f"Combined standalone JavaScript syntax error: {(result.stderr or result.stdout).strip()}")
            finally:
                tmp_path.unlink(missing_ok=True)
        else:
            check(False, "Could not locate the combined standalone application script for syntax validation")
else:
    check(False, "standalone.html has not been generated")

if ERRORS:
    print(f"FAIL: {len(ERRORS)} of {CHECKS} checks failed")
    for err in ERRORS:
        print(f"  - {err}")
    sys.exit(1)
print(f"PASS: {CHECKS} static checks; {len(js_files)} JavaScript files parsed successfully.")
