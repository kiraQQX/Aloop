# Engineering Recovery and Git Governance

**Project:** Aloop  
**Repository:** `kiraQQX/Aloop`  
**Website project path:** `Aloop-iteration-2026-10-28-atlas/aloop-site/`  
**Target long-lived branch:** `master`  
**Document status:** Execution plan and ongoing operating procedure  
**Last reconciled with repository:** 2026-11-02

---

## 1. Purpose

This document defines a controlled process for recovering the pre-incident implementation, reconciling the updated code snapshot with the website project, validating the result, consolidating long-lived development around `master`, and cleaning up the local project layout.

It also defines the normal development workflow after recovery: work on short-lived branches, validate changes before merge, and use safe rollback procedures.

This is an execution plan, not evidence that any recovery, merge, branch deletion, or local filesystem migration has already occurred.

## 2. Known project state

### 2.1 Repository layout

The GitHub repository's current default branch is `master`. The website project is nested at:

`Aloop-iteration-2026-10-28-atlas/aloop-site/`

Do not assume the website project is at the repository root. Any future project-root migration must update the GitHub Actions working directory and Cloudflare build settings.

### 2.2 Pre-incident work reported by the project owner

The following work was reported as completed before the local file incident:

- Supabase authentication bridge and standalone runtime REST integration;
- 3D model viewer;
- Glass Dropdown;
- Guardrails and Auth tests;
- related engineering documentation.

The reported pre-incident validation was:

- `npm test`: 81/81;
- Playwright: 10/10;
- `npm run build`: successful.

A commit `cb381cf` was created locally and the local `master` was fast-forwarded to it. The commit was **never pushed to GitHub**. Its current recoverability must be checked; do not assume it exists in the current local repository or remote.

The current GitHub `master` code is a separate source of truth from the reported unpushed local state. In the repository revision inspected on 2026-11-02, `src/lib/supabase.js` exists and the Supabase SDK is declared, but the client module is not imported by the application entry points. Therefore, the remote repository revision must not be described as having integrated Supabase authentication.

### 2.3 Known current implementation facts

- The default branch is `master`.
- The website project is under `Aloop-iteration-2026-10-28-atlas/aloop-site/`.
- `index.html` is the only production Vite entry.
- Vue 3 + Vite provides the shell; `legacy.html` hosts the existing classic-JavaScript runtime.
- `standalone.html` is a development-only comparison artefact and must not enter `dist/`.
- GitHub Actions runs unit tests, build, and Playwright E2E tests from the nested website directory.
- Cloudflare is configured in the repository as Workers static assets using `wrangler.jsonc`, not as a Pages project.
- Historical deployment records show successful `master` builds and failed branch-preview builds on 2026-10-30. Recheck the dashboard before relying on previews.

## 3. Target outcomes

The recovery and governance work is complete only when:

1. The actual local repository roots and project paths are identified.
2. The updated snapshot and target website project have been compared file by file.
3. Recoverable pre-incident work, including `cb381cf`, has been verified and restored where appropriate.
4. All required functionality has been integrated without overwriting valid existing work.
5. Unit tests, E2E tests, and production build pass on the recovered code.
6. The complete result is committed and pushed to GitHub `master` without overwriting remote history.
7. All useful commits from obsolete branches have been integrated or explicitly preserved before branch deletion.
8. `master` is the only long-lived development/release branch; task branches remain short-lived.
9. The local filesystem contains one clearly identified working project, with a separate recovery backup.
10. Repository documentation accurately reflects the actual code and deployment configuration.

## 4. Mandatory execution phases

| Phase | Work | Required output |
|---|---|---|
| 0 | Inventory local files, repositories, branches, commits, remotes, tests, and deployment configuration | `ENGINEERING_AUDIT.md` |
| 1 | Compare the updated snapshot with the target website project | `CODE_REVIEW_REPORT.md` |
| 2 | Create backups and verify recoverable Git objects and refs | `RECOVERY_PLAN.md` |
| 3 | Integrate reviewed code and resolve conflicts | `MERGE_PLAN.md` |
| 4 | Run regression tests, E2E tests, production build, and functional checks | `TEST_REPORT.md` |
| 5 | Publish the validated result to `master`; audit and then clean obsolete branches | `BRANCH_CLEANUP.md` |
| 6 | Restructure local directories and verify all paths | `PROJECT_STRUCTURE.md` |
| 7 | Perform final local/remote consistency checks and document the result | `ENGINEERING_CHANGELOG.md` |

