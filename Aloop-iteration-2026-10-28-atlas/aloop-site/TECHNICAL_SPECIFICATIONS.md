# Aloop — Technical Specification (Revision 3)

**Revision date:** 2026-10-24
**Supersedes:** Revision 2 (2026-10-22, "3D Cortical Surface Viewer")
**Status:** Partially implemented in the project tree; see §14 and the latest implementation report for unresolved items and verification limits. `python tests/static_smoke.py` passes (174 checks) and `node tests/i18n_parity.js` passes; the WebGL particle renderer has **not** yet been run against a real GPU/CDN (§13.3).
**Normative language:** The key words MUST, MUST NOT, SHOULD and MAY are used as defined in RFC 2119.

---

## 0. Change summary

| ID | Change | Affected area |
|---|---|---|
| CHG-1 | Rename the "Brain Project" product to **Smart Brain** and register it as a first-level product entry, a sibling of **EasySci**. | Information architecture, routing, i18n |
| CHG-2 | Provide a Chinese/English (zh-CN / en) language switcher as a persistent, accessible control. | Internationalisation (i18n) |
| CHG-3 | Add a text-to-speech (TTS) **voice-over narration** feature to the **Learn** module. | Smart Brain → Learn |
| CHG-4 | Replace the homepage's mesh-based cortical viewer with a **GPU-instanced tetrahedral particle system** sampled from the surfaces of both cerebral hemispheres. Retain click-expand/restore and pointer-synchronised rotation. | Homepage hero |
| CHG-5 | Replace the page background image with a procedurally generated **blue-and-white contour (isoline) map**. | Global theme |

### 0.1 Baseline observations (supplied code base, Revision 2)

These findings determine the scope of each change and are stated so that implementers do not search for non-existent artefacts.

1. **"Brain Project"** is not a product name in the current UI. It appears only as the upstream repository name `itayinbarr/brainproject`, which is the model's source. CHG-1 therefore *introduces* the Smart Brain product entry; the upstream repository name MUST remain unchanged wherever it serves as a licence attribution or source link.
2. The **Products** menu (`#productsMenu`) currently contains a single item, EasySci (`#/easysci`).
3. A language toggle already exists (`#langToggle`, label `EN`, backed by `Aloop.i18n.set()`). CHG-2 formalises and upgrades it; it does not add a second mechanism.
4. **No "Learn" module exists.** CHG-3 defines the module (minimum viable scope in §5) in addition to the narration feature.
5. The current background is `var(--bg)` plus a hero overlay (`.hero-section::after`) containing an inline SVG data-URI of topographic linework at 23 % opacity. CHG-5 replaces it.
6. The hero viewer (`assets/js/gl/brain-surface.js`) renders the GLB cortex as shaded meshes with `OrbitControls` and raycast region picking. CHG-4 supersedes this renderer for the homepage.

---

## 1. Objectives and scope

1. Present Smart Brain as an independent product alongside EasySci, with a bilingual interface and an educational (Learn) experience that supports spoken narration.
2. Deliver a visually distinctive homepage hero: a particle-based representation of the two cortical hemispheres that responds to pointer input in real time.
3. Establish a light, blue-and-white visual identity using a contour-map background.

**Out of scope:** server-side accounts, persistence, research-grade data collection, and clinical use. Authentication remains a client-side prototype and experiment sessions remain browser-local, as in Revision 2. The EasySci catalogue (432 records; schema and verification policy) is **unchanged** and remains governed by Revision 2 §2.

---

## 2. Information architecture and routing (CHG-1)

### 2.1 Product taxonomy

```
Primary navigation
├── Experiments  ▾  (unchanged)
└── Products     ▾
    ├── EasySci        → #/easysci        (tier 1)
    └── Smart Brain    → #/smart-brain    (tier 1, same level as EasySci)
                          ├── Overview     #/smart-brain
                          └── Learn        #/smart-brain/learn
```

| Req. | Requirement |
|---|---|
| IA-1 | Smart Brain MUST be rendered in the Products menu as a peer of EasySci: same component, same hierarchy level, same visual weight. It MUST NOT be nested under EasySci or under another product. |
| IA-2 | The menu item MUST follow the existing `products-menu-item` pattern: monogram badge (`SB`), name, one-line description, external-arrow affordance, `role="menuitem"`. |
| IA-3 | Routes MUST use the existing hash router. `#/smart-brain` and `#/smart-brain/learn` MUST be registered in `router.js`; unknown sub-routes MUST fall back to `#/smart-brain`. |
| IA-4 | All user-visible occurrences of the legacy label "Brain Project" MUST be replaced with "Smart Brain" (zh-CN display name: **智脑 Smart Brain**; the Latin name is retained in both languages for brand consistency). |
| IA-5 | Product metadata MUST live in a single registry object (`id`, `slug`, `route`, `monogram`, i18n keys) so that further products can be added without editing the menu markup. |
| IA-6 | The upstream attribution string "Z-Anatomy / BodyParts3D · CC BY-SA 4.0" and the link to `itayinbarr/brainproject` MUST remain (see §10). They are source credits, not product names. |

