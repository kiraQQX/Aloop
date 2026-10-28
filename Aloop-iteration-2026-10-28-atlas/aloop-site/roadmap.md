# Aloop Experiment Platform — Technical Roadmap

> Scope: turn the current `lateral-reading-lab` prototype into **Aloop**, the public home of the Aloop research group's online experiments. First experiment: **beLieve** (authenticity-judgement task, already designed).
> Source material reviewed: `design.md` (dala design spec), `UI_pre/dala-1789269055962/dala/`, and the current code (`index.html`, `assets/field.js`, `assets/app.js`, `assets/base.css`, `assets/desktop.css`, `assets/mobile.css`).
> Verification status: findings in §1 come from **reading the code**. The page was not run in a real browser here, so each finding has a Phase 0 check that confirms it before anything is rebuilt.

---

## 0. Summary

| Area | Decision |
|---|---|
| Stack | Keep **zero-build static site** (HTML + classic JS + CSS, GitHub-Pages friendly). Split the 669-line `app.js` into modules; lazy-load each experiment so the home page stays light. |
| Home | Hero = Aloop logo (left) + interactive **particle brain** (right). Scrolling down = one full-screen section per experiment: name on the left, **particle icon** on the right. No intro text. |
| Top bar | Fixed, frosted glass. `Aloop` (home) · `Experiments` (quick-select panel) · `Log in / Sign up` · `EN/中文` pinned top-right. |
| Rendering | Fix the particle-size bug (likely cause of both "no brain" and "sluggish"), render only what is visible, add adaptive quality. |
| Audio | **Original, synthesized** (Web Audio) sounds: a Hollow-Knight-style *light-mote chime* on site buttons, and a *glass-bottle glide* on the brain. No game audio files. |
| i18n | Site UI fully bilingual; **Aloop** and **beLieve** are never translated. Language swap in place, no reload, no layout shift. |
| beLieve | Home shows only name + icon. Clicking **Enter** opens the experiment (existing consent screen first); the experiment is never rendered on the home page. |

---

## 1. Audit of the current build

### 1.1 Why the particle brain does not show, and why it is sluggish

| # | Finding | Evidence | Effect | Fix |
|---|---|---|---|---|
| F1 | **Point sprites are enormous.** `gl_PointSize = aSize * uDpr * s * 620.0` with `aSize≈2–5`, `uDpr` up to 1.8, `s≈0.27–0.5` gives roughly **700–1,400 device px per point** before the driver clamps it (commonly 64–1,024). | `field.js:104` | 2,000 huge additive discs blend into one washed-out blob, so no brain shape. Also massive **fill-rate overdraw** → low FPS. | Use ≈ `aSize * uDpr * s * 3.2`, clamped to `[1, 14*uDpr]` (≈ 2–6 CSS px). |
| F2 | **Fallback SVG is hidden as soon as a context exists**, even if drawing is broken. | `base.css:34-36`, `field.js` end (`webgl-ready`) | User sees a smudge instead of the fallback. | Only mark ready after shaders compile **and** the first frame draws. |
| F3 | **Full-viewport animated canvas under several `backdrop-filter: blur(20px)` layers** (header, every `.card`, footer). | `desktop.css:2`, `base.css:58`, `base.css:123`, `mobile.css:5` | The browser re-blurs behind each layer every frame. This is a classic cause of laggy scroll and hover. | Blur only the top bar + menu panel; ≤16 px; pause the canvas whenever it is off-screen. |
| F4 | **Canvas always renders**, even after the user scrolls away or starts the experiment (only alpha changes). | `field.js` `render()`; `scrollY` only affects `fade` | Wasted GPU/CPU for the whole session. | `IntersectionObserver` + pause on `document.hidden` + pause while an experiment is mounted. |
| F5 | **Per-frame work that can be skipped**: 6,000-float position copy, `bufferSubData`, and 3× `attrib()` rebinding every frame. | `field.js:229-244`, `259-261` | CPU/driver overhead, minor on its own. | Upload `home` once, `disp` only when particles are moving; use a VAO; idle = no draw call. |
| F6 | **Pointer repulsion hits the wrong particles.** The comment says "undoing the spin" but the code does not. Radius `R = 1.0` is about the whole brain. | `field.js` `pointerLocal()`, `stepPhysics()` | Interaction feels random/laggy. | Un-rotate the pointer ray into model space; `R≈0.30–0.40`. |
| F7 | `antialias:true`, `powerPreference:'low-power'`, DPR cap 1.8. | `field.js:12`, `:178` | Extra cost for no visible gain (points are already soft-edged). | `antialias:false`, default power preference, DPR cap 1.5 (1.25 mobile) + adaptive quality. |
| F8 | **Button feedback is deliberately slow**: 1.1 s fill, 0.5–0.6 s colour/underline. | `base.css:63`, `desktop.css` `.site-nav a` | Reads as "sluggish feedback" even at 60 FPS. | Keep the dala look, but the **press state responds in ≤100 ms**; fill ≈450–600 ms. |
| F9 | `scroll-behavior: smooth` on `html` plus a scroll listener writing `--sy`. | `base.css:19`, `app.js:627` | Smooth-scroll fights anchor jumps; style recalc on every scroll frame. | JS-controlled smooth scroll for nav only; drop `--sy`. |
| F10 | Every language switch/step does a full `innerHTML` re-render. | `app.js:286, 304, 325, 344…` | Fine for steps, but janky if it happens mid-animation. | Swap text nodes in place for site UI; keep full re-render only inside the experiment runtime. |

