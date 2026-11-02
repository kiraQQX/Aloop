# Aloop Technical Requirements

**Document status:** Current architecture reference  
**Last reconciled with repository:** 2026-11-02  
**Scope:** Application entry, runtime composition, routing, localisation, build output, testing, and deployment configuration.

This document describes the implementation represented by the repository. If this document conflicts with executable configuration or source code, inspect the code and update this document in the same change. Historical product-design requirements are retained separately in the root-level `TECHNICAL_SPECIFICATIONS.md`.

## 1. Architecture overview

Aloop uses a Vue 3 + Vite application shell around a modular classic-JavaScript runtime.

```text
Browser
└── index.html                         Single production entry
    └── src/main.js                    Creates the Vue application
        └── src/App.vue                Shell, navigation, locale, hash routing
            ├── legacy.html iframe     Existing H5 runtime
            │   ├── assets/js/core/    Routing, storage, auth adapter, audio, performance
            │   ├── assets/js/ui/      Menus, account modal, page sections
            │   ├── assets/js/easysci/ EasySci catalogue and interface
            │   ├── assets/js/smartbrain/ Smart Brain, Learn, narration, Atlas
            │   ├── assets/js/gl/      Homepage particle cortex and graphics engine
            │   └── experiments/believe/ beLieve runtime
            └── 说明.html iframe       Bilingual About and licensing page
```

### Architectural constraints

1. `index.html` is the only production HTML entry.
2. Vue owns the visible shell, top-level navigation, language state, hash routing, and iframe lifecycle.
3. The legacy feature runtime remains primarily classic JavaScript. Do not assume that all feature modules have been migrated to Vue components.
4. `legacy.html` must be served without Vite HTML transformation in development because it relies on its classic script ordering and import map.
5. `standalone.html` is a development-only historical comparison artefact. It must not be linked by production routes or copied into `dist/`.

## 2. Routes and iframe contract

| Public hash route | Shell state | Embedded document |
|---|---|---|
| `#/` | Home | `legacy.html?embed=1#/` |
| `#/e/<id>` and `#/e/<id>/run` | Experiments | `legacy.html?embed=1#/e/<id>...` |
| `#/easysci` and `#/easysci/<slug>` | Products / EasySci | `legacy.html?embed=1#/easysci...` |
| `#/smart-brain` and its Learn / Atlas routes | Products / Smart Brain | `legacy.html?embed=1#/smart-brain...` |
| `#/about` | About | `说明.html?embed=1&lang=<zh|en>` |

Requirements:

- Direct navigation to supported deep links must resolve to the corresponding shell and iframe state.
- Refresh, browser back, and browser forward must preserve route synchronisation.
- Hash changes inside the legacy iframe must be reflected by the outer shell.
- An unauthenticated attempt to enter the beLieve run route is redirected to the experiment entry and opens the login modal. Authentication is Supabase-backed (see section 6).

## 3. Localisation

- Shared local-storage key: `aloop_lang_v1`.
- Supported values: `zh` and `en`.
- The shell defaults to Chinese unless a valid stored preference exists.
- The shell and embedded runtime must converge on the same language without overwriting a saved preference on every iframe load.
- The About page receives the selected locale through `?lang=zh|en` and uses the same storage key.
- Any new user-visible feature must provide both Chinese and English strings and must not rely on colour alone to communicate state.

## 4. Runtime dependencies

The current dependency declarations are in `package.json` and the lockfile.

| Dependency | Repository declaration | Role |
|---|---|---|
| Vue | `^3.5.13` | Application shell |
| Vite | `^6.0.7` | Development server and production bundler |
| `@vitejs/plugin-vue` | `^5.2.1` | Vue SFC support |
| Vitest | `^2.1.8` | Unit and regression tests |
| jsdom | `^25.0.1` | DOM test environment |
| Playwright | `1.64.1` | Chromium end-to-end tests |
| Wrangler | `4.80.0` (pinned) | Cloudflare deployment CLI |
| `@supabase/supabase-js` | `^2.118.0` | Installed SDK; not currently wired into application entry points |
| Three.js | `0.186.1` via import map | Legacy runtime graphics dependency |
| Draco | Self-hosted under `assets/models/atlas/draco/` | GLB decoding |

Wrangler 4.80.0 requires Node.js 20.3 or later. The repository CI currently uses Node.js 20.

Do not add a second Three.js version or a competing WebGL renderer lifecycle without a separate architecture review. Do not restore remote GitHub or gstatic Draco asset URLs; the model and decoder assets are self-hosted.

## 5. Development-server and build contract

The Vite configuration contains three important behaviours:

- `serveLegacyRuntime` serves `legacy.html`, `说明.html`, `standalone.html`, `assets/**`, and `experiments/**` as static files in development, without transforming the legacy HTML.
- `copyLegacyRuntime` copies `legacy.html`, `说明.html`, `assets/**`, and `experiments/**` into `dist/`.
- `verifyProductionOutput` checks required production files and rejects `dist/standalone.html`.

