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

## Migration status and architecture

Phase 1 adds Vue 3 and Vite as the application entry/build layer. Phase 2 moves the primary navigation, experiment discovery, language controls, and top-level hash state into the Vue shell. The shell synchronizes its route with the legacy hash router and embeds the existing H5 runtime using `legacy.html?embed=1`; the legacy topbar is hidden only in embedded mode to avoid duplicate navigation.

EasySci, Smart Brain/WebGL, experiment runtimes, and most content controllers remain legacy implementations. Do not describe this as a full Vue rewrite. Migrate one feature at a time behind stable interfaces, add regression tests before replacing its legacy implementation, and remove legacy code only after equivalent behavior is verified.

Before merging, validate direct URL entry, browser back/forward, the beLieve experiment route, language switching, the About page, EasySci, Smart Brain/WebGL, and experiment execution in a real browser. CI covers unit/static regression checks and production build but does not validate GPU rendering or the full cross-frame browser interaction.
