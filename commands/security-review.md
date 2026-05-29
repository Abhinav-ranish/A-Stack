---
description: Run the A-Stack CyberReview workflow and the deterministic security scanner.
---

# /security-review

```bash
STACK_ROOT="${ASTACK_ROOT:-$HOME/.claude/skills/a-stack}"
cat "$STACK_ROOT/workflows/security-review.md"
node "$STACK_ROOT/scripts/security-scan.mjs" "$PWD"
```

Hard-stop on critical findings. Each finding needs severity, exploit path, fix, and verification.
