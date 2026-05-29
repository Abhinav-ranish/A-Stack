---
description: Start the A-Stack dashboard for the current project.
argument-hint: "[--port 4317]"
---

# /dashboard

```bash
STACK_ROOT="${ASTACK_ROOT:-$HOME/.claude/skills/a-stack}"
node "$STACK_ROOT/scripts/a-stack.mjs" dashboard --root "$STACK_ROOT" --target "$PWD" $ARGUMENTS
```

Opens at `http://127.0.0.1:4317` (or your chosen port). Shows phase, gates, tasks, and recent events.
