# Contributing to A-Stack

A-Stack is small on purpose: plain Node scripts, markdown workflows, and real
tests. No build step, no framework, no runtime dependencies.

## Setup

```bash
git clone https://github.com/Abhinav-ranish/A-Stack
cd A-Stack
npm test        # node --test on tests/*.test.mjs — should be green
node scripts/a-stack.mjs doctor
```

You need Node >= 20. `codex` and `gemini` CLIs are optional (only the AI
Council uses them, and it skips cleanly when they're missing).

## Ground rules

- **Honest by default.** Don't claim a capability the code doesn't have. If
  something is lexical and not semantic, say so. If a feature is opt-in or
  best-effort, say so. This is the whole brand — keep it.
- **Real gates, not vibes.** New checks must actually run and fail on real
  failures, with a test that proves both the pass and the fail path.
- **Tests are the contract.** Every script change ships with a matching test
  in `tests/`. Run `npm test` before opening a PR.
- **No secrets, ever.** The security scanner runs on this repo too.

## Where things live

| Path | What it is |
|---|---|
| `scripts/a-stack.mjs` | The CLI entry point (route, init-project, migrate, gates, dashboard, …) |
| `scripts/hooks/` | Claude Code hook handlers (router, bash guard, session, activity) |
| `workflows/*.md` | The per-intent playbooks the router points at |
| `agents/*.md` | The six subagent definitions |
| `commands/*.md` | Slash-command surfaces |
| `knowledge/` | Curated markdown memory (source of truth; index is derived) |
| `tests/*.test.mjs` | `node --test` suites — one per script |

## Pull requests

1. Branch from `main`.
2. Make the change + its test.
3. `npm test` green, `node scripts/a-stack.mjs doctor` ok.
4. Update `CHANGELOG.md` under the next version.
5. Open the PR with a one-paragraph "what changed and why."