### 1.2 Other things that must change for Aloop

- Name is hard-coded: `index.html` title/meta/brand/aria-label, `app.js:1`, README, footer, storage keys `llab_*` (`app.js:135,144,190`).
- Current home exposes **conditions A/B/C** as public cards and `?arm=` URLs. The README already says client-side arm selection is for QA only → remove from the public UI (keep behind a `?qa=1` flag).
- Header carries experiment progress (`#steps`, `#hd`) and anchors (`method/protocol/status`) → must go; the top bar only has the four requested items.
- Mobile header is `position: sticky` (`mobile.css:5`) → must be **fixed** everywhere.
- Body weight 200 and negative letter-spacing from dala look wrong for Chinese; need a CJK-specific type setting (§8).

---

## 2. Requirements traceability

| ID | Requirement (from brief) | Where addressed |
|---|---|---|
| R1 | Check rendering; feedback is sluggish | §1, §9, Phase 0 + 3 |
| R2 | CN/EN switch stays top-right | §5.1, §8 |
| R3 | Rename interface to **Aloop** | §1.2, Phase 1 |
| R4 | First screen: Aloop logo + cool UI on right (particle brain) | §5.2, §6 |
| R5 | Read dala UI design md | §4 |
| R6 | Top bar: Aloop · Experiments quick-select · login/register · CN/EN; always fixed; frosted glass | §5.1 |
| R7 | Redesign UI | §4, §5 |
| R8 | Hollow-Knight-like light-point sound on non-experiment buttons | §7.1 |
| R9 | Glass-bottle glide sound on brain interaction | §7.2 |
| R10 | Scrolling down = experiments; first is **beLieve** (no Chinese name) | §5.3 |
| R11 | beLieve needs an **entry point**, not direct display | §5.4 |
| R12 | Well-written CN/EN copy; smooth switching | §8 |
| R13 | Experiment tile = name left, particle icon right, no intro; beLieve = particle robot | §5.3, §6.4 |

---

## 3. Target architecture

### 3.1 File layout

```text
aloop/
├── index.html                  # shell: top bar, #home, #experiment-root, modals
├── assets/
│   ├── css/
│   │   ├── tokens.css          # colours, type, spacing, motion (dala tokens)
│   │   ├── base.css            # reset, typography, buttons, links
│   │   ├── topbar.css          # frosted bar, quick menu, auth modal
│   │   ├── home.css            # hero + experiment sections
│   │   └── responsive.css      # ≤700px and reduced-motion
│   ├── js/
│   │   ├── core/               # router.js, i18n.js, store.js, auth.js, audio.js, perf.js
│   │   ├── ui/                 # topbar.js, quickmenu.js, authmodal.js, sections.js
│   │   ├── gl/                 # engine.js, shapes.js, scenes/brain.js, scenes/robot.js
│   │   └── registry.js         # experiment manifest
│   ├── i18n/site.js            # { zh:{…}, en:{…} } for site UI
│   └── fonts/                  # only licensed fonts (see §10, Q3)
├── experiments/
│   └── believe/
│       ├── manifest.js         # id, name, scene, accent, load()
│       ├── runtime.js          # current app.js, refactored (lazy-loaded)
│       ├── strings.js          # existing bilingual STR for the task
│       └── believe.css
├── tests/                      # static_smoke.py, browser_smoke.py, perf_trace.py (new)
└── README.md, DEPLOY_GITHUB_PAGES.md
```

