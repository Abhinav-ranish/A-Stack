---
description: HTTP-level smoke against the dev server. Use before /qa for a fast tripwire.
argument-hint: "[--url /path]... [--port 3000] [--start-script dev]"
---

# /qa-browser

```bash
STACK_ROOT="${ASTACK_ROOT:-$HOME/.claude/skills/a-stack}"
node "$STACK_ROOT/scripts/qa-browser.mjs" --target "$PWD" $ARGUMENTS
```

Spawns the dev script, waits for ready, hits each URL, captures status / response time / payload size / obvious error markers. Writes `.planning/QA.md`. For real visual QA (clicks, screenshots, console capture), use `/qa` and rely on the `gstack-browse` or `agent-browser` skills if installed.
