# Frontend Development Workflow

## Scope

This migration covers the frontend only. Backend changes are out of scope.

## Branching and review

1. Create a dedicated branch for each feature, fix, test, or maintenance task, using `feat/<topic>`, `fix/<topic>`, `test/<topic>`, or `chore/<topic>`.
2. Do not commit directly to `master`.
3. When several pull requests form a dependency stack, keep their dependencies explicit during development. Before final review, create one integration branch that contains the complete intended tree and open a single PR to `master`.
4. After verifying the consolidated diff, close superseded PRs with a reference to the integration PR. Retain their source branches until the final PR is merged and verified.
5. Merge only after required CI checks pass and remaining manual QA is recorded.

## Local verification

From `Aloop-iteration-2026-10-28-atlas/aloop-site` run:

```bash
npm install
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

On Linux CI runners, install operating-system dependencies with `npx playwright install --with-deps chromium`.

## Migration status and architecture

Vue 3 + Vite owns the application entry, primary navigation, language controls, and top-level hash state. It embeds the existing H5 runtime via `legacy.html?embed=1`; the legacy topbar is hidden in embedded mode to avoid duplicate navigation. The About page remains a separate static HTML document.

EasySci, Smart Brain/WebGL, experiment runtimes, and most content controllers remain legacy implementations. Do not describe this as a full Vue rewrite. Migrate one feature at a time behind stable interfaces, add regression tests before replacing its legacy implementation, and remove legacy code only after equivalent behavior is verified.

In Vite development mode, legacy HTML documents and `assets/` / `experiments/` resources must be served without Vite module transforms so the old H5 scripts can use their browser import map and relative resource paths. The production build separately copies the legacy runtime files into `dist`.

CI covers Vitest static/unit regressions, the Vite production build, and Chromium browser checks for the About page, local beLieve authentication flow, deep links, and browser back navigation. Manual QA is still required for real-device responsive layout, WebGL/GPU rendering, external CDN/model failure recovery, and broader product behavior.
