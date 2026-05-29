#!/usr/bin/env node
// PreToolUse hook for Bash: blocks (exit 2) on destructive commands unless
// the user has explicitly opted in via ASTACK_BASH_GUARD=off.
//
// Hook contract: receives a JSON event on stdin with shape
// { tool_name: string, tool_input: { command: string, ... } }
// Exit codes:
//   0  — allow
//   2  — block, message on stderr is shown to the model
// Anything written to stdout is appended to the model context.

import { readFileSync } from "node:fs";

if (process.env.ASTACK_BASH_GUARD === "off") process.exit(0);

let payload = {};
try {
  payload = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  process.exit(0);
}

const toolName = payload.tool_name || payload.toolName || "";
if (toolName.toLowerCase() !== "bash") process.exit(0);

const command = (payload.tool_input?.command || payload.toolInput?.command || "").toString();
if (!command) process.exit(0);

const rules = [
  { id: "rm-rf-root", regex: /\brm\s+(?:-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\b\s+(?:--no-preserve-root\s+)?\/(?:\s|$)/, message: "rm -rf / — refusing to delete from filesystem root." },
  { id: "rm-rf-home", regex: /\brm\s+-[a-zA-Z]*rf?\b[^|;&]*\$HOME/, message: "rm -rf inside $HOME — refusing without explicit user confirmation." },
  { id: "rm-rf-wildcard-root", regex: /\brm\s+-[a-zA-Z]*rf?\b\s+\/\*/, message: "rm -rf /* — refusing destructive root wildcard." },
  { id: "git-push-force-main", regex: /\bgit\s+push\b[^|;&]*--force(?:-with-lease)?[^|;&]*\b(?:main|master|prod|production)\b/, message: "git push --force on main/master/prod — refusing without explicit user opt-in." },
  { id: "git-reset-hard-origin", regex: /\bgit\s+reset\s+--hard\b[^|;&]*\borigin\//, message: "git reset --hard origin/... — destructive; confirm with the user first." },
  { id: "drop-database", regex: /\bDROP\s+(?:DATABASE|SCHEMA|TABLE)\b/i, message: "DROP DATABASE/SCHEMA/TABLE — destructive; confirm with the user first." },
  { id: "truncate-table", regex: /\bTRUNCATE\s+TABLE\b/i, message: "TRUNCATE TABLE — destructive; confirm with the user first." },
  { id: "kubectl-delete-ns", regex: /\bkubectl\s+delete\s+namespace\b/, message: "kubectl delete namespace — destructive; confirm with the user first." },
  { id: "kubectl-delete-prod", regex: /\bkubectl\s+delete\b[^|;&]*\bprod(?:uction)?\b/, message: "kubectl delete in prod — confirm with the user first." },
  { id: "dd-disk", regex: /\bdd\s+if=[^\s]+\s+of=\/dev\//, message: "dd writing to /dev/* — refusing; this can wipe disks." },
  { id: "mkfs", regex: /\bmkfs(?:\.[a-z0-9]+)?\b/, message: "mkfs — refusing; reformats disks." },
  { id: "shutdown", regex: /\b(?:shutdown|reboot|halt|poweroff)\b/, message: "shutdown/reboot/halt — refusing." },
  { id: "curl-pipe-sh", regex: /\bcurl\b[^|]*\|\s*(?:sh|bash|zsh)\b/, message: "curl ... | sh — refusing remote script execution without explicit user opt-in." },
  { id: "chmod-777-root", regex: /\bchmod\s+(?:-R\s+)?(?:0?777)\b\s+\//, message: "chmod 777 against / — refusing." },
];

const lower = command;
for (const rule of rules) {
  if (rule.regex.test(lower)) {
    process.stderr.write(`[a-stack guard] BLOCKED ${rule.id}: ${rule.message}\n`);
    process.stderr.write(`Set ASTACK_BASH_GUARD=off to bypass (only if the user explicitly approved this exact command).\n`);
    process.exit(2);
  }
}

process.exit(0);
