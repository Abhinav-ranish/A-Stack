#!/usr/bin/env node
// Session-lifecycle hook for A-Stack. Adapted (curated) from claude-flow's
// hook-handler dispatcher, rewritten honest: it only preserves and re-surfaces
// the session state A-Stack actually has on disk — it does not claim to capture
// the conversation transcript.
//
// Subcommands (chosen by argv[2], wired via .claude-plugin/plugin.json):
//   start       SessionStart  -> inject the saved resume context + open tasks.
//   precompact  PreCompact    -> snapshot the session file so /compact can't lose it.
//
// Hook contract: a JSON event arrives on stdin; additional context is printed to
// stdout (read by Claude Code as a system reminder). Hooks must never crash the
// host, so every path is guarded and the process always exits 0.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { recentLearnings } from "../learnings.mjs";
import { startDashboard } from "../dashboard-control.mjs";
import { agentStart, agentStop } from "../agent-counter.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const stackRoot = process.env.ASTACK_ROOT || resolve(here, "..", "..");
const MAX_SNAPSHOTS = 5;

// Session state is PROJECT-local — it lives in the project's .planning/, not in
// the A-Stack install. (stackRoot is still used to launch the dashboard server,
// which is shipped with the install.)
function sessionsDirFor(target) {
  return join(target, ".planning", "sessions");
}
function sessionFileFor(target) {
  return join(target, ".planning", "SESSION.md");
}

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function parsePayload() {
  try {
    return JSON.parse(readStdin() || "{}");
  } catch {
    return {};
  }
}

function targetRoot(payload) {
  return (
    payload.cwd ||
    process.env.CLAUDE_PROJECT_DIR ||
    process.cwd()
  );
}

function readText(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function openTaskSummary(root) {
  try {
    const tasksPath = join(root, ".planning", "TASKS.json");
    if (!existsSync(tasksPath)) return null;
    const state = JSON.parse(readFileSync(tasksPath, "utf8"));
    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    const open = tasks.filter((t) => t.status !== "done");
    if (open.length === 0) return null;
    const top = open
      .slice(0, 5)
      .map((t) => `    - [${t.status}] ${t.title}`)
      .join("\n");
    return `  open tasks (${open.length}):\n${top}`;
  } catch {
    return null;
  }
}

function latestSnapshot(target) {
  try {
    const dir = sessionsDirFor(target);
    if (!existsSync(dir)) return "";
    const snaps = readdirSync(dir)
      .filter((f) => f.startsWith("precompact-") && f.endsWith(".md"))
      .sort();
    return snaps.length ? join(dir, snaps[snaps.length - 1]) : "";
  } catch {
    return "";
  }
}

// SessionStart: re-surface the saved resume context. Fires on startup, resume,
// /clear, and crucially after /compact — closing the amnesia loop.
function doStart(payload) {
  const target = targetRoot(payload);
  const saved = readText(sessionFileFor(target)).trim();
  const snapPath = latestSnapshot(target);
  const source = payload.source || "startup";

  const lines = ["[a-stack] Resume context:"];
  if (saved) {
    lines.push(indent(saved));
  } else {
    lines.push("  No saved session yet. Run `a-stack save-session --next \"...\"` to leave breadcrumbs.");
  }

  const tasks = openTaskSummary(target);
  if (tasks) lines.push(tasks);

  const learnings = recentOperationalLearnings(target);
  if (learnings.length) {
    lines.push("  recent learnings:");
    for (const l of learnings) lines.push(`    - ${l.key ? `[${l.key}] ` : ""}${l.insight}`);
  }

  if (source === "compact" && snapPath) {
    lines.push(`  (pre-compaction snapshot preserved at ${snapPath.slice(target.length + 1)})`);
  }

  const dash = maybeStartDashboard(target);
  if (dash) lines.push(`  dashboard: ${dash.url} (${dash.status})`);

  process.stdout.write(`${lines.join("\n")}\n`);
}

// Opt-in: set ASTACK_DASHBOARD_AUTOSTART=1 (e.g. in a project's .claude/settings.json)
// to launch the dashboard in the background on session start. Idempotent — a
// second session finds the first one already running.
function maybeStartDashboard(target) {
  const v = (process.env.ASTACK_DASHBOARD_AUTOSTART || "").toLowerCase();
  if (!v || v === "0" || v === "off" || v === "false" || v === "no") return null;
  try {
    return startDashboard({
      stackRoot,
      target,
      port: process.env.ASTACK_DASHBOARD_PORT || "4317",
    });
  } catch {
    return null;
  }
}

function recentOperationalLearnings(target) {
  try {
    return recentLearnings({ root: target, limit: 3 });
  } catch {
    return [];
  }
}

function indent(text) {
  return text
    .split(/\r?\n/)
    .map((l) => (l ? `  ${l}` : l))
    .join("\n");
}

// PreCompact: copy the live session file to a timestamped snapshot so the resume
// breadcrumbs survive compaction, and prune to the most recent MAX_SNAPSHOTS.
function doPrecompact(payload) {
  const target = targetRoot(payload);
  const saved = readText(sessionFileFor(target));
  if (!saved.trim()) return;
  try {
    const dir = sessionsDirFor(target);
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(dir, `precompact-${stamp}.md`), saved);
    const snaps = readdirSync(dir)
      .filter((f) => f.startsWith("precompact-") && f.endsWith(".md"))
      .sort();
    for (const stale of snaps.slice(0, Math.max(0, snaps.length - MAX_SNAPSHOTS))) {
      try {
        unlinkSync(join(dir, stale));
      } catch {
        /* best effort */
      }
    }
  } catch {
    /* never crash the host */
  }
}

const command = process.argv[2] || "start";
try {
  const payload = parsePayload();
  if (command === "start") doStart(payload);
  else if (command === "precompact") doPrecompact(payload);
  else if (command === "agent-start") agentStart({ type: payload.subagent_type || payload.agent_type || "" });
  else if (command === "agent-stop") agentStop();
} catch {
  /* hooks must never crash Claude Code */
}
process.exit(0);
