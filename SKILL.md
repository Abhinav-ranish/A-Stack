---
name: a-stack
description: Natural-language autonomous web-app stack router for Claude Code. Use when the user wants to build, plan, execute, review, QA, secure, SEO-audit, ship, or remember preferences for web apps without needing slash commands. Routes to GSD-style planning, Superpowers-style spec creation, Ruflo-inspired memory/security/parallel execution, GStack-style QA/release/design taste, AI Council, CyberReview, and find-skills fallback.
---

# A-Stack

A-Stack is a Claude Code-first autonomous stack for web-app work. It routes plain language into the right workflow without requiring the user to remember slash commands.

## Default Posture

- Default mode is `full-yolo`: keep moving without asking unless a hard gate trips.
- Hard gates: irreversible/destructive action, missing credentials, failed verification, unresolved critical security issue.
- Markdown memory is source of truth. The token-bag index at `knowledge/.a-stack-index.json` is a derived lexical index, not a vector store — rebuild it whenever memory changes.
- Optimize for web apps: SaaS, dashboards, landing pages, AI apps, authenticated CRUD, SEO pages.

## Routing

For any user request, classify intent before acting:

```bash
node scripts/a-stack.mjs route "<user request>"
```

Then load the matching workflow in `workflows/`:

| Intent | Workflow |
|---|---|
| `new-app` | `workflows/new-app.md` |
| `migrate` | `workflows/migrate.md` |
| `plan` | `workflows/plan.md` |
| `execute` | `workflows/execute.md` |
| `security-review` | `workflows/security-review.md` |
| `ui-review` | `workflows/ui-review.md` |
| `qa-browser` | `workflows/qa-browser.md` |
| `seo-audit` | `workflows/seo-audit.md` |
| `ship` | `workflows/ship.md` |
| `debug` | `workflows/debug.md` |
| `memory-recall` | `workflows/memory.md` |
| `self-learning` | `workflows/self-learning.md` |
| `find-skill` | `workflows/find-skill.md` |

If confidence is low, use `find-skill` only after checking local workflows.

For work spanning 3+ files or multiple roles, load `workflows/orchestration.md`
to run the executor/security/qa/ui/release subagents as a SendMessage-first
pipeline, fan-out, or supervisor team via the `Agent` tool.

## Required Gates For Build Work

Every app build must pass:

1. Plan quality / slop negator
2. Parallel execution ownership check
3. Test or verification command
4. CyberReview security audit
5. Browser QA for UI apps
6. SEO audit for public pages
7. Ship readiness summary

Run the local gate orchestrator before ship:

```bash
node scripts/a-stack.mjs gates --target <repo> --ui --public
```

## Existing Repos

When the user is working in a repo that already has code, check for `.planning/STATE.md` and `.a-stack/config.json`.
If either is missing, ask whether to run `/migrate` before planning, building, securing, QA-ing, or shipping.

Run migration with:

```bash
node scripts/a-stack.mjs migrate --target <repo>
```

Migration inspects the codebase, creates A-Stack planning/state artifacts, seeds task and event state for the dashboard, and appends a guarded A-Stack section to `CLAUDE.md` without overwriting user-owned guidance.

## Dashboard And Tasks

Use the dashboard when the user wants visibility into project stage, gates, costs, memory, graph connections, or queued work:

```bash
node scripts/a-stack.mjs dashboard --target <repo> --port 4317
```

Tasks added in the UI or CLI are written to `.planning/TASKS.json`:

```bash
node scripts/a-stack.mjs task add --target <repo> --title "Fix auth callback" --agent claude-code --priority high
node scripts/a-stack.mjs task next --target <repo>
```

Record stack impact metrics as events:

```bash
node scripts/a-stack.mjs event --target <repo> --type vulnerability-patched --title "Fixed missing role check"
node scripts/a-stack.mjs event --target <repo> --type slop-removed --title "Removed generic hero cards"
node scripts/a-stack.mjs event --target <repo> --type token-usage --tokens-in 12000 --tokens-out 4000 --cost-usd 0.12
```

## Memory

Before planning, read relevant files under `knowledge/`:

- `knowledge/stacks/`
- `knowledge/skills/`
- `knowledge/preferences/`
- `knowledge/projects/`
- `knowledge/sessions/`

After meaningful decisions, append to markdown memory and rebuild the derived index:

```bash
node scripts/memory-index.mjs index
```

Do not treat the index as canonical. The `UserPromptSubmit` hook auto-surfaces
the top token-bag hits for each prompt, so relevant memory appears without an
explicit recall call.

## Session Persistence

Leave breadcrumbs so context survives `/compact` and resumes. Save is **manual
by default** — there is no reliable "session about to stop" signal, so capture
state at meaningful points yourself:

```bash
node scripts/a-stack.mjs save-session --title "auth refactor" \
  --next "wire the callback" --decisions "server-side sessions" --notes "..."
node scripts/a-stack.mjs save-session list           # this branch
node scripts/a-stack.mjs save-session list --all      # every branch
```

Each save writes an append-only, branch-aware checkpoint under the project's
`.planning/sessions/checkpoints/` (frontmatter + Decisions / Remaining / Notes)
and updates `.planning/SESSION.md`. Checkpoints are project-local — they live in
the target repo, not the A-Stack install. The `PreCompact` hook snapshots that
pointer before compaction; `SessionStart` re-injects it plus open
`.planning/TASKS.json` items and recent operational learnings on the next turn.

## Operational Learnings

Record durable, project-level gotchas (distinct from routing patterns). They are
auto-surfaced at `SessionStart`:

```bash
node scripts/a-stack.mjs learn add --insight "migration step needs NODE_OPTIONS=--max-old-space-size=4096" --key migration-mem --tags "build migration"
node scripts/a-stack.mjs learn search "migration build"
```

Only log insights that save 5+ minutes next time. Skip obvious facts and one-time
transient errors.

## Continuous Checkpoint Mode (opt-in)

Default is `explicit` (commit only when asked). Opt in to commit completed logical
units automatically — the honest "auto-save" that fires at deterministic
boundaries, not a guessed session end:

```bash
node scripts/a-stack.mjs checkpoint mode continuous --target <repo>
node scripts/a-stack.mjs checkpoint commit --target <repo> \
  --message "add invoice list" --decisions "..." --remaining "..." --files "src/invoices.tsx"
```

Commits use a `WIP:` prefix + embedded `[a-stack-context]` block. Stage only
intentional files — **never `git add -A`**, never commit broken state. `/ship`
squashes WIP commits into clean ones.

## Agent Protocols

- **Completion status.** End substantive work with one of: `DONE` (with evidence),
  `DONE_WITH_CONCERNS` (list them), `BLOCKED` (state blocker + what was tried),
  `NEEDS_CONTEXT` (state exactly what is missing). Escalate after 3 failed attempts.
- **Confusion protocol.** For high-stakes ambiguity (architecture, data model,
  destructive scope, missing context), STOP. Name it in one sentence, give 2-3
  options with tradeoffs, ask. Not for routine or obvious changes.
- **Voice.** Follow `knowledge/preferences/voice.md`: lead with the point, be
  concrete (files/lines/numbers), no AI-slop vocabulary.

## Self-Learning

Use `workflows/self-learning.md` when recording outcomes, extracting reusable patterns, or optimizing routing/stack choices from prior work.

```bash
node scripts/learning.mjs record --task "..." --domain frontend --outcome success --quality 0.9 --pattern "..."
node scripts/learning.mjs recommend "auth dashboard frontend"
node scripts/learning.mjs optimize
```
