# Orchestration Workflow

Use when a request spans 3+ files, multiple roles, or independent parallel work.
This is the concrete "how to actually run the swarm-lite roles from `execute.md`"
using Claude Code's real `Agent` tool — adapted from claude-flow's
SendMessage-first coordination, mapped onto A-Stack's six agents.

## A-Stack agents

| Agent | Role |
|---|---|
| `a-stack-planner` | decomposition, file ownership, acceptance criteria |
| `a-stack-executor` | code changes for assigned files |
| `a-stack-security-reviewer` | CyberReview + `security-scan.mjs` |
| `a-stack-qa-tester` | browser QA loop + regression checks |
| `a-stack-ui-reviewer` | visual baseline + AI Council on visual risk |
| `a-stack-release-manager` | ship readiness, PR / release notes |

## Patterns

| Pattern | Flow | Use when |
|---|---|---|
| **Pipeline** | planner → executor → qa → security → release | Sequential dependencies (a feature) |
| **Fan-out** | lead → {executor×N} → lead | Independent tasks with disjoint write sets |
| **Supervisor** | lead ↔ workers | Long refactors needing ongoing coordination |

## Rules (carried over from claude-flow, kept honest)

- Name every agent (`name: "role"`) so it is addressable.
- Put each agent's coordination instructions in its own prompt — who it waits on,
  what it hands off, and where to write its summary (`.planning/`).
- Spawn all agents for a stage in **one message** with `run_in_background: true`.
- After spawning: **stop**. Do not poll status. Agents return or message back.
- Fan-out only across **disjoint write sets**. Overlapping files → run sequentially
  or use a git worktree per agent.
- Every agent task must return: summary, changed files, verification run, open risks.

## Worktree isolation

When two executors might touch the same tree, give each its own git worktree
(`isolation: "worktree"` on the Agent call) so concurrent edits cannot collide.
Merge back only after each branch's verification passes.

## Required gates

Orchestration does not bypass the hard gates in `SKILL.md`: security review for
web/auth/data code, browser QA for UI work, ship readiness before release.
