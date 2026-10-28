## Current implementation status — 2026-10-22

This section supersedes the historical inventory counts later in this report. The prior entries below document earlier releases and are retained as revision history.

- EasySci contains **432** distinct catalogue records in eight categories: research 52, data 50, experiment 57, design 55, image 50, assets 68, creative 50 and coding 50. The directory retains resource/Skill/MCP/plugin kinds and progressive rendering of 50 cards per batch.
- Each record has a unique ID and unique HTTPS official URL string. These syntactic integrity checks do not verify that all live URLs, prices, access tiers or licences are current. All 432 items are explicitly marked `needs-manual-confirmation` until a person checks the relevant primary source.
- The homepage has replaced its particle/schematic brain with a Three.js GLB cortical surface viewer using the `bx_cat=cortex` mesh metadata from `itayinbarr/brainproject`. It provides camera controls, region picking, a reduced-motion/performance-aware render loop, accessible status and an external recovery link.
- Viewer source and geometry are separately licensed: Apache-2.0 for the source project code and CC BY-SA 4.0 for the Z-Anatomy/BodyParts3D-derived 3D anatomy asset. A local attribution is visible beside the model.
- Validation: `python tests/static_smoke.py` passed (162 checks; 19 JavaScript files parsed); a targeted browser smoke run passed 15/15 interaction checks covering the 3D model ready/error state, 432 catalogue records, category thresholds, pagination, filters, search, detail routing, language switching and the account modal. The full headless browser suite timed out in this sandbox, and live model rendering could not be verified because the sandbox could not resolve the external CDN/model hosts. These are not reported as passing tests.
- Detailed requirement, architecture, licensing, deployment and acceptance specifications are in [`TECHNICAL_SPECIFICATIONS.md`](TECHNICAL_SPECIFICATIONS.md); catalogue sourcing and limitations are in [`docs/EASYSCI_CATALOGUE_RESEARCH.md`](docs/EASYSCI_CATALOGUE_RESEARCH.md).

---

# Aloop Products & EasySci Implementation Report

**Date:** 2026-10-16  
**Source project:** `Aloop-source-v5-brain-tones.zip`  
**Requirements:** `easysci_product_directory_prompt_en.md`

## 1. Delivered

The existing static HTML/CSS/classic-JavaScript site was updated in place. No new frontend framework or runtime dependency was introduced.

- The top navigation has **Experiments** and **Products** as peer items. **Products → EasySci** opens `#/easysci`; resource detail routes use `#/easysci/<slug>`.
- The existing Experiments menu and hash router remain in place. Products supports outside-click and Escape dismissal, focus restoration, keyboard operation, and responsive behavior.
- EasySci supports Chinese/English labels; keyword search across names, task/capability terms, categories, descriptions, limitations and access labels; combined category and access-model filters; sorting; data-derived total/result/facet counts; inline detail expansion; empty states; and direct detail routes.
- Each resource stores a summary, tailored overview, typical use cases, strengths, limitations, sign-in expectations, access-model-aware free-tier caveats, licensing notes, sources and verification status. The 22 legacy entries no longer use the earlier generic detail boilerplate; sign-in descriptions are no longer identical across all entries.
- External destinations are normalized to HTTPS, validated before rendering, shown with a recognizable domain, and opened using `target="_blank"` plus `rel="noopener noreferrer"`.
- Resource names use the reusable `--accent-yellow: #FFD84D` marker. Summaries are bold and approximately 18px on desktop. Official-site buttons have yellow hover/active/focus-visible treatments with dark text; reduced-motion and narrow-screen rules are retained.
- `standalone.html` was regenerated from the maintained source files.

## 2. Resource inventory

The initial directory contained 22 records; earlier revisions expanded it to 136. The current revision adds a dedicated meta-analysis collection while preserving the existing Skill / MCP / Agent Plugin taxonomy.

| Metric | Previous release | Current |
|---|---:|---:|
| Unique directory records | 136 | 148 |
| Web/software resources | 68 | 78 |
| Standalone Skill records | 32 | 34 |
| Standalone MCP records | 28 | 28 |
| Agent Plugin / Bundle records | 8 | 8 |
| Unique official URL strings | 136 | 148 |
| Duplicate official URL strings | 0 | 0 |

The eight user-facing task domains remain available as secondary filters:

