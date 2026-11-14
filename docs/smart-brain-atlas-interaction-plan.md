# Smart Brain Atlas: Brain ↔ Sidebar Knowledge-Card Interaction

**Technical implementation plan** · Target: `aloop-site` (Aloop-iteration-2026-10-24-v2) · Reference: `itayinbarr/brainproject`
**Date:** 2026-10-28 · **Status:** Proposal for review

---

## 0. Summary

Add an **Explore** tab to Smart Brain (`#/smart-brain/atlas`) where:

1. **Clicking a structure on the 3D brain** opens its **knowledge card** in a right-hand sidebar (and scrolls/expands the sidebar list to that structure).
2. **The sidebar works on its own**: search, layer toggles, hemisphere filter, opacity, and a structure list can all be used without ever touching the 3D view. Choosing a list item selects it in 3D and opens the same card.

The two sides never talk to each other directly. Both read from and write to one small **atlas store** (single source of truth). This is the central design decision; it is what makes "the sidebar can be used independently" true by construction and prevents feedback loops.

**Key decisions**

| # | Decision | Reason |
|---|---|---|
| D1 | One `Aloop.atlas.store` (state + actions + subscribe). Scene and sidebar are pure subscribers. | Independence, no circular calls, testable without WebGL. |
| D2 | Sidebar data comes from `manifest.json` (metadata), not from the loaded GLB. | Sidebar is usable immediately and still works if WebGL or the GLB fails. |
| D3 | Cards are keyed by **structure key** (label without side), so left/right pairs share one card. | Hundreds of meshes, tens of concepts. |
| D4 | Card lookup falls back: `id → key → region → category`. | Every mesh always shows something sensible. |
| D5 | Cache the parsed model in a shared module; do not rebuild per tab visit. | Current viewer re-downloads/parses on every mount. |
| D6 | Pin the model to a commit SHA and self-host a copy. | `main` can change IDs under us; `raw.githubusercontent.com` is unreliable in some regions. |

---

## 1. What `brainproject` does (reference behaviour)

> **Source note.** GitHub blocked automated access to the repo's file pages, so this section is based on the project README (controls, layout, metadata model, tech stack), not on reading `app.jsx` / `scene.js` line by line. File names below come from the README's project layout. Anything marked *(verify)* should be confirmed by reading the source in M0.

**Scene (`scene.js`, Three.js)**
- Left-drag rotates; ⌘/Ctrl-drag or right-drag pans; scroll/pinch zooms (custom lightweight orbit controls, ACES tone mapping).
- Hover: structure under the cursor glows faintly.
- Click: selects the structure; its name (with side) and **TA2 path** (e.g. `Telencephalon › Frontal lobe › Precentral gyrus`) appear in an on-stage card at bottom-left (`selection-card.jsx`).
- Idle auto-rotate with a Spin toggle; Share (view link / HD poster).

**Side panel (`control-panel.jsx`, `layers-tree.jsx`)**
- Live **search** over names, regions and systems; matching list narrows and **non-matching meshes fade in 3D**.
- **Layers** tree: colour-coded subsystems with a header checkbox and per-structure toggles.
- **Isolate** (show only search matches or the selection, and frame the camera), **Reset**, **Focus** (fly to selection), **Cortex opacity**, **Left / Right / Both**.

**Data contract**
- Each mesh carries glTF `extras`: `bx_id`, `bx_cat`, `bx_label`, `bx_side`, `bx_region`. The viewer **never matches on display names**.
- `models/manifest.json` mirrors these and adds the full TA2 ancestor path; `scripts/gen_data.py` turns it into `data.js`.

**State shape (inferred from the above, *verify*)**: selection, hover, search query, per-category/per-structure visibility, cortex opacity, hemisphere filter, isolate flag, share-able view.

**Where Aloop deliberately differs:** in the original, the selection card sits on the stage and the panel hosts search/layers. In Aloop the **card lives inside the sidebar**, on top of the list, so one column carries everything. The card is also richer: bilingual explanatory text, not just name + path.

---

## 2. Target behaviour

### 2.1 Interaction matrix