The required output list is maintained in `vite.config.js`. When adding a required runtime asset or static directory, update the build contract and the relevant tests in the same change.

Build command: `npm run build`  
Output directory: `dist/`

Do not create a second production HTML entry. Do not bypass the output validation to make a broken build pass.

## 6. Authentication and data status

Authentication uses Supabase Auth in two mutually exclusive modes:

- **Shell mode** — `src/lib/supabase.js` creates one client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`; `src/lib/auth.js` owns the session and exposes `window.__ALOOP_AUTH__` to the embedded runtime.
- **Standalone mode** — when no bridge exists, `assets/js/core/auth.js` calls GoTrue REST with the public values from `assets/js/core/config.js`; the session lives in `aloop_session_v2`.

Both modes cover sign-up, sign-in, sign-out, refresh, email verification, resend, and password reset. Shell mode never reads or writes the REST session, and standalone mode never touches the shell session.

Still prototype-level:

- The beLieve session and event data are stored in browser-local storage.
- The `?qa=1&arm=A|B|C` selector is client-controlled and intended only for development QA.
- Server-side participant-data upload, research randomisation, backup/retention controls, and real-project RLS verification require separate design and security review. The schema is provided in `supabase/migrations/` but applying it is a reviewed deployment step.

Never commit service-role keys, secret keys, database credentials, access tokens, or local environment files. Public client configuration is not a substitute for server-side access control.

## 7. Static assets and licensing

The homepage particle cortex and Smart Brain Atlas use assets under `assets/models/atlas/`. The anatomy asset and viewer source have separate licence terms. Preserve the notices in `assets/models/atlas/ATTRIBUTION.md` and the About page.

The GLB and Draco decoder are self-hosted. Three.js is still loaded from the pinned CDN import-map entry, so the application is not a fully offline bundle. Any dependency-hosting change must account for package size, licensing, cache behaviour, and compatibility.

## 8. Tests and CI

Available scripts:

| Script | Purpose |
|---|---|
| `npm test` | Vitest unit and regression suite |
| `npm run test:e2e` | Playwright Chromium end-to-end suite |
| `npm run build` | Production build and output-contract validation |
| `npm run preview` | Local production preview |

The repository workflow is `.github/workflows/frontend-ci.yml`. It currently uses Node.js 20 and runs:

1. `npm install`
2. `npm test`
3. `npm run build`
4. `npx playwright install --with-deps chromium`
5. `npm run test:e2e`

The workflow uses `Aloop-iteration-2026-10-28-atlas/aloop-site` as its working directory. Do not move the project root without updating this workflow and the Cloudflare build configuration.

Always use the Actions result for the exact commit under review. Historical test counts in older reports are evidence for those commits only, not a guarantee for current code.

## 9. Deployment contract

The repository describes the production target as Cloudflare Workers static assets, not Cloudflare Pages.

| Setting | Current repository value |
|---|---|
| Worker name | `aloop` |
| Static assets | `./dist` |
| Wrangler config | `wrangler.jsonc` |
| Production branch | `master` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Wrangler | `4.80.0` |

The README and dated QA report record successful `master` deployments and failed non-production branch preview builds on 2026-10-30. This is a historical observation. Confirm the current status and inspect Cloudflare dashboard build logs before relying on branch previews.

The Wrangler configuration currently uses `not_found_handling: "single-page-application"`. This may return `index.html` for missing static-asset requests and obscure 404s. Changing it affects deployment routing and must be handled as a separate reviewed change.

Cloudflare dashboard settings and secrets cannot be fully verified from repository files. Do not claim they are configured unless checked in the dashboard.

## 10. Change and release rules

1. Create a short-lived task branch from the latest `master`.
2. Keep each branch focused on one feature, fix, or documentation task.
3. Review the diff before committing; exclude secrets, generated output, caches, and unrelated changes.
4. Run the relevant tests and a production build locally.
5. Open a pull request targeting `master`.
6. Require CI checks and code review before merging.
7. Use a preview deployment only after its current health has been confirmed.
8. Delete the short-lived branch after merge.
9. Prefer `git revert` to undo changes already merged into shared `master`; do not rewrite shared history with force-push.
10. Treat database migrations and external data writes separately from source-code rollback.

## 11. Known risks requiring follow-up

- Real-device GPU and mobile touch verification remains necessary beyond headless browser tests.
- CDN failure behaviour for Three.js requires device/network testing.
- Cloudflare branch-preview build health must be rechecked in the dashboard.
- The SPA not-found fallback may mask missing static resources.
- Real Supabase Auth flows (email delivery, verification links, password reset) and RLS permissions still require verification against an actual project.
- EasySci records require item-level verification of URLs, pricing, licences, permissions, and current maintenance status.
