---
description: Classify the user's request and route to the right A-Stack workflow.
argument-hint: "<natural language request>"
---

# /route

Run the router on the user's request, then load the chosen workflow.

```bash
STACK_ROOT="${ASTACK_ROOT:-$HOME/.claude/skills/a-stack}"
node "$STACK_ROOT/scripts/a-stack.mjs" route "$ARGUMENTS"
```

Read the matched workflow file from `workflows/` and follow it. Honor the hard gates listed in `SKILL.md` even when the user asks for full-yolo mode.