| Trigger | Store action | Scene reaction | Sidebar reaction |
|---|---|---|---|
| Click mesh | `select(id, "scene")` | Selected highlight; camera unchanged | Card opens; list scrolls to the item and expands its group |
| Click empty background / press `Esc` | `clear("scene")` | Highlight removed | Card closes; list stays |
| Hover mesh | `hover(id, "scene")` | Faint glow; cursor `pointer` | Matching list row gets a hover style |
| Click list row | `select(id, "sidebar")` | Selected highlight; soft camera ease-to (setting, default on) | Card opens |
| Hover list row | `hover(id, "sidebar")` | Faint glow on that mesh | Row hover style |
| Type in search | `setQuery(q)` | Non-matches fade to ~12% opacity, not pickable | List filtered; match count shown |
| Toggle layer (category / structure) | `setVisible(...)` | Mesh `visible` toggles | Checkbox state (tri-state for categories) |
| Cortex opacity slider | `setCortexOpacity(v)` | Cortex materials fade; hidden-looking meshes are not pickable | Slider value |
| Left / Right / Both | `setSide(s)` | Hemisphere meshes hide/show (median stays) | Segmented control |
| Card: **Focus** | `focus(id)` | Camera flies to bounds | – |
| Card: **Isolate** | `setIsolate(true)` | Only selection (or matches) visible; camera frames them | Button toggles; chip "Isolated" |
| Card: breadcrumb item | `selectGroup(pathPrefix)` | Group highlighted | List filtered to group |
| Card: related chip | `select(relatedId, "sidebar")` | As list click | New card |
| Card: **Listen** | – | – | Reads card via existing TTS provider |
| Reset | `reset()` | Default camera/visibility | Defaults |
| Open URL with `#/smart-brain/atlas/<id>` | `select(id, "hash")` | As list click | As list click |

### 2.2 Independence guarantees (acceptance criteria)

- **S1.** With the canvas not yet loaded (or WebGL unavailable), search, layers, list selection and cards all work. The scene area shows the existing recovery state.
- **S2.** Selecting from the list when the GLB is loaded produces the identical highlight as clicking the mesh.
- **S3.** No scene code imports sidebar code, and vice versa. Both import only `store.js` and `data.js`.
- **S4.** Every action carries a `source`; subscribers use it only to decide **side effects** (e.g. scroll the list into view only when `source !== "sidebar"`), never to decide state.

---

## 3. Architecture

### 3.1 Data flow

```
                    ┌──────────────────────────┐
  manifest.json ──► │ atlas/data.js            │  index by id, key, category, region,
  (pinned, local)   │ (indexes, search corpus) │  TA2 path; bilingual search tokens
                    └────────────┬─────────────┘
                                 │ read-only
        ┌────────────────────────▼──────────────────────────┐
        │ atlas/store.js   state + actions + subscribe(fn)  │◄── router (#/smart-brain/atlas/<id>)
        └───────┬───────────────────────────────┬───────────┘
        subscribe│                               │subscribe
   ┌─────────────▼───────────┐       ┌───────────▼─────────────┐
   │ atlas/scene.js          │       │ atlas/sidebar.js        │
   │ Three.js, picking,      │       │ search, layers tree,    │
   │ highlight, camera       │       │ list, card host         │
   └─────────────▲───────────┘       └───────────┬─────────────┘
                 │ model (cached)                │ card model
   ┌─────────────┴───────────┐       ┌───────────▼─────────────┐
   │ atlas/assets.js         │       │ atlas/cards.js          │
   │ GLB + Draco loader,     │       │ resolve(id) → card      │
   │ shared with homepage    │       │ + content dictionary    │
   └─────────────────────────┘       └─────────────────────────┘
```

### 3.2 Files (follows the existing classic-script + `Aloop.*` convention, no bundler)

```
assets/js/smartbrain/atlas/
  assets.js     # pinned GLB + manifest loader; caches the parsed gltf; progress events
  data.js       # builds indexes from manifest; search corpus (zh + en + TA2 path)
  store.js      # state, actions, subscribe, URL sync helpers
  scene.js      # replaces model-viewer.js; picking, hover, highlight, fade, camera
  sidebar.js    # DOM for search, layers, list, card host; keyboard + ARIA
  cards.js      # resolve(id) → card; renders card HTML; fallback chain
  cards.content.js   # curated bilingual card content (Aloop.atlasCards)
assets/css/atlas.css
assets/models/atlas/       # self-hosted brain.glb + manifest.json + draco decoder + LICENSE/ATTRIBUTION
tests/atlas_store.test.js  # store logic without a browser
tests/build_atlas_index.py # coverage report: structures without curated cards
```

