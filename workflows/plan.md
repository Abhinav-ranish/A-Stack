# Plan Workflow

Use for PRDs, specs, architecture, roadmaps, phase planning, or turning rough ideas into executable work.

## Required Output

- Project goal and target user.
- In-scope and out-of-scope work.
- Requirements with acceptance criteria.
- Phase roadmap with dependencies.
- Verification plan per phase.
- Security, SEO, UI, and QA gates when applicable.

## Method

1. Read current repo and memory before asking questions.
2. Ask only questions that materially change the plan.
3. Prefer conservative web-app defaults:
   - Next.js or existing framework
   - Server-side auth checks
   - environment variables for secrets
   - browser QA for user flows
   - SEO audit for public pages
4. Run the slop negator:
   - remove vague tasks
   - split overloaded phases
   - assign file ownership for parallel work
   - add verification commands
   - add security and UX review gates

## Completion

Planning is complete only when another agent can execute without making product or architecture decisions.
