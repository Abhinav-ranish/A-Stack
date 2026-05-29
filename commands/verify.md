---
description: Run the gate -> fix -> re-run loop until every gate is green (or the iteration budget trips).
argument-hint: "[--ui] [--public] [--max-iters 5] [--skip-tests|--skip-build|--skip-lint|--skip-audit]"
---

# /verify

The deterministic closed loop on top of `/gates`. It runs the full gate suite and,
on failure, returns a machine-readable remediation plan plus a bounded iteration
counter in `.planning/VERIFY.md`. Loop on it until `pass: true` — never loosen,
allowlist, or delete a gate to make it pass.

```bash
STACK_ROOT="${ASTACK_ROOT:-$HOME/.claude/skills/a-stack}"
node "$STACK_ROOT/scripts/a-stack.mjs" verify --root "$STACK_ROOT" --target "$PWD" $ARGUMENTS
```

Loop protocol (see `workflows/verify.md`):

1. Run the command above.
2. If `pass: true` → done; the work is ship-ready.
3. If `pass: false` → read each `failures[].action`, fix the named files/findings,
   then run it again. The iteration count is tracked for you.
4. If it reports the budget is reached, **STOP and escalate** — do not weaken a gate.
