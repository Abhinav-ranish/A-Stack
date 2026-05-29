# New App Workflow

Use when the user wants a new web app, SaaS, dashboard, landing page, AI app, or authenticated CRUD app.

## Flow

1. **Grounding**
   - Read `knowledge/preferences/*.md`, `knowledge/stacks/*.md`, and `knowledge/skills/catalog.md`.
   - Search the current repo for existing app files before asking questions.

2. **Superpowers-style intake**
   - Ask only high-impact questions: target user, core job, must-have flows, auth/data/payment needs, launch constraints.
   - If the user already provided enough context, proceed in `full-yolo` mode.

3. **GSD artifacts**
   - Create or update planning artifacts in `.planning/`:
     - `PROJECT.md`
     - `REQUIREMENTS.md`
     - `ROADMAP.md`
     - `STATE.md`
   - Roadmap phases must be small enough for isolated execution.

4. **Slop negator**
   - Before coding, check the plan for vague acceptance criteria, unnecessary scope, generic UI, missing tests, missing security controls, and unowned files.
   - Fix the plan until each phase has concrete deliverables and verification.

5. **Next action**
   - If the user asked to build now, continue to `workflows/execute.md`.
   - Otherwise stop with the plan and next phase.

## Hard Gates

- Do not proceed if the app requires paid credentials or production secrets that are missing.
- Do not skip security, QA, or verification for public/authenticated apps.
