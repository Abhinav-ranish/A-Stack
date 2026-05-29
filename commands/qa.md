---
description: Run browser QA against a running app — flows, console, regressions.
argument-hint: "[url]"
---

# /qa

```bash
STACK_ROOT="${ASTACK_ROOT:-$HOME/.claude/skills/a-stack}"
cat "$STACK_ROOT/workflows/qa-browser.md"
```

QA passes only when the tested flows work in-browser and there are no high-impact console/runtime errors.