### Phase 0 — Inventory (read-only)

Inspect `D:\Aloop` and all candidate project directories. Locate every `.git`, `package.json`, lockfile, Vite config, test config, environment file, build output, and snapshot.

For each candidate Git repository, run:

```bash
git rev-parse --show-toplevel
git status --short --branch
git branch -avv
git log --oneline --graph --decorate --all -50
git remote -v
git tag -l
git reflog --all
```

Check the reported commit:

```bash
git cat-file -t cb381cf
git show --stat --oneline cb381cf
git show --no-patch --pretty=raw cb381cf
```

Do not modify, move, overwrite, or delete source files or branches during the first inventory pass.

### Phase 1 — Source review

Compare the updated snapshot with the target website project. Classify every relevant path as:

- added;
- modified;
- removed;
- conflicting;
- generated/temporary;
- not required for migration.

Review at least:

- Vue shell, HTML entry points, hash routing, and iframe behaviour;
- Supabase initialisation, auth bridge, REST access, and environment variables;
- 3D viewer, model assets, Draco decoder, and attribution;
- Glass Dropdown and other shared UI components;
- EasySci, Smart Brain, and beLieve modules;
- Vitest, Playwright, Guardrails, and Auth tests;
- package manifest, lockfile, Vite config, Wrangler config, and GitHub Actions;
- README and technical documentation.

Do not use file timestamps or filenames alone to choose the winning implementation. Review dependencies and runtime behaviour.

### Phase 2 — Recovery points

Before any overwrite or migration:

- back up all valuable source files and configuration;
- preserve the updated snapshot unchanged;
- preserve Git metadata or verify that the repository object database is recoverable;
- record local and remote `master` SHAs;
- record branch and tag references;
- back up local environment files securely without placing secrets in reports or Git.

Keep recovery material outside the production repository, for example:

```text
D:\Aloop-recovery\
├── source-snapshot\
├── git-metadata\
├── audit-reports\
└── recovery-manifest.md
```

If `cb381cf` exists, inspect its parents and tree, verify its contents, and create a recovery tag or backup ref. If it does not exist, inspect reflogs, other local repositories, branches, and dangling objects. If code is reconstructed from a snapshot, document it as a reconstruction; never claim that the original commit was recovered.

### Phase 3 — Integration

Use the reviewed website project as the final application workspace. Integrate only the valid changes from the updated snapshot and restore the reported pre-incident functionality where the source and implementation can be verified.

Do not replace the entire project directory. Resolve conflicts file by file and record the decision, reason, and affected tests.

Review `.env`, `.env.local`, and Cloudflare variables. Never commit Supabase service-role keys, secret keys, database credentials, access tokens, or local environment files. Keep production secrets in the deployment platform.

### Phase 4 — Quality gates

Read `package.json` before choosing commands. The current repository scripts include:

```bash
npm install
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run preview -- --host 127.0.0.1 --port 4175
```

Run the checks against the integrated code. Verify:

- dependency installation;
- all Vitest tests;
- all Playwright tests;
- production build and required output files;
- Supabase/auth/REST only if the relevant integration is actually present in the recovered code;
- 3D viewer and model asset loading;
- Glass Dropdown interactions;
- Cloudflare build configuration and relative asset paths;
- absence of committed secrets.

The pre-incident results (81/81, 10/10, build successful) are historical baselines, not current pass results. If test counts differ, explain why. Do not remove tests or weaken assertions merely to obtain a green result.

Any unresolved critical failure blocks publication to `master`.

### Phase 5 — Main-branch consolidation

Use `master` as the only long-lived branch. Use temporary task branches for isolated work.

Before publishing:

```bash
git fetch --all --prune
git status --short --branch
git branch -avv
git log --oneline --graph --decorate --all -50
```

For each branch, inspect commits and file changes not present in `master`:

```bash
git log master..branch-name --oneline
git diff master...branch-name --stat
git merge-base master branch-name
```