`index.html` gains the script tags (all `defer`, before `router.js`, same pattern as the current Smart Brain scripts). `model-viewer.js` is kept only until M3, then deleted; the **Overview** tab gets a lightweight "Open the atlas" call-to-action instead of its own viewer.

### 3.3 Store

```js
// store.js — sketch
(function () {
  const Aloop = (window.Aloop = window.Aloop || {});
  const state = {
    selectedId: null, hoverId: null,
    query: "",
    hiddenCategories: new Set(), hiddenIds: new Set(),
    side: "both",                // "left" | "right" | "both"
    cortexOpacity: 1,
    isolate: false,
    expandedCategories: new Set(),
  };
  const subs = new Set();
  let queued = false;
  const emit = (change) => {                 // coalesce to one microtask per tick
    if (queued) { Object.assign(pending, change); return; }
    queued = true; pending = { ...change };
    queueMicrotask(() => { queued = false; subs.forEach(fn => fn(state, pending)); });
  };
  let pending = {};

  Aloop.atlas = Aloop.atlas || {};
  Aloop.atlas.store = {
    get: () => state,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    select(id, source) {
      if (state.selectedId === id) return;
      state.selectedId = id; emit({ selected: true, source });
    },
    clear(source) { if (state.selectedId) { state.selectedId = null; state.isolate = false; emit({ selected: true, source }); } },
    hover(id, source) { if (state.hoverId !== id) { state.hoverId = id; emit({ hover: true, source }); } },
    setQuery(q) { state.query = q; emit({ query: true, source: "sidebar" }); },
    // setVisible, setSide, setCortexOpacity, setIsolate, focus, reset ...
  };
})();
```

Rules: actions are idempotent (no-op if nothing changed); `emit` is coalesced; subscribers never call actions synchronously inside a subscription for the same field (prevents loops).

### 3.4 Derived visibility (single function, used by scene and sidebar)

```
isFaded(mesh)    = query && !matches(mesh, query)
isHidden(mesh)   = category hidden || id hidden || side filtered || (isolate && !inIsolateSet)
isPickable(mesh) = !isHidden && !isFaded && (!isCortex || cortexOpacity > 0.15)
```

Put this in `data.js` as `visibilityFor(meshMeta, state)` so list rows and meshes can never disagree about what is "on".

---

## 4. Scene layer (`scene.js`)

Reuse what already works in `gl/brain-surface.js`: the `metadata(mesh, "bx_label")` helper, the `baseMaterials` WeakMap, the hover/select colours (`0x5ab7bd` / `0xf2cc4d`), pointer-start click/drag discrimination, 30 fps frame cap and the in-view pause.

**Loading.** `assets.js` returns `{ gltf, byId }` once; `scene.js` re-attaches the same `Object3D` tree on each visit instead of re-parsing. Build `byId: Map<bx_id, Mesh>` in a single traverse using `mesh.userData.bx_*` (glTF extras surface in `userData`; *verify* key names on the real GLB in M0).

**Materials.** Clone each mesh's material **once at load**, store in a WeakMap as the base. Highlight/fade change `emissive`, `emissiveIntensity`, `opacity`, `transparent` on that one clone, and only for meshes whose state changed (diff against the last applied state). *Do not* clone materials for every mesh on every click, which is what `model-viewer.js` does today (leaks clones and does O(n) work per click).

**Picking.**
- Raycast only against `pickable` meshes (maintain an array rebuilt when visibility changes, not on every pointer event).
- Hover: throttle to one raycast per animation frame, skip while dragging or while the pointer is over the sidebar.
- Click vs drag: pointer travel ≤ 4 px and < 350 ms ⇒ click.
- If frame time suffers with the full mesh count, add `three-mesh-bvh` (pin version) on the largest meshes, or fall back to a low-res proxy for picking. Decide from M2 measurements.
- Optional, M5: `Alt`+click cycles through stacked hits (cortex over deep nuclei).

**Fade vs hide.** Faded (search non-match): `transparent = true`, `opacity ≈ 0.12`, `depthWrite = false`, not pickable. Hidden: `mesh.visible = false`. Restore flags exactly on un-fade to avoid sorting artefacts.

