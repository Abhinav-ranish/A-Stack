---
description: Run the ship-readiness workflow — gates, summary, hard-stops.
---

# /ship

```bash
STACK_ROOT="${ASTACK_ROOT:-$HOME/.claude/skills/a-stack}"
cat "$STACK_ROOT/workflows/ship.md"
node "$STACK_ROOT/scripts/a-stack.mjs" gates --root "$STACK_ROOT" --target "$PWD" --ui --public
```

Hard-stop before destructive actions, force-pushes, production deploys without required credentials, or unresolved critical security findings.