---

## 3. Internationalisation (CHG-2)

| Req. | Requirement |
|---|---|
| I18N-1 | The language switcher MUST be a persistent control in the top bar, visible on every route, and presented as a two-segment toggle **中 / EN** (or equivalent), with the active locale visually and programmatically indicated (`aria-pressed` on each segment, or `role="radiogroup"` with `aria-checked`). |
| I18N-2 | Supported locales: `zh-CN` (default) and `en`. Switching MUST update, without a page reload: all `data-i18n` text nodes, `data-i18n-attr` attributes, `document.documentElement.lang` (`zh-CN` / `en`), `data-lang`, and `document.title`. |
| I18N-3 | The selected locale MUST persist in `localStorage` under a namespaced key (`aloop.lang`). On first visit the default is derived from `navigator.languages`; any language other than Chinese maps to `en`. Storage failures MUST NOT break the switcher (fall back to in-memory state). |
| I18N-4 | The dictionary MUST have **key parity**: every key present in one locale MUST exist in the other. The static smoke test MUST fail on any missing or orphaned key (extends `tests/static_smoke.py`). |
| I18N-5 | Locale changes MUST dispatch the existing `aloop:language` event so dependent components (sound toggle, hero controls, TTS) can update labels and voices. |
| I18N-6 | Layout MUST tolerate string-length expansion (EN labels are typically 30–60 % longer than zh-CN) without truncation of controls at ≥ 320 px viewport width. |
| I18N-7 | Date, number and list formatting MUST use `Intl.*` with the active locale. |
| I18N-8 | The switcher MUST be keyboard operable (Tab, Enter/Space), have a minimum 44 × 44 CSS px hit target, and expose a localised accessible name. |

---

## 4. Homepage hero — tetrahedral particle cortex (CHG-4)

### 4.1 Functional overview

The right-hand hero panel renders ≈ 16 000 particles distributed over the outer surface of the **left and right cerebral hemispheres**. Each particle is a regular **tetrahedron**. The cloud is rendered as a single instanced draw call and animates entirely on the GPU.

### 4.2 Geometry source and point-set generation

| Req. | Requirement |
|---|---|
| PRT-1 | Particle positions MUST be derived from the **cortical surface geometry** (`bx_cat = "cortex"`) of the existing GLB model, not from a procedural ellipsoid. |
| PRT-2 | Sampling MUST be **area-weighted uniform sampling over triangles** (select a triangle with probability ∝ its area, then draw barycentric coordinates `(1−√u, √u(1−v), √u·v)`), optionally followed by Poisson-disk rejection (minimum distance ≈ 0.6 × mean spacing) to avoid clumping. |
| PRT-3 | Each sample stores: position `p ∈ ℝ³`, interpolated unit normal `n`, hemisphere flag `h ∈ {L, R}` and a per-particle random seed. Hemisphere assignment MUST use the mesh label metadata where present, otherwise the sign of *x* relative to the mid-sagittal plane. |
| PRT-4 | Both hemispheres MUST be represented with comparable density (±10 %), and the inter-hemispheric fissure MUST remain visibly separated. |
| PRT-5 | Sampling SHOULD be performed **offline** by a build script (`tests/build_particles.py` or Node equivalent) and shipped as a quantised binary asset (`assets/data/cortex-points.bin`, int16 positions/normals, ≤ 300 KB). This removes the runtime dependency on the remote GLB, Three.js GLTF/Draco loaders and CDN availability for the hero. |
| PRT-6 | If the point set is generated at runtime instead, it MUST run in a Web Worker so the main thread is not blocked for more than 50 ms. |

### 4.3 Particle primitive and rendering

| Req. | Requirement |
|---|---|
| PRT-7 | Each particle MUST be a regular tetrahedron (`THREE.TetrahedronGeometry(1, 0)`; 4 faces, 12 vertices non-indexed for flat shading). |
| PRT-8 | Rendering MUST use `THREE.InstancedMesh` (or `InstancedBufferGeometry`) with a custom `ShaderMaterial`: **one draw call** for the full cloud. |
| PRT-9 | Instance attributes: `aRest` (vec3), `aNormal` (vec3), `aSeed` (float), `aHemi` (float), `aScale` (float, 0.7–1.3 × base). Per-instance orientation MUST be derived in the vertex shader from the seed (axis-angle or quaternion), so no CPU-side matrix updates are required per frame. |
| PRT-10 | Tetrahedron edge length SHOULD scale with camera distance and viewport size so that projected size stays within 2–5 CSS px at 1× zoom. Flat per-face shading MUST use a directional light (Lambert, with screen-space derivative normals or analytic face normals) so that the tetrahedral facets are perceptible. |
| PRT-11 | Alpha handling: opaque, depth-tested particles by default (no sorting cost). Optional additive glow is OUT of scope for the light background. |
| PRT-12 | Particle budget: 16 000 (desktop), 8 000 (viewport < 768 px or `hardwareConcurrency ≤ 4`). The budget MUST be adaptable at runtime (see §4.6). |

