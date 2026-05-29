---
description: Execute a plan with the swarm-lite role model. Honors file ownership and gates.
argument-hint: "[phase or task]"
---

# /execute

Load and follow `workflows/execute.md`.

```bash
STACK_ROOT="${ASTACK_ROOT:-$HOME/.claude/skills/a-stack}"
cat "$STACK_ROOT/workflows/execute.md"
```

Required: run gates before claiming done.

```bash
node "$STACK_ROOT/scripts/a-stack.mjs" gates --root "$STACK_ROOT" --target "$PWD"
```
