# Aloop

Aloop is a bilingual online research and experimentation platform. It brings together browser-based research experiments, a curated research-tool directory, and interactive educational experiences.

> **Project status: prototype.** Authentication is now implemented with Supabase Auth (shell SDK plus a standalone REST fallback), but the repository still does not provide server-side participant-data collection, research randomisation, or reliable server-side backups. The beLieve experiment stores session data in the participant's browser. Do not use the current build for formal recruitment or confirmatory data collection until the required ethics, consent, protocol, security, data-management, and server-side controls have been reviewed and implemented.

## Products

- **Experiments** — browser-based research experiences, including beLieve.
- **EasySci** — a bilingual directory of research, data-analysis, experiment, design, asset, creative, and coding resources. The current catalogue contains 432 records. Catalogue inclusion is not an endorsement or a guarantee of current pricing, availability, licensing, security, or scientific suitability; records require item-level verification.
- **Smart Brain** — an educational product with a Learn module and an interactive anatomical atlas.
- **About** — product, source, and licence information.

## Application architecture

The application uses a Vue 3 + Vite shell around an existing modular JavaScript runtime.

- `index.html` is the **only production HTML entry point**. It mounts the Vue application from `src/main.js`.
- `src/App.vue` owns the visible application shell: top navigation, language preference, top-level hash routing, and the embedded runtime lifecycle.
- `legacy.html` hosts the existing H5 runtime in an iframe. Feature modules remain primarily in classic JavaScript under `assets/js/` and `experiments/`; they have not all been rewritten as Vue components.
- `说明.html` is the bilingual About/licensing document, embedded for the `#/about` route.
- `standalone.html` is a historical comparison snapshot. Vite serves it in development with a no-index response header, but it is excluded from the production build and is not a production entry point.

The Vite configuration deliberately serves the legacy runtime without HTML transforms, copies the required legacy assets into `dist/`, checks required production artefacts, and rejects a generated `dist/standalone.html`.

## Repository layout

The website project is located at `Aloop-iteration-2026-10-28-atlas/aloop-site/`.

| Path | Responsibility |
|---|---|
| `index.html`, `src/` | Vue application entry and shell (`src/lib/` holds the Supabase client, auth service, and profile data layer) |
| `legacy.html` | Embedded classic-JavaScript runtime |
| `assets/css/`, `assets/js/`, `assets/i18n/` | Styles, feature modules, and localisation |
| `assets/js/core/config.js` | Public runtime configuration for the standalone REST auth client (project URL + publishable key) |
| `supabase/migrations/` | Database schema for profiles, experiment sessions, and row-level security |
| `assets/models/atlas/` | Self-hosted anatomical model, manifest, Draco decoder, and attribution |
| `experiments/believe/` | beLieve experiment runtime and styles |
| `tests/`, `src/App.test.js` | Unit, contract, asset, regression, and end-to-end tests |
| `docs/` | Architecture, migration, QA, progress, and catalogue documentation |
| `vite.config.js` | Development compatibility layer and production-output contract |
| `wrangler.jsonc` | Cloudflare Workers static-asset configuration |
| `.github/workflows/frontend-ci.yml` | GitHub Actions frontend CI |

For the documentation map and the status of each document, see [Documentation Index](docs/README.md).

## Requirements

- Node.js **20.3 or later** (required by the pinned Wrangler CLI).
- npm.
- Chromium installed by Playwright for end-to-end tests.

## Local development

Run commands from the website project directory:

```bash
cd Aloop-iteration-2026-10-28-atlas/aloop-site
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Do not open `index.html` directly from the filesystem; the application expects to be served over HTTP.

## Validation

The available npm scripts are defined in `package.json`:

| Command | Purpose |
|---|---|
| `npm test` | Run the Vitest unit and regression suite |
| `npm run test:e2e` | Run the Playwright Chromium end-to-end suite |
| `npm run build` | Create and validate the production build |
| `npm run preview` | Serve the generated `dist/` build locally |

Typical pre-merge validation:

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run preview -- --host 127.0.0.1 --port 4175
```

The GitHub Actions workflow currently runs `npm install`, `npm test`, `npm run build`, installs Chromium, and runs `npm run test:e2e` on configured branch pushes and pull requests. The exact latest results should be checked in the GitHub Actions run for the commit under review; historical results in QA documents are not proof that a newer commit passes.

The build checks for required runtime files and fails if a required artefact is missing. It also rejects `standalone.html` in the production output.

## Deployment

The repository configuration identifies the production deployment as **Cloudflare Workers static assets**, not a Cloudflare Pages project.