### 4.4 Colour scheme

The hero sits on the light contour background (§6). Particles therefore use a **saturated blue sequential ramp** with a restrained cool accent and a single warm highlight, keeping every particle at ≥ 3 : 1 contrast against the background (WCAG 2.2 SC 1.4.11 non-text contrast).

| Token | Hex | Use |
|---|---|---|
| `--pt-deep` | `#1B3A66` | Shadowed faces, sulcal depth (darkest tone) |
| `--pt-primary` | `#315E91` | Brand primary; dominant body tone (≈ 55 % of particles) |
| `--pt-mid` | `#477EAE` | Gyral crowns, lit faces (≈ 30 %) |
| `--pt-cyan` | `#3A9FA8` | Sparse neural-signal accent (≈ 12 %); darkened from `#5AB7BD` to meet 3 : 1 on white |
| `--pt-signal` | `#F2CC4D` | Interaction highlight only (click wave front, keyboard focus); ≤ 3 % of particles at any instant |

| Req. | Requirement |
|---|---|
| COL-1 | Base colour is selected per particle by a deterministic function of (seed, hemisphere, curvature/depth proxy `n·viewDir`): the left hemisphere biases toward `--pt-primary`, the right toward `--pt-mid`, so the hemispheres are distinguishable without hue conflict. |
| COL-2 | The palette MUST be defined as CSS custom properties and passed to the shader as uniforms so it can be re-themed without editing GLSL. |
| COL-3 | Colour MUST NOT be the only means of conveying state: expansion, focus and loading states are additionally conveyed by motion, a focus ring, and a live-region message. |

### 4.5 Interaction model

| Req. | Requirement |
|---|---|
| INT-1 | **Pointer-synchronised rotation.** The cloud's yaw/pitch targets are linear in the pointer's normalised device coordinates over the stage: `yaw = ndc.x · 28°`, `pitch = −ndc.y · 16°` (clamped). The applied rotation is a critically damped follow (`θ += (θ* − θ)·(1 − e^(−Δt/τ))`, τ ≈ 90–140 ms) so that motion is perceived as synchronous with the pointer and is frame-rate independent. When the pointer leaves the stage, targets ease back to 0 over ≈ 600 ms. |
| INT-2 | **Click-to-expand.** On `pointerdown` inside the stage, a radial expansion is triggered: each particle is displaced along `aNormal` by `A · w(d, t) · (0.6 + 0.4·seed)`, where `d` is the distance from the picked surface point (nearest-hit by ray–sphere/ray–proxy-hull test, not full mesh raycast), `A ≈ 12 % of the brain's bounding radius`, and `w` is an expanding wave front. Rise time ≈ 220 ms (ease-out cubic). |
| INT-3 | **Restore.** After the peak, particles return to `aRest` via a damped spring (ζ ≈ 0.8, ω ≈ 7 rad/s, settle ≤ 1.0 s) with no residual drift. Total expand-and-restore cycle ≤ 1.2 s. Expansion and restoration MUST be evaluated in the vertex shader from uniforms (`uClickPos`, `uClickTime`, `uAmp`); no per-particle CPU updates. |
| INT-4 | Rapid repeated clicks MUST be handled by retaining at most 3 concurrent wave origins (ring buffer of uniforms); amplitude is clamped to prevent runaway displacement. |
| INT-5 | The existing 2-D **shockwave ring** (`.brain-stage.has-shockwave::after`) SHOULD be retained as a complementary cue, positioned at the pointer. |
| INT-6 | Touch: single-finger movement over the stage updates the rotation target via Pointer Events (`touch-action: pan-y` retained so vertical page scroll works); a tap triggers expansion. Multi-touch gestures are not handled. |
| INT-7 | Keyboard (stage has `tabindex="0"`, `role="img"` with a descriptive label): `Enter`/`Space` triggers expansion at the centre; `←/→/↑/↓` nudge the rotation target by 6°; `Home` resets rotation. |
| INT-8 | Optional idle behaviour: a ≤ 1 % amplitude "breathing" oscillation MAY run when the pointer is idle for > 3 s, only if `prefers-reduced-motion: no-preference`. |
| INT-9 | The previous feature set — region picking by raycast, `OrbitControls` drag/zoom, and the auto-rotate and reset buttons — is **removed from the hero** (rotation is now pointer-driven). The GLB mesh viewer MAY be retained on the Smart Brain page as an optional "Anatomy" view; if so it is governed by Revision 2 §3 and is not part of this change. |
| INT-10 | `prefers-reduced-motion: reduce`: pointer-following rotation limited to ±6°, expansion amplitude reduced to 25 %, idle breathing disabled, all easing durations preserved ≤ 400 ms. |

### 4.6 Performance, loading and failure behaviour

