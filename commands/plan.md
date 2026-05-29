---
description: Run the A-Stack planning workflow — produces .planning/ artifacts.
argument-hint: "[short description of the work]"
---

# /plan

Load `workflows/plan.md` from the A-Stack root and follow it for the user's request.

```bash
STACK_ROOT="${ASTACK_ROOT:-$HOME/.claude/skills/a-stack}"
cat "$STACK_ROOT/workflows/plan.md"
```

If `.planning/` does not yet exist in the target repo, suggest running `/route "new app: $ARGUMENTS"` first so the GSD-style scaffold is created.
