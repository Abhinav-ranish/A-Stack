<div align="center">

# A-Stack

**Talk to Claude Code in plain English. Get planned, secured, QA'd, shippable web apps — with gates that actually run, not vibes.**

[![CI](https://github.com/Abhinav-ranish/A-Stack/actions/workflows/test.yml/badge.svg)](https://github.com/Abhinav-ranish/A-Stack/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](./LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen)
![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-5A4FCF)
![Runtime deps](https://img.shields.io/badge/runtime%20deps-0-brightgreen)

</div>

A-Stack is a Claude Code-first autonomous stack for web-app work. You describe
what you want in natural language; it routes the request to the right workflow,
runs **real** quality gates, and keeps your project's planning + memory in plain
markdown you can read and grep.

It's a single plugin — **zero runtime dependencies**, just Node scripts and
markdown — and it's **honest by default**: every claim in this README maps to
code with a test behind it.

```text
build me a SaaS dashboard for invoice follow-up      → plans, scaffolds, verifies
this repo already has code, make a-stack understand it → reads it, writes .planning/
review this before I ship                              → security + QA + SEO gates
ship it                                                → refuses on critical findings
```

---

## Install (≈60 seconds)

A-Stack is its own Claude Code marketplace. Inside Claude Code:

```text
/plugin marketplace add Abhinav-ranish/A-Stack
/plugin install a-stack@a-stack
```

That's it — restart Claude Code and the commands, subagents, and hooks are live.
Verify any time with:

```bash
node scripts/a-stack.mjs doctor
```

<details>
<summary>Other install paths (CLI / local clone)</summary>

```bash
# From your terminal instead of the /plugin UI:
claude plugin marketplace add Abhinav-ranish/A-Stack
claude plugin install a-stack@a-stack

# Or develop against a local clone (symlinks the skill pack + /migrate):
git clone https://github.com/Abhinav-ranish/A-Stack
bash A-Stack/scripts/install-claude.sh
```

The status line ships with the plugin. If your Claude Code build doesn't pick a
plugin status line up automatically on the main thread, wire it explicitly in
`~/.claude/settings.json`:

```json
{ "statusLine": { "type": "command", "command": "node /abs/path/to/a-stack/scripts/statusline.mjs" } }
```
</details>

After install you get:

- **Commands:** `/route` `/plan` `/execute` `/migrate` `/security-review`
  `/ui-review` `/qa` `/qa-browser` `/seo` `/ship` `/debug` `/gates` `/verify` `/dashboard`
- **Subagents:** `a-stack-planner` · `a-stack-executor` ·
  `a-stack-security-reviewer` · `a-stack-qa-tester` · `a-stack-ui-reviewer` ·
  `a-stack-release-manager`
- **Hooks:** auto-router + memory recall on every prompt, a destructive-bash
  guard, session breadcrumbs that survive `/compact`, and an opt-in activity log.
- **Status line:** `▊ A-Stack │ ⎇ main │ Opus 4.8 │ $0.42 │ ⧉ 2 │ ⊞ dashboard`
  — framework, branch, model, live session cost, live parallel-subagent count,
  clickable dashboard link. Every value is measured; nothing is hardcoded.

## See it work (no install, ~10 seconds)

Don't take the README's word for it — run the proof. It scaffolds a throwaway
project in a temp dir, routes plain-language requests, runs the real gates on
clean code, then plants a leaked API key and watches the scanner block it.
Everything is deleted afterward; nothing touches your repo:

```bash
git clone https://github.com/Abhinav-ranish/A-Stack && cd A-Stack
node scripts/a-stack.mjs demo
```

```text
3) Real gates on clean code (each one actually executes):
   PASS  security-scan
   PASS  script:test
   gates exit code: 0 (0 = clean)

4) "Not vibes": plant a leaked API key and watch the scanner block it:
   scanner exit code: 1 (non-zero = build blocked)
   findings: 1 — critical "openai-key" in leak.ts:1
```

## Use it

Just talk. The router (`UserPromptSubmit` hook) classifies intent and points the
agent at the matching playbook in `workflows/` — no slash commands to memorize.

```text
build me a landing page for a newsletter tool   → workflows/new-app.md
the login redirect is broken                     → workflows/debug.md
audit this for security issues                    → workflows/security-review.md
ship this to production                           → workflows/ship.md
```

Or drive the CLI directly:

```bash
node scripts/a-stack.mjs route "fix the login redirect"
node scripts/a-stack.mjs init-project --name "Invoice Pilot" --idea "..." --target ./app
node scripts/a-stack.mjs migrate --target /path/to/existing-repo
node scripts/a-stack.mjs gates  --target /path/to/repo --ui --public
node scripts/a-stack.mjs dashboard start --target /path/to/repo
node scripts/a-stack.mjs doctor
```

## Why A-Stack

The agent-stack space is loud with "AI memory," "neural routing," and
"autonomous swarms." A-Stack takes the opposite posture — **take the parts that
work, refuse the parts that don't, and never oversell.**

| | A-Stack |
|---|---|
| **Gates that actually run** | `gates` executes your test/build/lint, runs a real secret scanner and `npm audit`, and **fails on real failures** — not just on a missing script. Critical security findings are a hard stop. |
| **Honest memory** | A transparent **BM25 lexical** index over your markdown. It's recall, not a vector store — and it says so. No hidden embeddings, no "neural" theater. |
| **Survives `/compact`** | Session breadcrumbs are snapshotted before compaction and re-injected on the next turn, so "where was I" survives compaction and resume. |
| **No lock-in, no deps** | Plain markdown + Node. Zero runtime dependencies. Read every file, delete the plugin, keep your `.planning/` and `knowledge/`. |
| **One natural-language door** | The router picks the workflow. You don't memorize 13 slash commands — though they're all there when you want them. |
| **Tested** | 71 `node --test` cases gate the behavior, run in CI on Node 20 + 22. |

## Real gates (not vibes)

`node scripts/a-stack.mjs gates --target <repo>` runs each gate for real and
writes the verdict to `.planning/GATES.md`:

- **`security-scan`** — ~30 regex patterns for provider tokens (GitHub, AWS,
  Stripe, Google, Slack, Anthropic), JWT/TLS bypasses, SQL/SSRF/path-traversal
  sinks, prompt-injection markers, and frontend LLM key leaks. Allowlist via
  `.a-stack/security-ignore.json` or an inline `// a-stack-ignore: reason`.
- **`dependency-audit`** — runs `npm audit --json` (or pnpm/yarn), fails on
  high/critical advisories.
- **`script:test` · `script:build` · `script:lint`** — runs each one, captures
  exit code + output tail.
- **`browser-qa` · `seo-audit`** — required or not based on `--ui` / `--public`.

Skip flags: `--skip-tests` `--skip-build` `--skip-lint` `--skip-audit`.

## Verify loop (gate → fix → re-run)

Gates tell you *whether* something's broken. `verify` drives it to *green*:

```bash
node scripts/a-stack.mjs verify --target <repo> [--ui] [--public] [--max-iters 5]
```

It runs the full gate suite and, on failure, returns a **machine-readable
remediation plan** (`failures[].action`) plus a bounded, append-only iteration
log in `.planning/VERIFY.md`. An agent (or `workflows/verify.md`) loops on it
until `pass: true` — fixing the **source**, never loosening, allowlisting, or
deleting a gate to force a pass. Exit `0` = ship-ready; exit `1` = work remains.
A critical security finding is a hard stop regardless of budget.

## Memory

Plain markdown under `knowledge/` is the source of truth. `.a-stack-index.json`
is a **derived BM25 lexical index** — not a vector store — rebuilt on demand:

```bash
node scripts/memory-index.mjs index  --root /path/to/a-stack
node scripts/memory-index.mjs search "auth dashboard" --root /path/to/a-stack
```

The `UserPromptSubmit` hook runs that same search against your prompt and
surfaces the top hits inline — the honest version of "[INTELLIGENCE] pattern
suggestions" (lexical recall, not vector/RAG). `workflows/self-learning.md`
covers how trajectories/patterns get recorded and promoted/demoted over time.

## Session persistence (survives `/compact`)

Save is **manual by default** — there's no reliable "session about to stop"
signal, so leave a breadcrumb at meaningful points:

```bash
node scripts/a-stack.mjs save-session --title "auth refactor" \
  --next "wire the callback" --decisions "server-side sessions"
node scripts/a-stack.mjs save-session list      # checkpoints on this branch
```

Each save writes an append-only, branch-aware checkpoint (frontmatter +
Decisions / Remaining / Notes), project-local under `.planning/sessions/`.
`PreCompact` snapshots the pointer before compaction; `SessionStart` re-injects
it — plus open `.planning/TASKS.json` items and recent operational learnings —
on the next turn. So `/compact` or resume no longer wipes "where you left off."

```bash
# Durable project gotchas, auto-surfaced at SessionStart:
node scripts/a-stack.mjs learn add --insight "migration step needs more heap" --key mig
node scripts/a-stack.mjs learn search "migration"

# Opt-in continuous checkpointing — WIP commits with an embedded context block
# at logical boundaries (never `git add -A`, never a guessed session end):
node scripts/a-stack.mjs checkpoint mode continuous --target <repo>
```

## Dashboard

```bash
node scripts/a-stack.mjs dashboard start --target /path/to/repo   # detached
node scripts/a-stack.mjs dashboard status   # or: dashboard stop
```

Dark by default, polls `/api/state` every 3s (pausing when the tab is hidden),
and derives the live phase from `STATE.md`'s `## Phase status` checklist. It
shows the **live session cost**, a **roadmap tracker**, a **parallel-agents**
panel, and a **git activity** panel, plus **one-click quick actions** (security
scan, gates, browser QA, reindex) wired to an allowlisted `POST /api/actions` —
no arbitrary command execution. Opt into auto-start per project by setting
`ASTACK_DASHBOARD_AUTOSTART=1` in `.claude/settings.json`.

## Orchestration

For work spanning 3+ files or multiple roles, `workflows/orchestration.md` maps
SendMessage-first pipeline / fan-out / supervisor patterns onto A-Stack's six
subagents using Claude Code's real `Agent` tool (with git-worktree isolation for
concurrent edits).

## AI Council

```bash
node scripts/ai-council.mjs review --target https://your.app --focus "hero" --dry-run
node scripts/ai-council.mjs review --target ./repo
```

High-stakes visual/product calls get a second and third opinion (Codex +
Gemini + Claude). If `codex` or `gemini` aren't installed, it skips cleanly with
an install hint.

## Hooks (what gets blocked)

The destructive-bash guard (`scripts/hooks/pretool-bash-guard.mjs`) blocks,
without explicit opt-in: `rm -rf /`, `rm -rf $HOME`, `git push --force` to
`main`/`master`/`prod`, `git reset --hard origin/...`,
`DROP DATABASE|SCHEMA|TABLE`, `TRUNCATE TABLE`, `kubectl delete namespace`,
`dd … of=/dev/…`, `mkfs.*`, `shutdown`/`reboot`/`halt`, `curl … | sh`, and
`chmod 777 /`. Bypass for one session: `export ASTACK_BASH_GUARD=off`.

## Development

```bash
npm test    # node --test on tests/*.test.mjs (71 tests)
node scripts/a-stack.mjs doctor
```

CI runs the same on push/PR (Node 20 + 22) via `.github/workflows/test.yml`.
See [CONTRIBUTING.md](./CONTRIBUTING.md) and [CHANGELOG.md](./CHANGELOG.md).

## What it borrows

A-Stack borrows the parts that work from other stacks and avoids the parts that
don't: **GSD**-style `.planning/` artifacts, **Superpowers**-style lightweight
intake, **Ruflo**-inspired markdown memory + security gates + session
persistence, and **gstack**-style browser QA + ship readiness.

## License

MIT — see [LICENSE](./LICENSE).