| Req. | Requirement |
|---|---|
| PRF-1 | Target ≥ 55 fps interaction on a mid-range integrated GPU at 16 000 instances (≈ 192 000 vertices). Render loop: 60 fps cap while the pointer is active or an animation is in progress; 30 fps cap when idle; **no rAF loop** when the stage is off-screen (`IntersectionObserver`) or the document is hidden (`visibilitychange`). |
| PRF-2 | Device pixel ratio capped at 1.5 (desktop) and 1.0 (viewport < 768 px). |
| PRF-3 | An adaptive quality governor MUST halve the instance count (`instanceMesh.count`) when the 30-frame moving average frame time exceeds 24 ms, and MAY restore it after 5 s below 14 ms. |
| PRF-4 | Total hero payload (JS module + binary point set) SHOULD be ≤ 450 KB compressed excluding Three.js. Three.js MUST remain version-pinned via the import map. |
| PRF-5 | Initial paint: show a static SVG poster of the two hemispheres while the module initialises; cross-fade to canvas on `is-ready` (existing pattern). Cumulative Layout Shift contribution ≤ 0.02 (stage uses `aspect-ratio`). |
| PRF-6 | WebGL unavailable, context loss, or asset failure MUST produce an explicit, localised status message in an `aria-live="polite"` region and keep the static poster visible. The rest of the application MUST continue to function. `webglcontextlost` / `webglcontextrestored` MUST be handled. |

### 4.7 Accessibility

- The stage exposes `role="img"` with a localised `aria-label`; interactive hints are provided in visually available text, not only in the label.
- Expansion and rotation are non-essential decoration: no information is conveyed solely through them.
- Hero copy contrast MUST meet WCAG 2.2 AA (4.5 : 1) against the contour background (§6.4).

---

## 5. Smart Brain — Learn module with voice-over narration (CHG-3)

### 5.1 Module scope (minimum viable)

The Learn module is a sequence of **lessons** (initially ≥ 6: *Overview of the cerebral cortex, Hemispheres and the corpus callosum, Lobes, Gyri and sulci, Cortical areas, How to read the 3-D model*). Each lesson comprises a title, a body of ≥ 3 paragraphs, and optional figure references. All content MUST exist in both locales and be stored as structured data (`assets/js/smartbrain/lessons.js`), keyed by lesson ID and paragraph index.

### 5.2 Narration requirements

| Req. | Requirement |
|---|---|
| TTS-1 | Narration MUST be implemented behind a **provider interface** (`NarrationProvider`: `speak(segments, opts)`, `pause()`, `resume()`, `cancel()`, `on(event, cb)`, `getVoices()`). Two providers are specified: (a) **`WebSpeechProvider`** (default), using the Web Speech API `SpeechSynthesis` / `SpeechSynthesisUtterance`, and (b) **`AudioFileProvider`** (OPTIONAL), playing pre-rendered audio via `HTMLAudioElement` from `assets/audio/{lang}/{lessonId}-{n}.mp3`. |
| TTS-2 | Each lesson is segmented into **utterances at paragraph/sentence boundaries** (≤ 220 characters each) to avoid engine truncation and to make pause/resume reliable across browsers. |
| TTS-3 | Voice selection: choose a voice whose `lang` matches the active locale (`zh-CN`, then any `zh-*`; `en-US`, then any `en-*`), preferring `localService === true` when available. The user MAY override the voice in a settings popover; the choice is stored per locale. `getVoices()` is asynchronous in some engines: the provider MUST await the `voiceschanged` event with a timeout (≈ 1.5 s). |
| TTS-4 | Controls: **Play / Pause / Stop**, **Previous / Next paragraph**, **Rate** (0.75×–1.5×, default 1.0×), and a **Narration on/off** toggle. All controls MUST be keyboard operable, expose `aria-pressed` / `aria-label` in the active locale, and have visible focus. |
| TTS-5 | **Autoplay policy.** Narration MUST start only after an explicit user gesture (a Play action). Page load, route change and language change MUST NOT begin speech by themselves. |
| TTS-6 | **Lifecycle.** Narration MUST `cancel()` on route change, on lesson change, on `pagehide`, and when the document becomes hidden for > 30 s. On locale change the current lesson MUST stop, the voice MUST be re-resolved, and the user MAY resume in the new language from the beginning of the current paragraph. |
| TTS-7 | **Progress feedback.** The paragraph being spoken MUST be highlighted (tinted background plus a left border — not colour alone). Where the engine delivers `boundary` events, word-level highlighting MAY be added; because `boundary` support is inconsistent (notably for Chinese voices), paragraph-level highlighting is the normative requirement. |
| TTS-8 | **Capability detection and fallback.** If `window.speechSynthesis` is absent or no voice matches the locale, the narration controls MUST be disabled with a localised explanation ("Narration is not available in this browser/language") and the lesson text MUST remain fully readable. If `AudioFileProvider` assets exist for that locale it SHOULD be used instead. |
| TTS-9 | **Screen-reader coexistence.** The narration UI MUST NOT use `aria-live` for spoken content (to avoid double announcement). Status changes (playing, paused, stopped, unavailable) use a single polite live region. A "Read with narration" control MUST NOT suppress or replace assistive-technology reading. |
| TTS-10 | **Chromium workaround.** Because some Chromium versions stop a long-running utterance after ≈ 15 s, the provider MUST chain short utterances (TTS-2) and MUST NOT rely on a single long `speak()` call. |
| TTS-11 | Narration MUST be independent of the existing UI-sound system (`audio.js`); muting UI sounds does not affect narration, and narration does not modify its state. |
| TTS-12 | Privacy: the default provider performs synthesis locally in the browser or via the platform's speech service. No lesson text or usage telemetry is transmitted by Aloop code. If a cloud TTS provider is added later, it MUST be opt-in and disclosed. |