| Task domain | Count |
|---|---:|
| Coding & Research Workflow | 41 |
| Literature & AI Research | 32 |
| Statistics & Data Visualization | 32 |
| Stock Assets, Icons & Fonts | 15 |
| Graphic Design & UI | 13 |
| AI Creative Tools | 6 |
| Experiment & Survey Tools | 5 |
| Image Editing & Background Removal | 4 |
| **Total** | **148** |

Access-model counts are non-exclusive because one tool may be both Free and Open Source, or offer free and paid tiers.

| Access-model facet | Matching records |
|---|---:|
| Free | 92 |
| Freemium | 47 |
| Paid | 9 |
| Open Source | 73 |

Skill/MCP totals are also deliberately non-additive: agent plugin bundles are cross-listed in every capability they include. The **Skill** filter contains 42 matching records and the **MCP** filter contains 35, including bundled entries. These are selected resources, not a complete inventory or universal popularity ranking. Install counts and rankings are time-sensitive signals, not evidence of quality or suitability.

## 3. Files changed

**Updated:**

- `index.html` — Products navigation and menu markup.
- `assets/i18n/site.js` — bilingual Products/EasySci labels.
- `assets/js/ui/quickmenu.js` — Products menu interactions and keyboard behavior.
- `assets/js/core/router.js` — menu closure on route changes.
- `assets/js/easysci/data.js` — 148 structured records: 78 web/software resources, 34 Skills, 28 MCP servers, and 8 Agent Plugin / Bundle entries. The data-analysis domain has 12 additional meta-analysis-related entries.
- `assets/js/easysci/easysci.js` — Skill/MCP primary filters, secondary task-domain filters, capability-based cross-listing for bundles, installation notes, dynamic counts, search, detail expansion, direct detail routes and safe links.
- `assets/css/topbar.css`, `assets/css/easysci.css`, `assets/css/responsive.css`, `assets/css/tokens.css` — menu, directory, responsive styling and yellow design token.
- `design.md`, `README.md` — design and product behavior documentation.
- `standalone.html` — regenerated portable build with the updated 148-record directory.
- `tests/static_smoke.py`, `tests/browser_smoke.py` — acceptance and regression checks.

**Added:**

- `docs/superpowers/specs/2026-10-16-easysci-product-directory-design.md`
- `docs/superpowers/plans/2026-10-16-easysci-product-directory.md`

## 4. Verification results

| Check | Result | Scope / qualification |
|---|---|---|
| Standalone build | PASS | `standalone.html` regenerated; 8 stylesheets and 18 inline JavaScript modules bundled. |
| Static integrity test | PASS | 157 checks; all 18 JavaScript files parsed successfully with Node.js. |
| Browser smoke test | PASS | 69 Chromium checks using the generated standalone build; covers navigation, Escape/focus behavior, routing, URL uniqueness, Skill/MCP capability filters and cross-listed bundles, search, details, combined filters, brain interaction, data-sea stage, and app-shell invariants. |
| Responsive checks | PASS | Tested widths 320, 360, 390, 768, 1024 and 1440px; no horizontal overflow observed and Products menu stayed within viewport bounds. |
| Source-site local HTTP browser test | Environment limitation | The browser sandbox blocked navigation to the local HTTP server; browser checks therefore used the generated standalone build. |
| Live URL/pricing/license audit | Partially verified; remainder pending | The shell/container could not resolve external DNS for a complete automated link sweep. Web research checked the current Similarweb category page, Elicit pricing, Overleaf plans, Datawrapper pricing, Zotero storage documentation, and official Unsplash/Pexels/Pixabay license pages. The remaining destination and terms still need per-item review. All 148 records retain `lastVerifiedAt: null` and `verificationStatus: "needs-manual-confirmation"` to avoid implying that a full audit has occurred. |