- Worker name: `aloop`
- Static asset directory: `dist/`
- Wrangler configuration: `wrangler.jsonc`
- Production branch: `master`
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Pinned Wrangler version: `4.80.0`

The repository's deployment notes record successful production builds from `master` and failed branch-preview builds on 2026-10-30. Treat branch previews as unavailable until a new successful preview build is confirmed in the Cloudflare dashboard. Before merging, use the GitHub Actions checks and a local production preview, then inspect the actual production deployment after a release.

Cloudflare dashboard settings (root directory, build settings, secrets, and environment bindings) must be checked in the dashboard; they cannot be inferred completely from the repository alone.

## Authentication and data boundaries

- Authentication uses Supabase Auth in two **exclusive** modes:
  - **Shell mode** (the normal website): `src/lib/auth.js` owns the session through `@supabase/supabase-js` and publishes it as `window.__ALOOP_AUTH__`. The embedded runtime only delegates.
  - **Standalone mode** (`standalone.html`, a directly opened `legacy.html`, or an embedded page built without `VITE_SUPABASE_*`): `assets/js/core/auth.js` calls the GoTrue REST API using the public values in `assets/js/core/config.js`.
- Both modes support sign-up, sign-in, sign-out, token refresh, email verification, resend, and password reset. No debug account exists in the shipped sources.
- Required build-time variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (publishable/anon key only). Set them locally in `.env.local` or in the Cloudflare build environment; never commit them.
- Shell sessions are stored under `aloop_supabase_auth`; standalone sessions under `aloop_session_v2`. Entering shell mode discards any leftover standalone session so only one mode is ever active.
- Database schema and row-level security live in `supabase/migrations/`; applying them to a project is a separate, reviewed step. See [Supabase integration](docs/SUPABASE_INTEGRATION.md) and [Email auth setup](docs/EMAIL_AUTH_SETUP.md).
- beLieve session data is stored in browser-local storage and can be lost when the user clears site data or changes browser/device.
- The `?qa=1&arm=A|B|C` condition selector is for development QA only. It is client-controlled and is not research-grade randomisation.
- Never commit `.env` files, service-role keys, database credentials, access tokens, or other secrets. Public client configuration must use the appropriate publishable key and server-side access must be protected independently.

## 3D assets and third-party licensing

The homepage particle cortex and Smart Brain atlas use the self-hosted model assets under `assets/models/atlas/`. The anatomy asset and viewer source have separate licensing terms. Preserve the attribution and licence notices in `assets/models/atlas/ATTRIBUTION.md` and the About page. Do not assume that the model licence also covers the viewer code, or vice versa.

Three.js is loaded through the import map at the pinned version documented in the technical requirements. The model and Draco decoder are self-hosted, but the application is not a fully offline bundle because the Three.js module is still loaded from a CDN.

## Known limitations

1. Server-side experiment data collection, research randomisation, and backup/retention controls are not implemented; participant data still lives in the browser unless a separately reviewed backend is added. Authentication itself is implemented, but real-project verification (email delivery, RLS) is still pending credentials.
2. The EasySci catalogue is curated but not fully verified item by item. Confirm official URLs, pricing, access tiers, licences, maintenance, and security before relying on an entry.
3. Cloudflare branch-preview builds were reported as failing on 2026-10-30. Check current dashboard logs and do not assume preview deployments are working.
4. Real-device GPU performance, mobile touch behaviour, and CDN-failure recovery require device-level verification beyond automated tests.
5. The current Wrangler configuration uses a single-page-app not-found fallback. This can make missing static-asset requests return the application HTML; changing this behaviour requires a separately reviewed deployment change.

## Contributing

Use short-lived branches and pull requests. Do not develop directly on `master`.

1. Update local `master` from `origin/master`.
2. Create a task-specific branch such as `feat/<task>`, `fix/<task>`, or `docs/<task>`.
3. Make a focused change and review the diff.
4. Run the relevant tests and production build locally.
5. Push the branch and open a pull request targeting `master`.
6. Wait for required CI checks; review a preview deployment if one is available.
7. Merge only after the code review and validation criteria pass.
8. Delete the short-lived branch after the pull request is merged.

For the full recovery, rollback, branch-management, and release procedure, see [Engineering Recovery and Git Governance](docs/operations/ENGINEERING_RECOVERY_AND_GIT_GOVERNANCE.md).

## Documentation

Start with [docs/README.md](docs/README.md). It identifies the current source-of-truth documents, historical reports, and known documentation conflicts.
