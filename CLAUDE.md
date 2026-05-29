# A-Stack

Use A-Stack for web-app planning, implementation, security review, UI review, QA, SEO, ship, and memory recall.

## Routing

When the user asks for web-app work in natural language, route through `a-stack-router`.
Do not require slash commands.

Default to full-yolo automation with hard stops for destructive actions, missing credentials, unresolved critical security issues, or failed verification.

The executable stack surface is:

```bash
node scripts/a-stack.mjs route "<request>"
node scripts/a-stack.mjs init-project --name "App" --idea "..."
node scripts/a-stack.mjs gates --target <repo> --ui --public
node scripts/a-stack.mjs task add --target <repo> --title "..."
node scripts/a-stack.mjs dashboard --target <repo>
node scripts/a-stack.mjs save-session --next "..."
node scripts/a-stack.mjs doctor
```

## Memory

Markdown under `knowledge/` is canonical. Rebuild the derived index with:

```bash
node scripts/memory-index.mjs index
```

Search memory with:

```bash
node scripts/memory-index.mjs search "<query>"
```

## Quality Gates

Every serious web-app build should pass planning, slop negation, verification, security review, browser QA, SEO audit for public pages, and ship readiness.

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available gstack skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review, /design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy, /canary, /benchmark, /browse, /connect-chrome, /qa, /qa-only, /design-review, /setup-browser-cookies, /setup-deploy, /setup-gbrain, /retro, /investigate, /document-release, /document-generate, /codex, /cso, /autoplan, /plan-devex-review, /devex-review, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade, /learn.