**Camera.** `focus(id)`: compute bounds of the mesh (or isolate set), ease camera target and distance over ~600 ms with `easeInOutCubic`; cancel on user input. `reset()` restores the stored initial pose. Add pan (right-drag / Ctrl-drag) to match the reference; the current viewer only rotates and zooms.

**Cleanup.** `destroy()` removes listeners, cancels RAF, disposes materials/geometries **only if the cache is being dropped**, and keeps the shared gltf otherwise.

---

## 5. Sidebar layer (`sidebar.js`)

**Layout (desktop ≥ 960 px).** Stage on the left (fluid), sidebar on the right (`clamp(320px, 28vw, 420px)`), sticky to the viewport height under the frosted top bar. **Mobile.** Sidebar becomes a bottom sheet with three snap points (peek 96 px with search + card title, half, full). Canvas gestures stay on the canvas.

**Sections, top to bottom**
1. **Search** (debounced 120 ms; clear button; result count; zh/en/TA2 tokens).
2. **Card host** (sticky). Empty state shows a hint ("Click a structure or choose one below"); it never shows an empty box.
3. **Controls row**: Left / Right / Both · Cortex opacity · Isolate · Reset.
4. **Layers / list**: ARIA `tree` of categories → structures; category header = tri-state checkbox; rows show colour dot, label, side badge; virtualised or progressively rendered (render 100 rows at a time) because the full structure count is large.

**Behaviour details**
- Selecting from the scene: `scrollIntoView({block:"nearest"})` on the row, expand its category, add a transient pulse.
- Selecting from the list: the row gets `aria-selected`; focus stays on the row (do not steal focus to the card).
- Search matching also expands matching categories and collapses empty ones.
- Keyboard: `↑/↓` move in list, `Enter` select, `Esc` clear selection (and blur search first), `/` focuses search, `←/→` collapse/expand category.
- Live region announces "Selected: Precentral gyrus, left" and result counts.

---

## 6. Knowledge cards

### 6.1 Card anatomy

1. Title (zh/en by current language) + side badge + colour dot of the category.
2. **TA2 breadcrumb** (clickable ancestors → `selectGroup`). Latin/English path stays English; show a localised label when `cards.content.js` provides one.
3. **What it is** (1-2 sentences).
4. **What it does** (2-4 bullets).
5. **Related structures** (chips → `select`).
6. **Note** (optional: individual variation, approximation caveat for registered structures, "not for clinical use").
7. Actions: Focus · Isolate · Listen · Copy link.
8. Footer: "Basic info" tag when auto-generated; model attribution link.

### 6.2 Content model

```js
// cards.content.js
Aloop.atlasCards = {
  byKey: {
    "precentral-gyrus": {
      name:    { zh: "中央前回", en: "Precentral gyrus" },
      summary: { zh: "…", en: "…" },
      does:    { zh: ["…"], en: ["…"] },
      related: ["postcentral-gyrus", "central-sulcus"],
      note:    { zh: "…", en: "…" },          // optional
      reviewed: false                        // flips to true after expert review
    },
  },
  byRegion:   { "frontal-lobe": { /* same shape, generic */ } },
  byCategory: { "tracts": { /* generic */ } },
};
```

**Resolution (`cards.resolve(id)`)**
1. `byKey[keyOf(meta)]` where `keyOf` = slug of `bx_label` with the side word stripped (so left/right share).
2. else `byRegion[slug(bx_region)]`.
3. else `byCategory[bx_cat]`.
4. else auto stub: label + side + TA2 path + category blurb, tagged **Basic info**.

**Coverage plan.** P0: about 60 curated cards (lobes, major gyri/sulci already used in the Learn lessons, thalamus, basal ganglia, hippocampus/amygdala, ventricles, corpus callosum, brainstem parts, cerebellum, circle of Willis headline vessels, key tracts). Everything else falls to region/category/stub. `tests/build_atlas_index.py` prints coverage and lists uncurated keys by mesh count so authoring effort goes where it matters.

**Content rules.** Plain-language, educational; no diagnostic claims. Registered/approximate structures (deep nuclei, hypothalamic zones, tracts) carry the "approximate (~7 mm), educational, not clinical" note from the upstream README. Existing Learn lessons can be linked from cards (`lesson: "lobes"`).