Why classic scripts, not a bundler: matches the current `python -m http.server` / GitHub Pages workflow, keeps `standalone.html` buildable, and experiments can still be lazy-loaded by injecting a `<script>` on demand. Revisit Vite only when there are 3+ experiments or a real backend client.

### 3.2 Routing (hash-based, works on GitHub Pages)

| Route | Behaviour |
|---|---|
| `#/` | Home; scroll to hero. Clicking **Aloop** in the top bar goes here. |
| `#/e/<id>` | Home, scrolled to that experiment's section (target of the quick-select menu). |
| `#/e/<id>/run` | Entry (resume sheet if needed) → mounts the experiment into `#experiment-root`. Browser Back returns to the section. |

The top bar stays mounted on every route. While an experiment runs: home canvases are paused, site sounds are disabled (§7.3), and the experiment's own progress indicator lives in a slim bar **below** the top bar.

### 3.3 Experiment plugin contract

```js
// experiments/believe/manifest.js
Aloop.registerExperiment({
  id: 'believe',
  name: 'beLieve',            // never translated
  scene: 'robot',             // particle icon id (gl/scenes)
  accent: 'var(--c-primary)',
  order: 1,
  load: () => Aloop.loadScript('experiments/believe/runtime.js'),
});

// runtime.js
Aloop.experiments.believe = {
  hasResumable() {},          // true if an unfinished session is stored
  mount(root, ctx) {},        // ctx = { lang, t, auth, exit() }; returns unmount()
  onLangChange(lang) {},      // re-render current stage, keep state
};
```

Adding experiment #2 = one folder + one manifest + one particle scene. The home sections, quick menu, and routes are generated from the registry.

---

## 4. Design system (from `design.md`)

Take the **tokens and interaction patterns** from dala; do **not** import its bundles (`webclone-local-loader.js` ≈ 1.8 MB, `0.js` ≈ 836 KB, GSAP/ASScroll/dom2webgl). They would cost far more than the whole site.

### 4.1 Tokens (`tokens.css`)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#F5F7FA` | Research/tool page canvas |
| `--surface` | `#FFFFFF` | Cards, forms, and reading surfaces |
| `--c-primary` | `#315E91` | Primary actions, links, selection, progress |
| `--c-deep` | `#23466D` | Hero, top bar, and high-contrast action hover |
| `--c-blue` | `#477EAE` | Supporting visual emphasis |
| `--c-secondary` | `#F2CC4D` | Selective highlights and key markers |
| `--c-tertiary` | `#5AB7BD` | Auxiliary interaction and visualization |
| `--text` / `--text-2` | `#253449` / `#5E6D82` | Primary and secondary text on light surfaces |
| `--border` | `#DCE4ED` | Dividers, cards, form outlines |
| `--radius-pill` | `30px` | Primary action pill |
| spacing base | `8px` (16 / 24 / 40 / 50 / 80) | Layout |

The homepage and experiment showcase sections use deep-blue surfaces with abstract topographic linework. EasySci, account surfaces, and experiment runtime screens use white and pale blue-gray surfaces. Yellow remains a selective accent; cyan is reserved for auxiliary interaction and data visuals. `assets/css/theme-blue.css` maps the palette to existing components without changing routes or event behavior.

### 4.2 Type

- Latin: **PP Neue Montreal** if licensed (the woff2 files exist in the dala bundle, but it is a commercial font); otherwise a neutral grotesk fallback stack. Display ≈150px/400/-0.03em, body 24px/200, labels 16px/600 uppercase.
- Chinese needs its own rules (§8.3).

### 4.3 Components and motion

| Component | Spec |
|---|---|
| **Primary pill** | `#315E91`, white uppercase label, radius 30px, padding 16×20. Hover uses deep blue `#23466D`; use yellow only as a selective highlight. **Press feedback ≤100 ms** (scale .98 + brightness), fill 450–600 ms. |
| **Link** | Secondary-colour text, 1 px underline wipe, ≤500 ms, `cubic-bezier(.19,1,.22,1)`. |
| **Top bar** | See §5.1. |
| **Quick menu / modals** | Same glass recipe as the bar; radius 24–30px. |
| **Motion** | Expressive but short: hero title lines rotate in (7°, 0.9 s, once). `prefers-reduced-motion` → no rotate-in, static particle frame, softer sounds. |
| **Focus** | Visible 2px ring on all controls (keep `:focus-visible` rule). |

