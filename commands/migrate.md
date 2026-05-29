# /migrate

Import A-Stack into the current repo when code already exists.

Run:

```bash
STACK_ROOT="${ASTACK_ROOT:-$HOME/.claude/skills/a-stack}"
node "$STACK_ROOT/scripts/a-stack.mjs" migrate --root "$STACK_ROOT" --target "$PWD"
```

Then read `.planning/STATE.md` and continue from the next action.

Rules:

- Do not rewrite product code during migration.
- Do not overwrite existing `.planning/` docs unless the user asks for refresh/force.
- Preserve existing `CLAUDE.md` content and only add/update the guarded A-Stack block.
- After migration, route normal requests through A-Stack.