The popularity signal is intentionally narrow: Similarweb's September 2026 *Graphics, Multimedia and Web Design* category lists Canva at #1 and remove.bg at #3. These are category traffic rankings, not universal quality or suitability rankings. See [Similarweb's category snapshot](https://www.similarweb.com/top-websites/computers-electronics-and-technology/graphics-multimedia-and-web-design/).

## 5. Remaining limitations

1. The 78 web/software resources are an editorially curated shortlist, not a complete directory or universal popularity ranking.
2. Local URL validation confirms HTTPS syntax and uniqueness; it does not prove that every official destination resolves or that redirects remain canonical. The remaining URLs, pricing, sign-in requirements, product limits and license conditions require item-level review.
3. No entry is marked fully verified. Access-model labels are useful summaries, not a guarantee that every feature, export size, API call, hosted service or commercial use is free.
4. Automated browser verification used the portable standalone build because the browser sandbox blocked local HTTP navigation. The receiving environment should still run deployment-specific checks.
5. Existing account/sign-in behavior remains the site's existing mock/auth experience; this task does not implement a new account backend.


## 6. EasySci Agent Skill / MCP refresh (2026-10-16)

The current revision extends EasySci from 136 to 148 unique directory records by adding a meta-analysis and systematic-review tool cluster. The main classification is now **Skill / MCP**. Existing research-task domains (research, data, experiment, design, image, assets, creative, coding) remain secondary filters so earlier entries and URLs are preserved.

| Record type | Count | Behavior |
|---|---:|---|
| Web/software resources | 78 | Visible in All resources |
| Skill | 34 | Visible in Skill filter |
| MCP | 28 | Visible in MCP filter |
| Agent Plugin / Bundle | 8 | Cross-listed into every included capability filter |
| **Unique records** | **148** | IDs and official URL strings are unique |

The refreshed shortlist includes current high-install skills from `skills.sh` (Grill Me, Grill with Docs, Improve Codebase Architecture, TDD, HyperFrames), Firecrawl Skills, World Monitor Agent Skills, Mem0 MCP, World Monitor MCP, and Firecrawl/World Monitor Agent Plugin bundles. Existing Context7, Playwright, Exa, Notion, Figma, Jupyter, Zotero, Supabase, Linear, Sentry and reference MCP servers remain in the catalogue. Skills now have concise installation notes in addition to example CLI commands; bundle descriptions explain that compatibility and install conventions differ by host client.

Current sources used to curate additions include the live [skills.sh leaderboard](https://www.skills.sh/), [Vercel's official Agent Skills collection](https://github.com/vercel-labs/agent-skills), [Model Context Protocol reference servers](https://github.com/modelcontextprotocol/servers), [Firecrawl Skills catalog](https://github.com/firecrawl/skills), [Mem0 MCP setup documentation](https://github.com/mem0ai/mem0/blob/main/skills/mem0/references/features.md), and [World Monitor agent interface documentation](https://www.worldmonitor.app/agents.md). Catalog popularity and repository paths change quickly, so every newly added item retains `lastVerifiedAt: null`; the UI warns users to verify source, permission scope, authentication, license and usage limits before installation.


## 7. Meta-analysis tools added (2026-10-16)

The data-analysis domain now includes 10 resource/software entries and 2 Skills. Tool types are distinguished in their details: (a) statistical engines/packages—`metafor`, `meta`, `RoBMA`; (b) GUI and spreadsheet workflows—JASP Meta-Analysis, MetaJam, MAJOR, CMA, Meta-Essentials; (c) workflow/visualization—RevMan Web and robvis; (d) community Agent Skills—an audit-gated R workflow and a methodology/reference bundle. The additions are tagged `meta-analysis` so they appear under the data domain and can be searched directly.

The automation Skill from `O0000-code/meta-analysis-skill` is deliberately marked non-commercial-only based on its current license: executable code under PolyForm Noncommercial 1.0.0 and methodology content under CC BY-NC-SA 4.0. Its own repository states that the current version is not OSI-approved open source. Both new Skills are marked as requiring manual verification; their presence does not certify methodological accuracy.


## Iteration log — 2026-10-24 (partial implementation; not fully accepted)

**Scope:** requested navigation/licence information architecture, homepage cortical particle appearance, interaction colour tokens, and engineering documentation synchronization.

**Files changed**
- `index.html`: added top-level About/说明 entry; removed the homepage hero model-credit block.
- `说明.html`: added an independent information page with source attribution and explicit licence-audit limitations.
- `assets/i18n/site.js`: added Chinese/English navigation labels.
- `assets/css/topbar.css`, `assets/css/tokens.css`: yellow active emphasis, focus ring, pressed/disabled tokens and shared interaction rules.
- `assets/js/gl/particle-cortex.js`: `uSize` 0.007 → 0.07; blue/white/yellow uniforms; sample the GLB surface, then hide cortex meshes only within the homepage scene.
- `assets/js/smartbrain/model-viewer.js`: added an independent Three.js GLB viewer for the Smart Brain product, with drag rotation, wheel zoom, click-to-select/highlight, reset, responsive resize, and teardown.
- `assets/js/smartbrain/learn.js`, `assets/css/revision3.css`, `index.html`: integrated the viewer into Smart Brain overview and loaded the module in source/standalone builds.
- `TECHNICAL_SPECIFICATIONS.md`, `IMPLEMENTATION_REPORT.md`: synchronized this iteration and its unresolved requirements.

**Verification (2026-10-24):** `python tests/static_smoke.py` passed (177 checks; 24 JavaScript files parsed); `node tests/i18n_parity.js` passed (zh=106, en=106); `python tests/build_standalone.py` exited 0 and regenerated `standalone.html`. The test process emitted a non-fatal spreadsheet-runtime warmup traceback on stderr despite exit 0. Browser/GPU visual acceptance has not been run. No browser/GPU visual acceptance has been run for this iteration. The source ZIP contains no local `.glb`, `.gltf`, `.obj`, `.fbx`, `.stl` or `.ply` asset. The homepage renderer currently fetches its GLB from an external upstream URL. The Smart Brain code present in this archive is a learning/narration UI; this iteration has not implemented a product-level real-model viewport. The beLieve text/cursor motion controls could not be identified in `experiments/believe/runtime.js` or `experiments/believe/believe.css`, so the 10% slowdown remains unimplemented rather than changing unrelated timings.

**Known risks / pending acceptance**
1. `说明.html` identifies source/licence information from current source comments and links; exact upstream licence files and the deployed Three.js version still require audit.
2. External GLB/CDN access and WebGL rendering require browser verification on a networked GPU-enabled environment.
3. Smart Brain real-model viewer is implemented against the upstream GLB, but live model loading, orientation, mesh picking and GPU rendering are not browser-verified. The GLB is not bundled locally.
4. beLieve text/cursor flow must be traced to its actual rendering source before a precise 0.90 speed adjustment.
5. Button rules require a visual regression pass across all route states; shared CSS alone does not constitute acceptance.



## Follow-up — Smart Brain real-model integration (2026-10-24)

- Corrected the earlier interpretation: the upstream `itayinbarr/brainproject` repository contains `brain-atlas/models/brain.glb`; Aloop already used that remote URL for homepage surface sampling. The model is available upstream but is not packaged as a local binary in this ZIP.
- Added a dedicated product viewer at `assets/js/smartbrain/model-viewer.js`, mounted only on `#/smart-brain`. It creates its own Three.js scene, renderer, camera, lights, materials, raycaster and pointer controls; it never reuses or mutates homepage particle-cortex objects.
- Interaction implemented: drag-to-rotate, wheel-to-zoom with bounds, click a mesh to show its name and highlight it, reset view, responsive resize, loading/error status, and teardown on leaving the product or opening Learn. The existing Learn narration behavior remains in place.
- Model source and attribution are shown in the product UI. Upstream asset licensing remains CC BY-SA 4.0; upstream source code is separately Apache-2.0.
- **Acceptance status:** static syntax/markup/build checks are run for this follow-up. Live remote GLB loading, actual anatomical orientation, click target granularity, GPU performance and mobile interaction require a network-enabled browser and remain unverified here. beLieve text/cursor 10% slowdown also remains open because its actual motion controls have not yet been identified.

## Revision 3.1 — Smart Brain Explore (2026-10-28)

Added the Explore tab (brain click ↔ sidebar knowledge card). Verified: `static_smoke.py` (191 checks), `i18n_parity.js` (146 keys each), `atlas_store.test.js`, and a headless-Chromium run with a mocked manifest covering: sidebar usable with the model blocked, search, list select → card, URL sync, isolate, language switch keeping selection, unknown-id link, teardown on leaving. **Not verified here:** 3D picking/highlight/camera against the real `brain.glb` and `manifest.json` (sandbox has no network). First thing to check in a real browser: that `bx_*` keys and the TA2 path field in `manifest.json` match `data.js` normalisation.