**Review.** Same status as the lessons: bilingual text needs domain-expert review before public release; `reviewed` flag drives a subtle "pending review" marker in non-production builds.

---

## 7. Routing, deep links, share

- Extend `router.js`: `smart-brain/atlas` and `smart-brain/atlas/<id>` ⇒ `{ type: "smartbrain", sub: "atlas", id }`. The present parser only knows `learn`.
- On route enter: `store.select(id, "hash")` if present; on selection change, `history.replaceState` to the `#/smart-brain/atlas/<id>` hash (replace, not push, so Back leaves the atlas rather than stepping through every click).
- Copy link: `…#/smart-brain/atlas/<id>`. Camera pose / visibility in the URL are **out of scope** for v1 (the reference app shares a full view; we start with selection only).
- IDs: `bx_id` is "stable unique" upstream, but because we pin the model, unknown IDs in old links must degrade gracefully (toast "Structure not found", open atlas with no selection).

---

## 8. Cross-cutting

**i18n.** Add keys under `atlas.*` in both dictionaries in `assets/i18n/site.js`; `tests/i18n_parity.js` must pass. Switching language re-renders sidebar text only (no scene rebuild) and keeps selection. Search corpus includes both languages regardless of UI language.

**Audio.** Follow the project's sound rules: `Aloop.audio.chime()` on non-experiment buttons (Focus, Isolate, Reset, tabs); `Aloop.audio.glassGlide()` while dragging/rotating the brain, `stopGlassGlide()` on release; hover `tink` is optional and off by default to avoid noise on list scrolling. Respect the saved mute state.

**Accessibility.** Canvas has an `aria-label` and is described as "also available as a list"; every canvas action has a list equivalent. Focus rings visible (project already uses 3 px accent outline). Respect `prefers-reduced-motion`: camera moves become instant, no pulse. Colour is never the only indicator (side badge text, `aria-selected`).

**Styling.** New `atlas.css` using existing tokens (`--c-primary`, `--c-deep`, `--text-2`); stage keeps the light radial background already used by `.sb-model-stage`; high-contrast text per the design notes (the site is text-heavy, so card typography should be larger and darker than the current defaults).

**Narration.** The card's **Listen** button reuses `Aloop.narration.WebSpeechProvider`; paragraphs = [title, summary, bullets…]. Cancel on selection change, route change and `pagehide`, matching the existing lifecycle rules in `learn.js`.

---

## 9. Performance budget

| Item | Target |
|---|---|
| Sidebar interactive | before the GLB finishes (manifest only; target < 300 ms after route enter on cache hit) |
| Click → card visible | < 50 ms (store → one DOM patch) |
| Hover raycast | ≤ 1 per frame; ≤ 2 ms p95 on a mid-range laptop |
| Search keystroke → fade applied | < 100 ms for the full structure set |
| Frame rate | 30 fps cap while interacting, pause when off-screen or tab hidden (reuse existing logic) |
| Memory | no per-click material clones; one model instance shared across visits |

Measure on a throttled profile in M2 before deciding on BVH.

---

## 10. Risks and licensing

1. **Model licence (CC BY-SA 4.0).** Self-hosting or redistributing `brain.glb` and `manifest.json` requires keeping attribution and keeping that asset under CC BY-SA; the viewer code is Apache-2.0. Ship `ATTRIBUTION.md` next to the model and keep the footer link. Card text written by Aloop is separate original content (choose its licence deliberately).
2. **Upstream drift.** The model is "updated regularly". Pin a commit SHA; record it in `TECHNICAL_SPECIFICATIONS.md`; upgrade deliberately and diff `manifest.json` IDs.
3. **Network reachability.** The current code loads the GLB from `raw.githubusercontent.com` and Draco from `gstatic.com`. For a bilingual (including mainland-China) audience, self-host both on `Aloop.space` with long-cache headers.
4. **Approximate anatomy.** Deep nuclei, hypothalamic zones and tracts are registered approximations; cards must say so.
5. **Content workload.** Cards are the long pole, not code. The fallback chain keeps the product shippable with partial coverage.
6. **Pick ambiguity.** Overlapping structures can make "what did I click?" unclear; mitigations: opacity slider, isolate, optional Alt-cycle.

