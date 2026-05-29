---
description: Run the A-Stack gates (security scan, dependency audit, test/build/lint).
argument-hint: "[--ui] [--public] [--skip-tests|--skip-build|--skip-lint|--skip-audit]"
---

# /gates

```bash
STACK_ROOT="${ASTACK_ROOT:-$HOME/.claude/skills/a-stack}"
node "$STACK_ROOT/scripts/a-stack.mjs" gates --root "$STACK_ROOT" --target "$PWD" $ARGUMENTS
```

Non-zero exit means a gate failed. Read `.planning/GATES.md` for the full report.