---

## 5. Page specifications

### 5.1 Top bar (always fixed, frosted glass)

```text
[ ◎ Aloop ]  [ Experiments ▾ ]  ·····················  [ Log in / Sign up ]  [ 中文 ]
```

| Item | Behaviour |
|---|---|
| **Aloop** (logo + wordmark) | Click → `#/` + smooth scroll to top. Never translated. |
| **Experiments** | Opens the quick-select panel (§5.1.1). |
| **Log in / Sign up** | Opens the auth modal (§5.1.2). When signed in: avatar/initial → menu (Sign out). |
| **EN / 中文** | Always the far right. Shows the *target* language (as now). |

Glass recipe (works over the animated hero without re-blurring a heavy area):

```css
.topbar{
  position:fixed; inset:0 0 auto; z-index:50; height:64px;           /* 56px on mobile */
  padding:0 clamp(16px,3.5vw,50px) 0; padding-top:env(safe-area-inset-top);
  background:rgba(12,12,18,.45);
  -webkit-backdrop-filter:blur(16px) saturate(1.4);
  backdrop-filter:blur(16px) saturate(1.4);
  border-bottom:1px solid var(--border);
  box-shadow:inset 0 1px 0 hsla(0,0%,100%,.06);
  contain:layout paint;
}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
  .topbar{background:rgba(0,0,0,.88)}
}
```

Remove from the bar: step list, "question n/m" header, `method/protocol/status` anchors. Mobile: same four items (labels collapse to icons if width < 380px); **fixed, not sticky**.

#### 5.1.1 Quick-select panel

- Frosted dropdown under the button; one row per experiment: small static particle thumbnail (pre-rendered SVG, not live WebGL) + name. Current section is highlighted (scroll-spy).
- Click/Enter → navigates to `#/e/<id>` (smooth-scrolls to that section).
- Keyboard: `aria-haspopup="menu"`, `aria-expanded`; Up/Down to move, Esc closes and returns focus; outside click closes. Touch: opens as a bottom sheet.
- Empty slots show a muted "More coming soon" row.

#### 5.1.2 Auth modal (UI first, backend later)

- Tabs: Log in / Sign up; fields: email, password (+ confirm on sign-up).
- `Aloop.auth` is an interface: `signIn / signUp / signOut / onChange / user`. Phase 2 ships a **local mock adapter** that clearly says accounts are not enabled yet. A real adapter plugs in later (§10, Q5). Experiments must not depend on login unless `requireLogin: true` is set in the manifest.

### 5.2 Home hero

- Full-bleed black, `min-height:100svh`, two-column flex.
- **Left:** the Aloop logo at display size (≈ `clamp(72px, 11vw, 160px)`), title-line rotate-in once. No tagline. A small "Scroll / 向下滚动" cue at the bottom edge.
- **Right:** the particle-brain stage (§6.2), ≈55 % of width, vertically centred, extends slightly under the top bar. On mobile the stage sits above the logo and the logo shrinks; the brain stays touch-interactive.
- Logo: no asset was provided. Ship a placeholder SVG wordmark (looped "A" glyph); drop in the real file when available (Q1).

### 5.3 Experiment sections

- One section per registry entry: `min-height:100svh`, `scroll-snap-align:start`, container uses `scroll-snap-type:y proximity` (not `mandatory`, to avoid fighting trackpads).
- **Left:** experiment name only, display type (`beLieve`, original casing, same in both languages), with an **Enter** pill (`进入`) beneath it. No description, tagline, or stats.
- **Right:** particle icon stage (§6.4). For beLieve: a robot made of particles.
- Whole tile is a link to `#/e/<id>/run`; the name and the icon respond to hover/press; the pill is the explicit keyboard target.
- Mobile: name on top, icon below, same single Enter pill.

### 5.4 beLieve entry (never shows the experiment directly)

1. User clicks **Enter** → route `#/e/believe/run`.
2. If `hasResumable()`: small sheet — *Continue* / *Start over* (CN/EN strings in §8.4). Otherwise skip.
3. Lazy-load `runtime.js`, mount into `#experiment-root`; the first screen is the existing **consent** step.
4. Exit button (top-left of the experiment view) → confirm if mid-trial → back to `#/e/believe`.

