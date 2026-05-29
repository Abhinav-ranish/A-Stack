# Execute Workflow

Use for implementation, phase execution, or "code it" requests.

## Swarm-Lite Model

Use deterministic roles instead of fragile slash-command swarms:

| Role | Owns |
|---|---|
| Planner | phase decomposition and file ownership |
| Executor | code changes for assigned files |
| Verifier | tests, build, lint, manual acceptance |
| Security | CyberReview and security scanner |
| UI | frontend baseline and AI Council when visual risk exists |
| QA | browser loop and regression checks |
| Release | ship readiness and PR/release notes |

## Parallel Rules

- Parallelize only independent tasks with disjoint write sets.
- Prefer git worktrees when multiple agents may edit code concurrently.
- If tasks touch the same files, run sequentially.
- Every task must produce a summary, changed files, verification run, and unresolved risks.

## Required Gates

1. Baseline tests/build before major changes when feasible.
2. Implementation.
3. Verification command.
4. Security review for web/auth/data code.
5. Browser QA for UI/user-flow work.
6. Ship readiness if the user asked to release.

## Checkpointing During Long Work

If `checkpoint mode` is `continuous` (`a-stack checkpoint mode --target <repo>`),
commit each completed logical unit as you go — after new intentional files,
finished functions/modules, or verified fixes, and before long install/build/test
runs:

```bash
node scripts/a-stack.mjs checkpoint commit --target <repo> \
  --message "<what changed>" --decisions "<key choices>" --remaining "<what's left>" --files "<paths>"
```

Stage only intentional files (never `git add -A`), never commit broken state, and
do not announce each WIP commit. In `explicit` mode (default), only commit when
the user or a workflow asks. `/ship` squashes WIP commits into clean history.
