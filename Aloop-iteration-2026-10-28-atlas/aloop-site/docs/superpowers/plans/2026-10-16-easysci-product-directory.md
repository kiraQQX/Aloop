# Products Navigation and EasySci Directory Implementation Plan

> **For agentic workers:** Follow this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a top-level Products menu and expand EasySci into a responsive, searchable, bilingual research-and-visual-tools directory without breaking existing Aloop interactions.

**Architecture:** Reuse the zero-build HTML/CSS/classic-JavaScript architecture, existing hash router, i18n dictionaries, and design tokens. Store resource metadata in one structured data file and render accessible cards, combined filters, dynamic counts, inline disclosures, and retained direct detail routes from that data. Regenerate the single-file `standalone.html` from the maintained source files.

**Tech Stack:** HTML, CSS custom properties, classic JavaScript, Python static smoke tests, Node.js syntax checks, existing standalone build script.

**Spec:** `docs/superpowers/specs/2026-10-16-easysci-product-directory-design.md`.

## Global Constraints

- Keep the current zero-build static architecture; do not add a framework or runtime dependency.
- Preserve current experiment routes, session state, particle brain interactions, data-sea animation, account modal, audio, and language switching.
- Every external destination must use HTTPS and open with `target="_blank"` and `rel="noopener noreferrer"`.
- Resource popularity is an editorial shortlist except where a sourced, time-bounded traffic-category signal is explicitly cited.
- Pricing and license metadata not individually verified online must remain clearly marked as needing official-site confirmation.
- Use one reusable `--accent-yellow` token, with dark text on yellow surfaces and visible keyboard focus.
- Keep EasySci resource count and access-model counts derived from its actual data.

## Review Focus

- Malformed URLs and unsafe schemes must be excluded from outgoing links; test the URL validator and static data integrity.
- Combined category/access/search filters must return the intersection of all active filters; test static logic anchors and interactive smoke coverage where available.
- Inline disclosure controls must not turn the entire card into a navigational link; test explicit button/link semantics and `aria-expanded`.
- Direct `#/easysci/:slug` links and direct `#/easysci` loads must continue to work.
- Mobile viewport layouts must allow filters and resource cards to wrap without horizontal overflow; inspect responsive CSS and run browser tests if Playwright is available.

---

### Task 1: Add Products navigation without changing experiment menu behavior

**Files:**
- Modify: `index.html`
- Modify: `assets/js/ui/quickmenu.js`
- Modify: `assets/css/topbar.css`
- Modify: `assets/i18n/site.js`
- Test: `tests/static_smoke.py`

- [x] Add a Products top-level trigger and a Products menu with EasySci as a child; add Chinese/English labels.
- [x] Extend menu behavior with outside-click, Escape, focus restoration, and direct EasySci routing while retaining the existing Experiments menu logic.
- [x] Add responsive positioning and visible keyboard-focus styles.
- [x] Add static checks for sibling navigation, menu destination, localization, and keyboard affordances; run the static smoke test.

### Task 2: Normalize and expand EasySci resource metadata

**Files:**
- Modify: `assets/js/easysci/data.js`
- Test: `tests/static_smoke.py`

- [x] Preserve existing resources while mapping them into the expanded directory taxonomy.
- [x] Add curated literature, statistics, visualization, experiment, design, image editing, asset, and AI-creative resources using official destination URLs.
- [x] Normalize each record to include bilingual summary/details, category, access-model labels, use cases, strengths, limitations, sign-in/free-tier notes, license notes, verification status, and optional popularity evidence.
- [x] Deduplicate official URLs, validate HTTPS destinations, and keep uncertain billing/licensing information explicitly marked for verification.
- [x] Add static data checks for record shape, valid unique official URLs, safe URL schemes, and dynamic-count support; run syntax and static tests.

### Task 3: Implement EasySci search, combined filters, counts, expandable cards, and detail routes

**Files:**
- Modify: `assets/js/easysci/easysci.js`
- Modify: `assets/css/easysci.css`
- Modify: `assets/css/tokens.css`
- Modify: `assets/css/responsive.css`
- Test: `tests/static_smoke.py`

- [x] Build searchable resource cards and filter by category plus Free/Freemium/Paid/Open Source access-model facets.
- [x] Derive total, filtered, per-category, and per-access-model counts from live records and active filters.
- [x] Add an accessible inline detail disclosure beneath each summary, plus a separate official-site action and retained standalone detail routes.
- [x] Add concise use-case, strength, limitation, sign-in, free-tier, license, and verification details; include the sourced September 2026 Similarweb category-rank caveat without claiming a universal ranking.
- [x] Style yellow name markers, bold 18px summary text, yellow hover/active/focus states, contrast-safe text, empty states, and mobile-safe controls.
- [x] Run static checks and Node syntax checks; inspect browser test availability.

### Task 4: Build portable demo and run regression verification

**Files:**
- Regenerate: `standalone.html`
- Modify: `README.md`
- Modify: `tests/static_smoke.py`
- Optional new: `tests/easysci_smoke.py`

- [x] Add acceptance checks for Products/EasySci navigation, schema and URL integrity, new filter/disclosure semantics, yellow design tokens, and existing experiment invariants.
- [x] Regenerate the self-contained HTML file from the source shell.
- [x] Run static tests, all JavaScript syntax checks, resource integrity/count reports, and browser smoke tests if Playwright/Chromium are available.
- [x] Update README with navigation, directory behavior, external-link/pricing caveats, and verification limits.
- [x] Package the complete source folder as a ZIP and report exact resource counts, file changes, test outcomes, and items still requiring manual verification.
