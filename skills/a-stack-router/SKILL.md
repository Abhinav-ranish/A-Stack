---
name: a-stack-router
description: Natural-language router for autonomous web-app development. Use when the user asks to build, plan, implement, debug, secure, review UI, run browser QA, audit SEO, ship, deploy, or recall preferences without naming a slash command. Automatically routes to A-Stack workflows and defaults to full-yolo execution with hard security and verification gates.
---

# A-Stack Router

Use this skill first for web-app work. The user should not need to remember slash commands.

## Route

Run:

```bash
node scripts/router.mjs "<user request>"
```

Then read the returned workflow file.

## Defaults

- Mode: `full-yolo`
- Runtime: Claude Code
- Backbone: GSD-style `.planning/` artifacts
- Memory: markdown first, derived index second
- Parallelism: swarm-lite roles with explicit file ownership

## Hard Stops

Stop only for:

- destructive or irreversible operations
- missing credentials/secrets
- unresolved critical security findings
- failed verification that cannot be repaired
- external skill installation

## Required Build Chain

For new app work, chain these workflows:

1. `workflows/new-app.md`
2. `workflows/plan.md`
3. `workflows/execute.md`
4. `workflows/security-review.md`
5. `workflows/qa-browser.md`
6. `workflows/seo-audit.md` for public pages
7. `workflows/ship.md`

Use `skills/a-stack-ai-council/SKILL.md` for UI uncertainty or high-risk product/design calls.
Use `skills/a-stack-cyber-review/SKILL.md` for security review depth.
Use `workflows/self-learning.md` after successful or failed runs so the stack improves over time.

## Existing Repo Bootstrap

Before acting in an existing repo, check for:

- `.planning/STATE.md`
- `.a-stack/config.json`

If either file is missing, ask the user whether to run `/migrate`. If they already said `/migrate`, run:

```bash
node scripts/a-stack.mjs migrate --target <repo>
```

Then continue with the routed workflow using the generated `.planning/` context.