Experiment-runtime changes: remove the home/hero/conditions/method/status screens from `app.js`; keep consent → conditions → trials → debrief and JSON export; move the step indicator to the experiment sub-bar; rename storage keys `llab_* → aloop_believe_*` with a one-time read of old keys so existing test sessions survive; add `site:"aloop"`, `experiment_id:"believe"`, `app_version` to log metadata. A/B/C selection only with `?qa=1`.

---

## 6. Particle engine

### 6.1 Structure

- `gl/engine.js`: one rAF loop; stages register `{el, scene, quality}`; **each stage owns a small canvas inside its own DOM node** (so it scrolls with the page, no one-frame lag against a fixed canvas). A pool allows **max 2 live contexts**; stages near the viewport (`rootMargin:50%`) get one, far ones release theirs (`WEBGL_lose_context`). Browser limit is ~16 contexts, so this scales to many experiments.
- WebGL2 if available (VAOs, instancing not needed at this count), WebGL1 otherwise.
- Shared shader: `position = aHome + aDisp`; colours from CSS variables; soft round sprite; additive blend.
- State per scene: `home` (static), `disp` and `vel` (CPU, typed arrays). When total kinetic energy < ε the scene stops uploading and drawing at full rate (idle shimmer only).

### 6.2 Brain scene (hero)

- **Shape that reads as a brain** (the current cloud is two plain ellipsoids): two hemispheres with a **longitudinal fissure**, gyri/sulci from ridged noise displacement on the surface, a cerebellum and brain-stem blob, ≈2,000 points (1,200 on mobile / low tier).
- **View:** side-leaning ¾ view that **oscillates ±0.5 rad** instead of spinning 360° (a full spin destroys the silhouette).
- Colour: cool base, warm "sunset" cluster on the upper right, accent "lighthouse" cluster left, 6–8 orbiting light motes (keep from current design).
- Optional stretch: ~150 synapse line segments with travelling pulses.
- **Interaction**
  - Pointer ray is un-rotated into model space; repulsion radius ≈0.35, spring back; speed-scaled swirl.
  - Click/tap → shockwave ring (points push outward and ring back) + glass "tink" (§7.2).
  - Touch: `touch-action: pan-y` on the stage so vertical scroll still works; drag on the brain triggers glide.
- **Acceptance:** recognisable as a brain within ~3 s; no visible blob/wash-out; hover affects only particles near the cursor.

### 6.3 Corrected point shader (core of F1)

```glsl
// vertex
float s = uScale / (3.2 - p.z);
gl_PointSize = clamp(aSize * uDpr * s * 3.2, 1.0, 14.0 * uDpr);
```

Tune the constant `3.2` so a typical point is 2–6 CSS px. Keep the fragment soft-circle falloff.

### 6.4 Robot scene (beLieve icon)

1. Draw a simple robot (rounded-square head, antenna with a ball, two eye cut-outs, grille mouth, body, arms) on an offscreen 256×256 2D canvas.
2. `getImageData` → sample ≈1,400 points (jittered grid); detect edge pixels (neighbour alpha test) and give them larger/brighter sprites so the silhouette stays readable. Eye points use the accent colour; antenna tip pulses.
3. Idle: breathing scale ±2 %, per-point noise drift, eye blink every ~4 s.
4. Enter viewport: particles **assemble** from a random scatter in ~1.2 s (`expo.out`).
5. Hover/touch: same repulsion + spring as the brain; click-through goes to the entry link.

New experiments supply a new scene (an SVG path, bitmap, or function) to the same sampler; no engine changes.

### 6.5 Fallbacks

- No WebGL or shader failure → pre-rendered SVG dots of the brain/robot (the current SVG brain is the model). Fallback is hidden **only after the first successful frame**.
- `prefers-reduced-motion` → draw one static frame, no rotation, no sound.

---

## 7. Audio

All sounds are **generated with Web Audio** by `core/audio.js` — no game assets. Hollow Knight audio is copyrighted; copying or extracting its files is not an option. The synthesized sound targets the *feel* (a soft, bell-like mote of light) with original material. If you prefer recorded samples, supply your own or licensed files (≤30 KB each, ogg+mp3) in `assets/audio/` and `audio.js` will use them instead.

### 7.1 Light-mote chime (site buttons)

