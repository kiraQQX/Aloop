# Aloop Documentation

This directory is the documentation entry point for the Aloop website project.

## Documentation policy

- **Code and configuration are authoritative.** Documentation describes the repository state and must be updated when implementation changes.
- **The root `README.md` is the project overview.** It should remain concise and focus on purpose, architecture, setup, validation, deployment, limitations, and contribution workflow.
- **Current architecture requirements belong in `docs/TECHNICAL_REQUIREMENTS.md`.**
- **Dated reports are evidence snapshots.** Their test results and deployment observations apply only to the commits and environments named in each report.
- **Historical specifications and implementation reports are retained for traceability.** They must not be treated as proof of current implementation when they conflict with source code or newer reports.
- Do not create another overlapping project overview or another competing architecture specification.

## Current reference documents

| Document | Purpose | Authority / status |
|---|---|---|
| [Technical Requirements](TECHNICAL_REQUIREMENTS.md) | Current application architecture, routes, localisation, build contract, tests, and deployment configuration | Current architecture reference; reconcile with code |
| [Release QA Report](RELEASE_QA_REPORT.md) | Dated test results, browser checks, deployment observations, and known risks | Historical QA evidence; check Actions and Cloudflare for current status |
| [Engineering Progress](ENGINEERING_PROGRESS.md) | Chronological record of migration, fixes, tests, commits, and open work | Historical engineering log; append new entries, do not rewrite old evidence |
| [Feature Migration Matrix](FEATURE_MIGRATION_MATRIX.md) | Maps features to implementation files and verification methods | Maintainer reference; update when modules move or change |
| [Migration Audit](MIGRATION_AUDIT.md) | Comparison of the historical standalone snapshot and modular Vue/Vite implementation | Historical audit based on the commit stated in the report |
| [EasySci Catalogue Research](EASYSCI_CATALOGUE_RESEARCH.md) | Catalogue taxonomy, curation rationale, source references, and verification policy | Catalogue research reference; verify time-sensitive claims before use |

## Project-level documents

| Document | Purpose | Status |
|---|---|---|
| [Design System](../design.md) | Visual identity, colour tokens, accessibility, typography, and motion principles | Current design reference; verify tokens against CSS |
| [Technical Specifications](../TECHNICAL_SPECIFICATIONS.md) | Product and interaction requirements for Smart Brain, Learn, homepage visualisation, and earlier design revisions | Historical/product specification; not the current build contract |
| [Implementation Report](../IMPLEMENTATION_REPORT.md) | Implementation history and catalogue evolution | Historical implementation record; read the dated status section before relying on details |

## Engineering operations

| Document | Purpose |
|---|---|
| [Engineering Recovery and Git Governance](operations/ENGINEERING_RECOVERY_AND_GIT_GOVERNANCE.md) | Recovery procedure, branch strategy, CI/preview validation, release gates, rollback, and repository-cleanup workflow |

## Recommended reading order

1. Start with the root [README](../README.md).
2. Read [Technical Requirements](TECHNICAL_REQUIREMENTS.md) before changing entry points, routes, iframe behaviour, assets, build output, or deployment.
3. Read the [Feature Migration Matrix](FEATURE_MIGRATION_MATRIX.md) before moving or replacing a feature module.
4. Check the [Release QA Report](RELEASE_QA_REPORT.md) and current GitHub Actions run before a release.
5. Use the [Engineering Progress](ENGINEERING_PROGRESS.md) and migration audit to understand why historical implementation decisions were made.

## Document maintenance

When changing application behaviour:

- Update the current technical requirements if an architectural contract changes.
- Update the feature matrix if a feature's implementation or test location changes.
- Add dated, commit-specific evidence to the QA report or engineering progress log.
- Update the root README only when project-level facts, commands, architecture, deployment, or known limitations change.
- Keep historical records intact. If a document is superseded, add a clear status note and link to its replacement rather than silently deleting it.