---

## 11. Changes to existing code

| File | Change |
|---|---|
| `smartbrain/model-viewer.js` | Superseded by `atlas/scene.js`; remove after M3. Known issues it fixes: per-click material cloning for all meshes, display name instead of `bx_label`, no hover, no pan, re-load on every mount, model URL on `main`. |
| `smartbrain/learn.js` | Tabs gain **Explore**; Overview replaces the embedded viewer with a CTA card; `render()` mounts/destroys the atlas for `sub === "atlas"`. |
| `core/router.js` | Parse `atlas` and `atlas/<id>`; call `Aloop.smartbrain.show(route)` with `id`. |
| `registry.js` / `Aloop.products` | No change (Smart Brain already registered). |
| `assets/i18n/site.js` | `atlas.*` keys (zh + en). |
| `index.html` | New `<script defer>` tags and `atlas.css`. |
| `gl/brain-surface.js` | Optional: switch to `atlas/assets.js` so the homepage and Smart Brain share one cached download. |
| `tests/*` | Extend `static_smoke.py` (files present, i18n keys, no inline handlers), `browser_smoke.py` (click → card), add `atlas_store.test.js`. |

---

## 12. Milestones

| M | Scope | Exit criteria |
|---|---|---|
| **M0** Recon (0.5 d) | Read upstream `app.jsx`, `scene.js`, `selection-card.jsx`, `layers-tree.jsx`; confirm `bx_*` key names and TA2-path field in `manifest.json`; pick and pin commit SHA. | Short findings note; verified field list; pinned URLs. |
| **M1** Data + store (1 d) | `assets.js`, `data.js`, `store.js`, unit tests. | Store tests pass (select/clear/hover/query/side/isolate, idempotence, source tags). |
| **M2** Scene (1.5 d) | `scene.js`: load from cache, picking, hover/select highlight, fade/hide, camera focus/reset, pan. | Click selects; no per-click clones; perf numbers recorded. |
| **M3** Sidebar + cards (2 d) | `sidebar.js`, `cards.js`, auto-stub cards, layout (desktop + bottom sheet). | S1-S4 hold; list ↔ scene sync in both directions. |
| **M4** Content + i18n + audio + routing (2 d + authoring) | P0 curated cards, `atlas.*` keys, sounds, deep links, Listen button. | i18n parity passes; deep link opens card; coverage report generated. |
| **M5** Polish + QA (1 d) | Reduced motion, a11y pass, mobile gestures, optional Alt-cycle, remove `model-viewer.js`, update spec/report docs. | Smoke tests green; manual keyboard-only run-through. |

Rough total: **8 working days** of engineering plus card authoring/review.

---

## 13. Test plan

**Unit (Node, no browser).** Store: every action's state transition and emitted `source`; idempotence; derived visibility truth table (`isFaded/isHidden/isPickable`); card resolution fallback order; search tokeniser (zh, en, TA2 words).

**Browser smoke (Playwright, extends `tests/browser_smoke.py`).**
1. Load `#/smart-brain/atlas`: sidebar renders before model-ready.
2. Click canvas at a known point: card title non-empty, list row `aria-selected`.
3. Click list row: same highlight/state as canvas click (compare store state).
4. Type "thalamus": matching count > 0; non-matches faded; clicking a faded mesh does nothing.
5. Switch language: card text changes, selection preserved.
6. Open `#/smart-brain/atlas/<id>`: card opens; unknown id: graceful message.
7. Block the GLB request: sidebar still fully usable (S1).

**Manual.** Keyboard-only flow; screen-reader announcements; reduced-motion; throttled-CPU interaction; 375 px width bottom sheet.

---

## 14. Open questions

1. Should **Explore** replace the Overview tab's viewer entirely, or live as a third tab? (Plan assumes a third tab plus a CTA on Overview.)
2. Is selection-only deep-linking enough for v1, or do you want full-view sharing like the reference (camera pose, visibility, opacity)?
3. Should clicking a list row move the camera by default, or only the card's Focus button? (Plan: soft ease-to by default, user-toggleable.)
4. Card authoring: will you or domain experts write the P0 bilingual text, or should I draft it for review?
5. Self-hosting the model on `Aloop.space`: acceptable given the CC BY-SA obligations above?