| Parameter | Hover | Press/click |
|---|---|---|
| Pitch | random from D-major pentatonic, one octave up (D5 E5 F♯5 A5 B5 ×2) | same set, base octave |
| Partials | sine × [1, 2.01, 3.02], gains [1, .3, .1] | same + soft 5th grace note 60 ms earlier |
| Envelope | attack 10 ms → exp decay 350 ms | attack 12 ms → exp decay 900 ms |
| Shimmer | none | 60 ms noise burst, high-pass 5 kHz, −34 dB |
| Space | convolver (generated 1.4 s IR) 20 % wet | 28 % wet |
| Level | ≈ −26 dBFS | ≈ −20 dBFS |

Rules: trigger hover on `pointerenter` (devices with `hover:hover` only) and click on **`pointerdown`** (lowest latency); ≥70 ms between hover sounds; voice pool of 4; random pitch to avoid fatigue; master compressor.

### 7.2 Glass-bottle glide (brain)

A finger/mouse rubbing glass is filtered noise with high-Q resonances plus stick-slip modulation:

```js
// noise (looped 2 s buffer) → 4 parallel band-pass filters (Q 60–120)
const F  = lerp(900, 2200, 1 - y01);          // pitch follows vertical pointer position
const ratios = [1, 2.76, 5.40, 8.93];        // inharmonic, glass-like; tune by ear
// amplitude follows pointer speed inside the brain hit-area
gain.setTargetAtTime(smoothstep(v0, v1, speed) * 0.06, now, 0.03);   // attack ~30 ms
// release ~180 ms when the pointer stops or leaves
// stick-slip: AM LFO 18–40 Hz, depth 0.15 × speed
```

- Click/tap on the brain: "tink" — two exponentially decaying sines at `F` and `F×2.76`, 400–700 ms.
- Silent when the pointer is still or outside the brain's hit ellipse; hard-stops within 250 ms.

### 7.3 Policy

- `AudioContext` is created/resumed on the first user gesture (browser autoplay rules; iOS needs `touchstart`/`pointerdown`).
- **Scope:** site chrome and home only. Everything is disabled while an experiment is mounted so sound cannot contaminate behavioural data.
- Sound on/off toggle, persisted (`aloop_sound_v1`), as a small icon fixed at bottom-left of the hero (not in the top bar, per your four-item spec; see Q6). Never the only carrier of information.

---

## 8. Internationalisation

### 8.1 Rules

- Dictionaries: `i18n/site.js` for site UI; `experiments/<id>/strings.js` per experiment. Key naming `area.item` (`nav.experiments`).
- **Never translated:** `Aloop`, `beLieve`.
- Default language from saved choice → `navigator.language` (`zh*` → zh, else en). Persist in `aloop_lang_v1`; optional `?lang=en|zh`.
- Switch in place (no reload): update every `[data-i18n]` node, `aria-label`/`title` via `data-i18n-attr`, `document.title`, meta description, and `<html lang>` (`zh-CN` / `en`). Changed text crossfades in ≈150 ms; fixed min-widths on top-bar items prevent layout shift.
- Inside an experiment: call `onLangChange(lang)`; the runtime re-renders only the current stage and keeps state (current behaviour, preserved). Language switches continue to be logged as an event.

### 8.2 Copy deck (site)

| Key | EN | 中文 |
|---|---|---|
| `nav.experiments` | Experiments | 实验 |
| `nav.auth` | Log in / Sign up | 登录 / 注册 |
| `nav.lang` (shows target) | 中文 | EN |
| `hero.scroll` | Scroll | 向下滚动 |
| `menu.title` | Choose an experiment | 选择实验 |
| `menu.soon` | More experiments coming soon | 更多实验即将上线 |
| `exp.enter` | Enter | 进入 |
| `auth.login.title` | Welcome back | 欢迎回来 |
| `auth.signup.title` | Create your account | 创建账号 |
| `auth.email` / `auth.password` | Email / Password | 邮箱 / 密码 |
| `auth.confirm` | Confirm password | 确认密码 |
| `auth.login.submit` / `auth.signup.submit` | Log in / Sign up | 登录 / 注册 |
| `auth.toSignup` | New here? Sign up | 还没有账号？去注册 |
| `auth.toLogin` | Already have an account? Log in | 已有账号？去登录 |
| `auth.pending` | Accounts are not open yet. | 账号功能暂未开放。 |
| `gate.resume` | Continue where you left off | 继续上次的进度 |
| `gate.restart` | Start over | 重新开始 |
| `exp.exit` | Exit | 退出 |
| `exp.exitConfirm` | Leave now? Your progress is saved. | 现在离开吗？你的进度已保存。 |
| `sound.on` / `sound.off` | Sound on / Sound off | 声音：开 / 声音：关 |
| `foot.copy` | © Aloop | © Aloop |

