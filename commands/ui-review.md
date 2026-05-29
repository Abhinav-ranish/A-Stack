---
description: Run the AI Council UI/UX review on a URL or screenshot.
argument-hint: "<url-or-path>"
---

# /ui-review

```bash
STACK_ROOT="${ASTACK_ROOT:-$HOME/.claude/skills/a-stack}"
cat "$STACK_ROOT/workflows/ui-review.md"
```

If a council pass is needed, run:

```bash
node "$STACK_ROOT/scripts/ai-council.mjs" review --url "$ARGUMENTS"
```
