# Frontend Development Workflow

## Scope

This migration covers the frontend only. Backend changes are out of scope.

## Branching and review

1. Create a dedicated branch for each feature, fix, test migration, or maintenance task.
2. Use `feat/<topic>`, `fix/<topic>`, `test/<topic>`, and `chore/<topic>` prefixes.
3. Do not commit directly to `master`.
4. Keep the Vue/Vite migration and test migration in separate branches and pull requests.
5. Run Vitest and the Vite production build before review. Merge only after review and CI pass.

## Local verification

From `Aloop-iteration-2026-10-28-atlas/aloop-site` run:

```bash
npm install
npm test
npm run build
```

## Migration status and limitation

Vue/Vite currently provides the application entry and build layer. Existing H5 features are preserved in `legacy.html` inside an iframe for compatibility; they have not all been converted into Vue components. Before treating the migration as complete, test navigation, localization, EasySci, Smart Brain/WebGL, and experiment execution in a real browser.