Copy quality checks: natural 简体 phrasing (not literal translation), full-width punctuation in Chinese, no mixed "…" styles, labels short enough to fit both languages in the same width, and a native review pass before launch.

### 8.3 Chinese typography

```css
html[data-lang="zh"] body{
  font-family: var(--font-latin), "PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif;
  font-weight:300;          /* wght 200 does not exist on most CJK system fonts */
  letter-spacing:0;         /* negative tracking hurts CJK legibility */
  line-height:1.7;
}
```

Use system CJK fonts (no web CJK font; they are multi-MB). Display text with Chinese uses 400–500 weight.

### 8.4 beLieve strings

Only the **name** is untranslated. The existing task text in `strings.js` is already bilingual and stays that way (Q7). Entry sheet uses `gate.*` above.

---

## 9. Performance plan

### 9.1 Budgets

| Metric | Target |
|---|---|
| Hero FPS | ≥ 55 on a mid-range laptop with integrated GPU; ≥ 30 on mid-range phone |
| Input latency (press → visible state change) | ≤ 100 ms; audio start ≤ 50 ms |
| LCP (logo + stage visible) | ≤ 2.0 s on fast 4G |
| INP | ≤ 200 ms |
| Home JS (gz) | ≤ 120 KB; beLieve runtime loads only on entry |
| Total home transfer | ≤ 400 KB excluding fonts |

### 9.2 Measures (all from §1.1)

1. Fix point size (F1). Re-measure first; this alone may remove most lag.
2. Visibility gating: `IntersectionObserver`, `visibilitychange`, experiment-mounted pause (F4).
3. Remove blur from cards/footer; keep one blur layer (top bar) + menu panel (F3).
4. Adaptive quality: average frame time over 60 frames; if > 20 ms step down → DPR → particle count → idle-only mode; never step back up within the session.
5. Upload only when moving; VAO; `antialias:false` (F5, F7).
6. rAF-coalesced `pointermove`; `{passive:true}`; delegated button handlers.
7. Press-state-first button animation (F8); no JS-driven hover animation.
8. Fonts: `font-display:swap`, subset Latin; no web CJK.
9. Audio: lazy context, pre-generate the reverb IR once, voice pool.

### 9.3 Measurement protocol (Phase 0 and every release)

- Chrome DevTools → Performance (6× CPU throttle) and Rendering → *Frame rendering stats*, *Paint flashing*, *Layer borders*.
- Record: frame time during hover on the brain; scroll through hero → experiments; open/close quick menu; language switch.
- Log GPU process and main-thread time per frame; save screenshots/traces in `tests/perf/`.
- Add `tests/perf_trace.py` (Playwright + tracing) once the environment allows Chromium; static checks stay in `static_smoke.py`.

---

## 10. Phases

| Phase | Work | Deliverable / acceptance | Effort |
|---|---|---|---|
| **P0 – Verify & quick fix** | Run the current build with the profiling steps in §9.3; apply F1, F2 as a hot-fix. | Brain visible; before/after frame times recorded. Confirms or corrects §1. | 0.5–1 d |
| **P1 – Foundations & rename** | New file layout; tokens; Aloop naming everywhere; storage key migration; remove public A/B/C; router skeleton; `registry.js`. | Site boots at `#/`; no "Lateral Reading Lab" strings (grep clean); old sessions still resume. | 1–2 d |
| **P2 – Top bar, i18n, auth UI** | Frosted fixed bar; quick menu; auth modal + mock adapter; in-place language switch; CJK type rules; copy deck. | Bar stays fixed on all routes/breakpoints; lang switch < 200 ms, no reflow; menu fully keyboard-operable. | 2–3 d |
| **P3 – Particle engine & hero** | Engine, pooling, adaptive quality, new brain scene, interaction, fallback. | Brain recognisable; budgets in §9.1 met on 2 test devices; reduced-motion = static frame. | 3–4 d |
| **P4 – Experiment sections & robot** | Section layout, scroll-snap, scroll-spy, robot scene + assemble animation, Enter pill. | beLieve tile = name left / robot right / no copy; mobile stack OK; menu → section scroll works. | 2 d |
| **P5 – beLieve entry & runtime refactor** | Lazy-load runtime; resume sheet; exit flow; progress sub-bar; metadata fields; `?qa=1` arms. | Experiment never appears on home; Enter → consent; full flow + JSON export still works; Back returns to the section. | 2–3 d |
| **P6 – Audio** | `audio.js`, chime, glide, tink, toggle, policy (§7.3). | Sounds on all non-experiment buttons and brain; silent inside experiment; ≤50 ms start; mute persists. | 1–2 d |
| **P7 – QA, perf, deploy** | Device matrix, a11y pass, Lighthouse, native-speaker copy review, GitHub Pages deploy, README rewrite. | Checklist below all green; public URL working. | 2 d |

