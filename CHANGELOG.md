# Changelog

All notable changes to A-Stack are documented here. Versions follow the
plugin manifest (`.claude-plugin/plugin.json`).

## [0.7.0]

### Added
- **`/plugin` install path.** A-Stack now ships its own
  `.claude-plugin/marketplace.json`, so it installs the standard Claude Code
  way: `/plugin marketplace add Abhinav-ranish/A-Stack` then
  `/plugin install a-stack@a-stack`. No more manual clone-into-a-folder.
- `doctor` now verifies `marketplace.json` is present and reports it in the
  plugin registry summary.
- **`a-stack demo` command** — a self-contained, offline, ~10-second proof of
  the core claims. Scaffolds a throwaway project, routes plain-language
  requests, runs the real gates on clean code, then plants a leaked key and
  watches the scanner block it. Auto-cleans; touches nothing in your repo.
- **Dashboard rebuilt as a command center** — sticky vitals rail, bento hero
  (phase/cost/gates/agents), a tool-usage bar chart, a task kanban, memory and
  git panels, and a filterable events timeline. Graphite/amber theme.

### Added (verify loop)
- **`verify` command + `/verify` + `workflows/verify.md`** — the deterministic
  closed loop on top of gates: run the suite, and on failure emit a
  machine-readable remediation plan (`failures[].action`) plus a bounded,
  auditable iteration log in `.planning/VERIFY.md`. An agent loops until
  `pass: true`, fixing the source and never weakening a gate to pass. This turns
  one-shot gates into a convergent verification step.

### Changed (memory + dashboard)
- **Memory ranking upgraded from token-overlap to BM25** (term-frequency
  saturation, IDF, length normalization) — materially better recall while
  staying a transparent, zero-dependency lexical index (still not a vector
  store). Legacy indexes auto-upgrade on next search.
- **Dashboard binds both loopback stacks** (`127.0.0.1` + `::1`) so
  `http://localhost` loads on macOS, where `localhost` often resolves to IPv6.

### Fixed
- **`init-project --target` is now honored.** It previously fell back to the
  current working directory, which could write `.planning/` and a project
  memory file into the A-Stack install itself. It now resolves `--target`
  like every other command (`migrate`, `gates`, `task`, `save-session`),
  with `--root`/`ASTACK_ROOT`/cwd as the fallback.

### Changed
- Repo root decluttered: the long-form security checklist moved to
  `docs/CyberReview.md` and the original inspiration notes to `docs/sources.md`.
- Added `CHANGELOG.md` and `CONTRIBUTING.md`; README rewritten around the real
  install flow and what makes A-Stack different.

## [0.6.0]
- Dashboard monitoring panels: roadmap tracker, parallel-agents panel, and git
  activity (recent commits + uncommitted files).

## [0.5.0]
- Dashboard dark mode, live session cost, and allowlisted one-click quick
  actions (security scan, gates, browser QA, reindex memory).

## [0.4.0]
- Live monitoring: dashboard polling every 3s, real phase progress derived from
  `STATE.md`, and a live parallel-subagent count.

## [0.3.1]
- Ported gstack's session / learning / checkpoint ideas; session state and
  learnings are project-local, not stored in the A-Stack repo.

## [0.3.0]
- Ported Ruflo's best ideas: session lifecycle hooks, status line, memory
  recall on `UserPromptSubmit`, and orchestration patterns.

## [0.2.0]
- Six subagents, real hooks, AI Council, README/LICENSE/CI, and a hardened,
  expanded security scanner with real gate execution.

## [0.1.0]
- Initial A-Stack baseline: natural-language router, GSD-style planning
  artifacts, markdown memory index, and the first quality gates.