### 5.3 Captions

A transcript (the lesson text itself) is always visible. A "Show narration text" toggle is not required because the visible text is the transcript.

---

## 6. Background — blue-and-white contour map (CHG-5)

### 6.1 Concept

A global, static background composed of **isolines (contour lines) of a smooth scalar height field**, drawn as thin blue strokes on a white-to-pale-blue base. It replaces the existing `--bg` fill, the hero `::after` SVG data-URI and the dark hero gradients.

### 6.2 Generation

| Req. | Requirement |
|---|---|
| BG-1 | The height field `h(x, y)` MUST be produced by **multi-octave gradient noise (e.g. OpenSimplex, 4 octaves, lacunarity 2.0, gain 0.5)**, with a fixed seed so the output is reproducible. |
| BG-2 | Isolines MUST be extracted with **marching squares** on a regular grid (≈ 160 × 100 cells per 1600 × 1000 tile), with linear interpolation along cell edges and polyline stitching, then simplified (Ramer–Douglas–Peucker, ε ≈ 0.4 px) and smoothed (Chaikin, 1–2 iterations). |
| BG-3 | Contour interval: 24 levels. Every 5th level is an **index contour** (heavier stroke) and MAY carry no labels. Optional elevation labels are OUT of scope. |
| BG-4 | The map MUST be generated **at build time** by a script (`tests/build_contours.py` or Node) and emitted as an optimised **SVG** (`assets/img/contours.svg`, ≤ 150 KB) plus a pre-rendered `contours@2x.webp` fallback. Runtime generation on a `<canvas>` is acceptable only if completed in an idle callback, cached, and ≤ 40 ms per frame budget. |
| BG-5 | The tile MUST be seamless horizontally and vertically (periodic noise or cross-fade blending) if used with `background-repeat`; otherwise a single oversized SVG with `background-size: cover` is used. |

### 6.3 Visual specification

| Element | Value |
|---|---|
| Base fill | Vertical linear gradient `#FFFFFF` → `#EEF4FB` (top to bottom) |
| Minor contours | stroke `#477EAE`, `stroke-opacity: .22`, width `0.8px` |
| Index contours | stroke `#315E91`, `stroke-opacity: .38`, width `1.4px` |
| Optional hypsometric tint | Between alternate contour bands: `#DCE8F5` at 35 % opacity |
| Vignette | Radial fade to white behind hero copy and content columns so text contrast is preserved |

`vector-effect: non-scaling-stroke` MUST be applied so the line weight is resolution-independent.

### 6.4 Integration and contrast

| Req. | Requirement |
|---|---|
| BG-6 | The map MUST be implemented as a fixed-position layer (`body::before`, `z-index: -1`, `pointer-events: none`, `position: fixed; inset: 0`) so that it is not repainted on scroll. |
| BG-7 | The hero's dark gradient overlays and the `hero-section::after` data-URI MUST be removed. Hero typography changes from white to `--text` (`#253449`); contrast ≥ 4.5 : 1 on the lightest *and* darkest regions of the map is verified with an automated contrast check over a sampled grid. |
| BG-8 | The top bar remains deep blue (`rgba(35,70,109,.93)`) with white text; no change. |
| BG-9 | Motion: the map is **static**. An optional slow parallax (≤ 12 px translation relative to scroll) MAY be added, and MUST be disabled under `prefers-reduced-motion: reduce`. |
| BG-10 | `forced-colors: active` MUST hide the background layer. Print stylesheet MUST hide it. |
| BG-11 | The experiment runtime pages and EasySci surfaces keep their existing opaque white / pale-blue panels; the contour map only shows on the page canvas between panels. |

---

## 7. Design-token and stylesheet changes

| File | Change |
|---|---|
| `assets/css/tokens.css` | Add `--pt-*` particle tokens (§4.4); add `--bg-contour-*` tokens (§6.3). |
| `assets/css/theme-blue.css` | Remove hero dark gradient overlays and `.hero-section::after`; add contour layer; switch hero text to `--text`. |
| `assets/css/home.css` | Add `.particle-stage` styles for the new renderer; keep `.brain-stage` shockwave; remove obsolete `.brain-model-*` controls from the hero. |
| `assets/css/topbar.css` | Language segmented control (I18N-1); Smart Brain menu item (IA-2). |
| `design.md` | The rule "Do not substitute particle points … for the cortical surface" is **withdrawn** and replaced by §4. Update the colour-token and background sections accordingly. |

