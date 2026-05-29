#!/usr/bin/env node
// PostToolUse hook: append a tool-use event to the active A-Stack target's
// .planning/A-STACK-EVENTS.json. Captures *real* tool activity (Bash, Edit,
// Write, Read, etc.) so the dashboard's "activity" view reflects what
// actually happened — replacing the manual `event --tokens-in X` flow.
//
// Off-by-default: set ASTACK_ACTIVITY=on to enable. ASTACK_TARGET (or the
// nearest .planning/ ancestor of cwd) decides which project's log to write.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

if (process.env.ASTACK_ACTIVITY !== "on") process.exit(0);

let payload = {};
try {
  payload = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  process.exit(0);
}

const toolName = payload.tool_name || payload.toolName || "";
if (!toolName) process.exit(0);

function findTargetRoot() {
  const explicit = process.env.ASTACK_TARGET;
  if (explicit) return resolve(explicit);
  let dir = process.cwd();
  for (let i = 0; i < 20; i++) {
    if (existsSync(join(dir, ".planning"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const targetRoot = findTargetRoot();
if (!targetRoot) process.exit(0);

const eventsPath = join(targetRoot, ".planning", "A-STACK-EVENTS.json");
let store = { version: 1, events: [] };
if (existsSync(eventsPath)) {
  try {
    store = JSON.parse(readFileSync(eventsPath, "utf8"));
    if (!Array.isArray(store.events)) store.events = [];
  } catch {
    store = { version: 1, events: [] };
  }
}

function summarizeInput(toolName, input) {
  if (!input) return "";
  if (toolName === "Bash") return (input.command || input.cmd || "").slice(0, 160);
  if (toolName === "Read") return input.file_path || "";
  if (toolName === "Write" || toolName === "Edit") return input.file_path || "";
  if (toolName === "Glob" || toolName === "Grep") return input.pattern || input.query || "";
  if (toolName === "WebFetch" || toolName === "WebSearch") return input.url || input.query || "";
  try {
    return JSON.stringify(input).slice(0, 160);
  } catch {
    return "";
  }
}

const success = payload.tool_response?.success !== false && !payload.error;
const event = {
  id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  type: "tool-use",
  title: `${toolName}${success ? "" : " (error)"}`,
  details: summarizeInput(toolName, payload.tool_input || payload.toolInput),
  toolName,
  success,
  tokensIn: 0,
  tokensOut: 0,
  costUsd: 0,
  source: "posttool-hook",
  createdAt: new Date().toISOString(),
};

store.events.push(event);

// keep the log bounded — last 500 events
if (store.events.length > 500) store.events = store.events.slice(-500);

mkdirSync(dirname(eventsPath), { recursive: true });
writeFileSync(eventsPath, `${JSON.stringify(store, null, 2)}\n`);

process.exit(0);