Total ≈ 3–4 working weeks for one developer, with P2/P3 overlappable. Backend/auth (real) is a separate track after P7.

### Release checklist

- [ ] 360 px phone, phone landscape, ~768 px tablet, ≥1280 px desktop
- [ ] Windows Chrome/Edge (integrated GPU), macOS Safari, iOS Safari, Android Chrome
- [ ] Keyboard-only: bar, menu, modal, Enter, exit; screen-reader names for all controls
- [ ] `prefers-reduced-motion`, no-WebGL, `backdrop-filter` unsupported
- [ ] Autoplay unlock on first tap (iOS), mute persistence
- [ ] Language switch on every screen; no untranslated keys; `Aloop`/`beLieve` unchanged
- [ ] Old `llab_*` sessions resume; export JSON includes new metadata
- [ ] `static_smoke.py` updated and passing; `browser_smoke.py` passing where Chromium is available

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Blur over animated canvas stays expensive on weak GPUs | Single blur layer, 16 px, pause canvas when off-screen, `@supports` solid fallback. |
| Font licence | Ship fallback stack by default; add PP Neue Montreal only with a licence. |
| Sound annoys or surprises users | Quiet levels, mute toggle, nothing autoplays, disabled in experiments. |
| Brain still not recognisable | Silhouette-sampled variant (offscreen 2D mask) as a drop-in alternative generator. |
| Real research data is not safe on a static host | Out of scope for this roadmap; carry over the README blockers (server-side randomisation, data store, consent text, ethics approval, preregistration). |
| Access from mainland China to the host/backend | Decide hosting/region early (Q5); keep the auth/data layer behind adapters. |

---

## 12. Assumptions and open questions

**Assumptions I made (change any of them):**
- A1. Colours follow the Aloop Research Blue palette in `design.md`: blue/blue-gray surfaces, yellow highlights and cyan data/interaction accents.
- A2. beLieve's existing task content stays bilingual; only the name is untranslated.
- A3. Experiments are open without login for now (`requireLogin:false`).
- A4. Public A/B/C condition cards are removed (QA-only via `?qa=1`).
- A5. Clicking an experiment in the quick menu scrolls to its section; **Enter** is what launches it.

**Open questions:**
- Q1. Do you have an Aloop logo file (SVG preferred), and the group's full name for meta/footer?
- Q2. Palette is now settled in `design.md` as Aloop Research Blue; do not revert to the source site’s original purple/green palette.
- Q3. Do you hold a PP Neue Montreal licence, or should I pick a free alternative?
- Q4. Do you want recorded samples for the two sounds (your own/licensed), or are synthesized ones acceptable?
- Q5. Backend for accounts and data (e.g. Supabase, Firebase, own server) and the hosting region for your participants?
- Q6. OK to put a small sound toggle at the bottom-left of the hero instead of in the top bar?
- Q7. Should the beLieve task text itself remain bilingual?

---

## Appendix A — Config constants (`assets/js/config.js`)

```js
Aloop.config = {
  gl:   { maxLiveContexts: 2, dprCap: 1.5, dprCapMobile: 1.25,
          brainCount: 2000, brainCountLow: 1200, robotCount: 1400,
          pointScale: 3.2, repelRadius: 0.35, spring: 6.0, damping: 0.06 },
  perf: { frameBudgetMs: 20, sampleFrames: 60 },
  audio:{ hoverMinGapMs: 70, voices: 4, masterGain: 0.5 },
  ui:   { barHeight: 64, barHeightMobile: 56, blurPx: 16 },
  keys: { lang: 'aloop_lang_v1', sound: 'aloop_sound_v1',
          session: 'aloop_believe_session_v1', legacyPrefix: 'llab_' },
};
```