---

## 8. Module and file layout (additions and modifications)

```
assets/
├── data/cortex-points.bin            NEW  quantised point set (§4.2)
├── img/contours.svg                  NEW  contour background (§6)
├── js/
│   ├── gl/particle-cortex.js         NEW  ES module: instanced tetrahedra renderer (§4)
│   ├── gl/brain-surface.js           KEEP optional "Anatomy" view only (INT-9)
│   ├── smartbrain/
│   │   ├── lessons.js                NEW  bilingual lesson data (§5.1)
│   │   ├── narration.js              NEW  NarrationProvider + WebSpeechProvider (§5.2)
│   │   └── learn.js                  NEW  Learn view controller
│   ├── registry.js                   MOD  product registry (IA-5)
│   ├── core/router.js                MOD  #/smart-brain routes (IA-3)
│   └── ui/topbar.js                  MOD  language segmented control, products menu
└── i18n/site.js                      MOD  new keys, parity (I18N-4)
tests/
├── build_particles.py                NEW  mesh → cortex-points.bin
├── build_contours.py                 NEW  height field → contours.svg
└── static_smoke.py / browser_smoke.py MOD  new checks (§9)
```

---

## 9. Verification and acceptance plan

| Area | Method | Pass criterion |
|---|---|---|
| IA | Static + DOM test | Products menu contains exactly two sibling items (EasySci, Smart Brain) with identical element structure; no string "Brain Project" in user-visible copy. |
| Routing | Browser test | `#/smart-brain` and `#/smart-brain/learn` render; unknown sub-route redirects. |
| i18n | Static test | Key sets for `zh` and `en` are identical; `<html lang>` toggles; choice survives reload. |
| i18n layout | Visual check | No clipped controls at 320 px in either locale. |
| Particle count & geometry | Unit test of the build script | Point count within ±1 % of target; L/R ratio 0.9–1.1; all normals unit length. |
| Primitive | Runtime assertion | Instance geometry has 4 faces; `renderer.info.render.calls` for the hero is 1. |
| Rotation | Browser test (synthetic pointer events) | After a pointer move to ndc.x = 0.8, the yaw converges to within 2° of 22.4° in ≤ 500 ms; returns to 0 ± 1° after pointer leave. |
| Click expand/restore | Browser test | Max radial displacement reaches ≥ 80 % of A within 300 ms; all particles within 0.5 % of rest position by 1.5 s. |
| Frame budget | Profiling on reference hardware | ≥ 55 fps p50 during interaction; rAF loop count = 0 when off-screen. |
| Fallback | Disable WebGL (flag) | Static poster visible, live-region message present, no uncaught exception. |
| Narration | Browser test with mocked `speechSynthesis` | Play starts only after a click; `cancel()` called on route change and language change; paragraph highlight advances; controls disabled when no matching voice. |
| Narration (real) | Manual on Chrome, Safari, Firefox, Edge, iOS Safari, Android Chrome | zh-CN and en lessons play to completion; pause/resume works; no silent truncation. |
| Background | Automated | Contour asset ≤ 150 KB; contrast ≥ 4.5 : 1 for hero text on sampled grid; layer is `position: fixed` with `pointer-events: none`. |
| Accessibility | axe-core + manual | 0 critical/serious violations; keyboard-only operation of language toggle, narration controls and hero stage. |
| Reduced motion | Emulated media query | INT-10 behaviour observed; parallax off. |

Existing automated checks (catalogue size, record integrity, JS syntax) continue to apply. The previous note stands: a full headless browser run requires network access for Three.js unless the vendored-asset option (PRT-5, plus vendoring Three.js) is adopted. Vendoring Three.js is RECOMMENDED so that `standalone.html` becomes a genuinely offline package.

---

## 10. Licensing, attribution and safety

- The hero point set is a **derived work** of the Z-Anatomy/BodyParts3D geometry (CC BY-SA 4.0). The derived binary asset MUST carry an attribution notice and be redistributed under CC BY-SA 4.0; the Aloop application code is unaffected by the share-alike term because the dataset is a separate file. Keep the visible credit line and the link to the source repository.
- The visualisation is educational and decorative. It MUST NOT be presented as clinically accurate or suitable for diagnosis. Lesson text SHOULD include a one-line disclaimer.
- Web Speech voices are provided by the browser/OS; their licences are not redistributed by Aloop.
- Pin the model/asset source to a reviewed commit hash in the build scripts' provenance record.

---

## 11. Risks and open items

