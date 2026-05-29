# Migrate Workflow

Use when the user wants to import A-Stack into an existing repo, says `/migrate`, or when A-Stack detects that `.planning/`, `.a-stack/config.json`, or A-Stack guidance files are missing.

## Intent

Make an existing codebase legible to A-Stack as if the stack had been present from the beginning, without rewriting product code or overwriting user-owned docs.

## Trigger Rules

- If the user explicitly says `/migrate`, run migration for the current repo.
- If a repo has code but lacks `.planning/STATE.md` or `.a-stack/config.json`, tell the user A-Stack is not initialized and ask whether to run `/migrate`.
- If the user asks to build, ship, debug, secure, or review an existing repo and A-Stack files are missing, migrate first unless the user declines.

## Migration Contract

Migration creates or refreshes stack metadata only:

- `.a-stack/config.json`
- `.planning/MIGRATION.md`
- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/TASKS.json`
- `.planning/A-STACK-EVENTS.json`
- guarded A-Stack section in `CLAUDE.md`

Do not overwrite existing planning or Claude guidance unless the user passes a force/refresh instruction. When existing files are present, preserve them and write findings into `MIGRATION.md`.

## Analysis Pass

1. Detect framework, package manager, scripts, test/build/lint commands, app directories, routes, data/auth files, deployment config, and security-relevant files.
2. Infer product shape from README, package metadata, routes, app names, and existing docs.
3. Map existing code to A-Stack phases:
   - Phase 0: Migration and orientation
   - Phase 1: Stabilize known scripts and baseline gates
   - Phase 2: Product/codebase hardening
   - Phase 3: Security, QA, SEO, ship readiness
4. Seed tasks for missing gates, broken setup, missing tests, missing security review, browser QA, and docs gaps.
5. Record a `stack-migrated` event for dashboard visibility.

## Acceptance

- `node scripts/a-stack.mjs migrate --target <repo>` produces migration artifacts.
- Dashboard shows the repo as initialized.
- Router maps future natural-language requests to normal A-Stack workflows.
- Agents can resume from `.planning/STATE.md` and understand the existing repo without asking what stack/files exist.
