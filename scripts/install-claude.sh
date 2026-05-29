#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills/a-stack"
COMMAND_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/commands"
MIGRATE_COMMAND="$COMMAND_DIR/migrate.md"

mkdir -p "$(dirname "$TARGET")"

if [ -e "$TARGET" ] && [ ! -L "$TARGET" ]; then
  echo "Refusing to replace non-symlink target: $TARGET" >&2
  exit 1
fi

ln -sfn "$ROOT" "$TARGET"

mkdir -p "$COMMAND_DIR"

if [ -e "$MIGRATE_COMMAND" ] && [ ! -L "$MIGRATE_COMMAND" ]; then
  echo "Skipping /migrate command because non-symlink exists: $MIGRATE_COMMAND" >&2
else
  ln -sfn "$ROOT/commands/migrate.md" "$MIGRATE_COMMAND"
fi

echo "Installed A-Stack skill pack at $TARGET"
echo "Installed A-Stack /migrate command at $MIGRATE_COMMAND"
echo "Restart Claude Code, then use natural language like: build me a SaaS dashboard."