Do not assume that a branch is safe to delete merely because it appears merged. Verify that its useful changes are represented in `master`, including changes transferred by cherry-pick or manual integration.

Publish in this order:

1. validate the integrated code;
2. commit the final changes on a branch or the agreed integration path;
3. fetch the latest remote refs;
4. verify that the local result can be integrated without rewriting remote history;
5. push using a normal, non-force push;
6. verify the resulting commit and files on GitHub `master`;
7. create a recovery tag for the validated release;
8. only then delete obsolete local and remote task branches.

Never use force-push to overwrite remote history. If push is rejected, fetch and inspect the new remote commits before deciding how to integrate them.

Delete branches individually, only after checking unique commits, uncommitted work, deployment dependencies, and recovery references. Do not use wildcard deletion commands.

### Phase 6 — Local directory restructuring

The proposed target is:

```text
D:\Aloop\
├── aloop-site\                 # single working project and Git repository
├── recovery\                   # backup outside the Git repository
└── project-notes\              # optional governance documents
```

This is a proposed layout, not a verified current path. Determine the actual Git root before moving anything.

After migration, update and verify:

- GitHub Actions `working-directory`;
- Cloudflare Workers Builds root directory and build settings;
- Vite and TypeScript configuration paths;
- asset and model paths;
- README commands and links;
- test and Playwright configuration.

Do not delete the old directory until the new project installs, tests, builds, previews, and deploys successfully. Keep a recoverable backup until final acceptance.

### Phase 7 — Final acceptance

Run:

```bash
git status --short --branch
git branch -avv
git log --oneline --graph --decorate -20
git remote -v
npm test
npm run build
npm run test:e2e
```

Confirm that local and remote `master` point to the same final commit, no useful commits remain stranded on obsolete branches, the working tree is clean, and the new project path works.

## 5. Standard development workflow after recovery

### 5.1 Start from the latest master

```bash
git switch master
git fetch origin
git pull --ff-only origin master
git switch -c feat/short-task-name
```

Use a focused branch name such as `feat/viewer-optimization`, `fix/auth-redirect`, or `docs/readme-refresh`.

### 5.2 Make and validate changes locally

Review the change before staging:

```bash
git status
git diff
npm test
npm run build
npm run test:e2e
```

Run the checks relevant to the changed feature. Do not commit generated output, secrets, caches, or unrelated changes.

Commit a focused change:

```bash
git add path/to/changed/files
git diff --cached
git commit -m "feat: describe the change"
```

### 5.3 Push and open a pull request

```bash
git push -u origin feat/short-task-name
```

Open a pull request with:

- base: `master`;
- compare/head: the task branch;
- a concise summary of the change;
- affected modules and routes;
- tests run and results;
- screenshots or preview URL when useful;
- known risks and rollback instructions.

A successful push only proves that GitHub received the commit. It does not prove that the code works.

### 5.4 Decide whether a change is viable

Use layered evidence:

| Validation layer | Evidence | What it establishes |
|---|---|---|
| Static analysis | Lint/type checks, if configured | Some syntax, type, and code-quality issues |
| Unit tests | `npm test` | Tested local logic and contracts |
| E2E tests | `npm run test:e2e` | Covered user flows in Chromium |
| Production build | `npm run build` | Compatibility with the production bundler and output contract |
| GitHub Actions | Required CI checks for the exact commit | Reproducible checks in the CI environment |
| Preview deployment | Working Cloudflare preview, if available | Behaviour in a deployed environment |
| Manual acceptance | Browser, console, network, mobile, and real-device checks | Visual and runtime issues not covered by automation |

Merge only when the PR diff is correct, required CI checks pass, and relevant manual/preview checks are acceptable. A Cloudflare preview must not be assumed available until a current branch build succeeds. If preview builds are unavailable, use local `npm run build` and `npm run preview`, plus CI and documented manual checks.

## 6. Rollback procedures

Choose the rollback method based on where the change exists.

### A. Local changes not committed

Inspect first:

```bash
git status
git diff
```

Discard a specific unstaged file:

```bash
git restore path/to/file
```

Unstage a file while retaining its working-tree changes:

```bash
git restore --staged path/to/file
```

Discard all unstaged tracked changes:

```bash
git restore .
```

The last command is destructive to uncommitted tracked edits. Back up or commit a checkpoint before using it.

### B. Committed locally but not pushed

To undo the most recent commit while retaining its changes staged:

```bash
git reset --soft HEAD~1
```

To undo the commit and retain changes in the working tree:

```bash
git reset HEAD~1
```

Use `git reset --hard HEAD~1` only when the commit and corresponding working-tree changes are intentionally being discarded and a recovery point exists. It destroys local changes.

### C. Pushed to a feature branch but not merged

Prefer a corrective commit on the same branch, or close the pull request and delete the branch if the work is abandoned. Avoid rewriting a branch that other contributors may have fetched. If the branch is shared, coordinate before any reset or force-push.

### D. Already merged into master

Prefer `git revert`, which creates a new commit that reverses the unwanted change while preserving shared history.

For a normal commit:

```bash
git revert <commit-sha>
git push origin master
```

For a merge commit, identify the correct mainline parent before running:

```bash
git revert -m 1 <merge-commit-sha>
git push origin master
```

For a squash merge, revert the resulting squash commit as a normal commit.

Do not reset or force-push shared `master` to remove a published commit.

### E. Production deployment is broken

1. Identify whether the failure is caused by code, build settings, environment variables, asset paths, database changes, or an external service.
2. If the release commit is the cause, revert it on `master`.
3. Wait for and verify the new production deployment.
4. Check critical routes, authentication boundaries, network requests, and static assets.
5. Fix the root cause on a separate branch and re-merge after validation.

Source-code rollback does not automatically reverse database migrations, external data writes, or third-party state. Those require explicit forward-fix or rollback procedures.

## 7. Release safeguards

Recommended controls:

- GitHub Actions CI on task-branch pushes and pull requests;
- required status checks before merging to `master`;
- protected `master` or repository Rulesets;
- Cloudflare preview deployments, once branch builds are confirmed healthy;
- production deployment restricted to `master`;
- automatic deletion of merged head branches;
- lockfile-based installs and dependency review;
- secret scanning and environment-file exclusions;
- release tags for important stable versions.

Only mark a safeguard as implemented after verifying its actual repository and platform configuration.

## 8. Required governance records

Maintain these records as the recovery work progresses:

| File | Required content |
|---|---|
| `ENGINEERING_AUDIT.md` | Actual directories, repositories, branches, commits, remotes, risks |
| `CODE_REVIEW_REPORT.md` | File/module differences between snapshot and target project |
| `RECOVERY_PLAN.md` | Backups, recovered refs, `cb381cf` status, recovery limitations |
| `MERGE_PLAN.md` | Integration decisions and conflict resolutions |
| `TEST_REPORT.md` | Exact commands, environment, results, failures, and outstanding gaps |
| `BRANCH_CLEANUP.md` | Branch audit, unique commits, retained refs, deletion decisions |
| `PROJECT_STRUCTURE.md` | Final local directory tree and path responsibilities |
| `ENGINEERING_CHANGELOG.md` | Dated actions, modified files, commit SHAs, and phase status |

These files are required outputs of the recovery task. Do not claim they exist or are complete until they have been created and reviewed.

## 9. AI coding-agent execution instruction

Begin with Phase 0 and Phase 1 only. Perform read-only inventory and code review. Do not edit, overwrite, move, or delete source files. Do not delete branches or push code during this first pass.

Deliver `ENGINEERING_AUDIT.md` and `CODE_REVIEW_REPORT.md`, including the verified repository roots, the state of `cb381cf`, local/remote branch relationships, file-level differences, and a proposed recovery/integration plan.

After the review is accepted, proceed through the phases in order. Back up before modifying. Test before publishing. Verify remote `master` before deleting branches. Verify the new local project path before deleting old directories.

Pause and report if a key commit cannot be recovered, a remote branch contains unreviewed unique work, uncommitted user changes exist, a critical test fails, secrets are at risk, or a file/branch cannot safely be classified.

Never force-push over remote history, never batch-delete branches, never remove failing tests to obtain a green result, and never describe an unexecuted check as passed.