| # | Item | Mitigation / decision needed |
|---|---|---|
| R1 | Web Speech voice availability for zh-CN varies (often absent on Linux/Firefox). | TTS-8 fallback; consider shipping pre-rendered audio (`AudioFileProvider`) for key lessons. **Decision:** is a human or neural-TTS audio set in scope? |
| R2 | 16 k instances on low-end mobile GPUs. | PRT-12 and PRF-3 adaptive governor. |
| R3 | Light-mode particles lose the previous glow aesthetic. | Flat-shaded tetrahedra with a deep-to-mid blue ramp; no additive blending. |
| R4 | Removing region picking and `OrbitControls` from the hero reduces anatomical exploration. | Keep the optional "Anatomy" view on the Smart Brain page (INT-9). **Decision:** retain or drop? |
| R5 | "Learn" content is not supplied. | Placeholder lessons (§5.1) must be reviewed for scientific accuracy by a domain expert before release. |
| R6 | The meaning of "Brain Project → Smart Brain" is assumed to be a new product entry (see §0.1-1). | Confirm; if an existing page is intended, supply it. |

---

## 12. Source references

1. [itayinbarr/brainproject](https://github.com/itayinbarr/brainproject) — GLB model, mesh metadata (`bx_cat`, `bx_label`, `bx_region`). Licence: viewer Apache-2.0; geometry CC BY-SA 4.0.
2. [Three.js](https://threejs.org/docs/) — `InstancedMesh`, `TetrahedronGeometry`, `ShaderMaterial`.
3. [W3C Web Speech API](https://webaudio.github.io/web-speech-api/) — `SpeechSynthesis`, `SpeechSynthesisUtterance`, `voiceschanged`, `boundary`.
4. [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — SC 1.4.3 (contrast), SC 1.4.11 (non-text contrast), SC 2.3.3 (motion).
5. [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) — requirement keywords.
6. Marching squares and Ramer–Douglas–Peucker line simplification — standard isoline-extraction techniques (contour generation).
7. Revision 2 of this specification — EasySci catalogue requirements (§2), retained unchanged.

---

## 13. Implementation record (2026-10-23)

### 13.1 Delivered

| Req. group | Implementation |
|---|---|
| IA-1..5 | `assets/js/registry.js` (`Aloop.products`) renders EasySci and Smart Brain as sibling Products-menu items; routes `#/smart-brain`, `#/smart-brain/learn` in `core/router.js`; view in `assets/js/smartbrain/learn.js`. |
| I18N-1..8 | `#langToggle` is now a two-button segmented group (中 / EN, `aria-pressed`); 105 keys per locale, parity enforced by `tests/i18n_parity.js`. |
| TTS-1..12 | `smartbrain/narration.js` (`WebSpeechProvider`, sentence chunking ≤ 220 chars, voice matching, `voiceschanged` wait); controls and paragraph highlighting in `learn.js`. Verified in headless Chromium with a mocked `speechSynthesis`: no autoplay, chained utterances, pause/resume, cancel on route and language change, zh-CN voice re-resolution. |
| PRT / COL / INT / PRF | `assets/js/gl/particle-cortex.js` (instanced tetrahedra, single draw call, GPU expansion/spring, pointer-damped rotation, keyboard, reduced motion, governor, context-loss handling, IntersectionObserver). |
| BG-1..7, 10 | `tests/build_contours.py` → `assets/img/contours.svg` (59.7 KB, 24 levels, marching squares + RDP + Chaikin), fixed `body::before` layer in `assets/css/revision3.css`; hero dark overlays and `.hero-section::after` removed. |
| Tests | `static_smoke.py` updated to Revision 3; `build_standalone.py` embeds the contour SVG; `standalone.html` rebuilt. |

### 13.2 Deviations from the normative text above

1. **Language storage key** remains `aloop_lang_v1` (existing key, preserves returning users' choice) instead of `aloop.lang` (I18N-3).
2. **Point set (PRT-5/6):** no pre-built `cortex-points.bin`; the build sandbox had no network access to fetch the GLB. The module samples the GLB at runtime (main thread, once) and shows a procedural two-hemisphere approximation until it arrives. If the GLB cannot be loaded the approximation stays and the status line says so. `tests/build_particles.py` is not provided.
3. **Poisson-disk rejection (PRT-2)** is not applied (marked optional); sampling is area-weighted per hemisphere with equal counts (±0 %).
4. **INT-8 idle breathing** (MAY) and **BG-9 parallax** (MAY) are not implemented. The render loop stops completely when idle.
5. **Expansion timing (INT-3):** wave speed 8 units/s; each particle's own rise-and-restore takes ≤ 1.2 s, the whole cloud settles within ≈ 1.5 s because the wave takes time to reach distant particles.
6. **Contour tint/WebP fallback (BG-3, BG-4):** the optional hypsometric tint and the `contours@2x.webp` fallback are not produced. The hero copy area gets a white radial wash instead of a full vignette.
7. **Three.js** is still loaded from the pinned CDN URL; it is not vendored.
8. `assets/js/gl/brain-surface.js` is retained in the tree for an optional Anatomy view (INT-9) but is no longer loaded by `index.html`.

### 13.3 Verification still required

- Run the particle renderer on a network-enabled machine with a real GPU: confirm the GLB loads and samples, tetrahedra are 3–5 px, click expansion/restore timing, ≥ 55 fps, and the colour contrast of the particle ramp on the contour background.
- Verify Smart Brain model loading, model orientation/material quality, click selection, zoom bounds, route cleanup, and mobile touch behavior on a network-enabled GPU browser. The GLB is remote and may fail under offline/CORS/network restrictions.
- Verify zh-CN narration on target browsers; voice availability varies by OS.
- Run `python tests/browser_smoke.py` on a network-enabled host (it was patched for the new language control but not executed here).
- Review lesson text for scientific accuracy.


## 14. Iteration 2026-10-24 — navigation, particle surface and interaction tokens

- The top-level navigation includes a direct `说明.html` entry alongside Products. Attribution and licence notes were removed from the homepage hero and consolidated in the standalone information page.
- Homepage particle rendering samples the external anatomical GLB before hiding the cortex mesh inside the homepage-local scene. The source GLB is still required for sampling; the current ZIP does not bundle the binary model. No shared Smart Brain material or scene object is modified by this visibility change.
- Particle geometry scale uniform `uSize` changed from `0.007` to `0.07` (10×). Surface sample count remains 520 on small/low-core devices and 1,100 on desktop, so density is not increased to compensate. Palette uniforms now use blue `#23466D` / `#315E91`, white `#F5F7FA` / `#FFFFFF`, and yellow `#F2CC4D`.
- Design tokens add pressed/focus/disabled values and shared focus/hover rules. Semantic success/error variables remain unchanged.
- Smart Brain now mounts a separate product-level Three.js scene in `assets/js/smartbrain/atlas/`, loading `assets/models/atlas/brain.glb` plus `manifest.json` from the repository itself. The model, manifest and Draco decoder are self-hosted under `assets/models/atlas/` (previously fetched from `raw.githubusercontent.com` and `gstatic.com`, which produced a model-load failure on both the homepage and Smart Brain when that host was reset or slower than the 14 s/20 s load timeouts). Checksums and the CC BY-SA 4.0 attribution are in `assets/models/atlas/ATTRIBUTION.md`. Its scene, materials, camera, renderer, pointer state, and lifecycle are independent of the homepage particle scene. Drag rotates, wheel zooms, clicking selects/highlights a mesh and reports its name, and Reset restores the initial view. Network/GPU browser acceptance remains required; do not claim successful live rendering based only on static checks.
- beLieve runtime/CSS currently exposes no identifiable text-flow/cursor-speed control in the inspected source. The requested 10% reduction cannot be applied safely until the relevant animation implementation is identified; do not change unrelated animation timing.


---

## 15. Smart Brain Explore (atlas) — Revision 3.1, 2026-10-28

Implements `docs/smart-brain-atlas-interaction-plan.md`. Route `#/smart-brain/atlas[/<bx_id>]`; third Smart Brain tab. Overview now links to it instead of embedding a viewer (`model-viewer.js` removed).

- **Store** (`assets/js/smartbrain/atlas/store.js`): the single source of truth (selection, hover, query, layer visibility, hemisphere, cortex opacity, isolate, auto-focus). Scene and sidebar never call each other; every action carries a `source`.
- **Data** (`data.js`, `assets.js`): tolerant manifest normaliser (`bx_*` or plain keys; array / `{structures}` / id-map), falls back to indexing GLB `extras` if the manifest is unavailable. `visibility()` is the one function deciding hidden / faded / pickable for both list rows and meshes.
- **Scene** (`scene.js`): on-demand rendering, orbit / pan / pinch / wheel / keyboard, hover + click picking restricted to pickable meshes, highlight and fade by diffing materials cloned once at load, camera ease-to focus.
- **Sidebar** (`sidebar.js`, `cards.js`): search (zh/en/TA2), per-category and per-structure layers, hemisphere, cortex opacity, isolate, Listen (existing TTS provider), copy link. Cards resolve key → category → "Basic info" stub; 18 curated bilingual cards (`reviewed:false`, expert review required).
- **Hosting:** `ALOOP_ATLAS_BASE` / `ALOOP_DRACO_PATH` (set before `assets.js`) switch the model, manifest and Draco decoder to self-hosted copies. Defaults still point at `main` of `itayinbarr/brainproject`; **pin a commit SHA or self-host before release**. Model and manifest are CC BY-SA 4.0 and need attribution if redistributed.
- **Tests:** `node tests/atlas_store.test.js` (store, visibility, search, card keys); static and i18n checks updated.
- **Known limits:** mobile uses a pinned stage with the sidebar scrolling beneath it (not a snap-point bottom sheet); camera pose is not in the share link; Alt-click cycling through overlapping structures and BVH acceleration are not implemented; scene interaction was not exercised against the real GLB in this build environment (no network).
