// Live parallel-subagent counter. Claude Code fires SubagentStart/SubagentStop
// around each Task/Agent it runs; the session hook records one file per active
// subagent here, and the statusline reads the count. A TTL prunes leaked files
// if a Stop is ever missed (crash), so the count self-heals.
//
// State dir: ASTACK_STATE_DIR/agents (default ~/.a-stack/agents) — shared with
// the dashboard PID + session state, runtime-only, never committed.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TTL_MS = 30 * 60 * 1000; // a started-but-never-stopped agent expires in 30 min

function agentsDir() {
  return join(process.env.ASTACK_STATE_DIR || join(homedir(), ".a-stack"), "agents");
}

function prune(dir) {
  const now = Date.now();
  for (const f of readdirSync(dir)) {
    try {
      if (now - statSync(join(dir, f)).mtimeMs > TTL_MS) unlinkSync(join(dir, f));
    } catch {
      /* best effort */
    }
  }
}

export function agentStart(meta = {}) {
  try {
    const dir = agentsDir();
    mkdirSync(dir, { recursive: true });
    prune(dir);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    writeFileSync(join(dir, id), JSON.stringify({ startedAt: new Date().toISOString(), ...meta }));
  } catch {
    /* never crash a hook */
  }
}

// We can't correlate a Stop event back to a specific Start, so remove the most
// recent marker (LIFO). The count is what matters, not which file.
export function agentStop() {
  try {
    const dir = agentsDir();
    if (!existsSync(dir)) return;
    prune(dir);
    const files = readdirSync(dir).sort();
    if (files.length) unlinkSync(join(dir, files[files.length - 1]));
  } catch {
    /* best effort */
  }
}

export function activeAgents() {
  return listAgents().length;
}

// Live list of active subagents with their type + start time (for the dashboard
// "parallel agents" panel). Stale (TTL-expired) markers are excluded.
export function listAgents() {
  try {
    const dir = agentsDir();
    if (!existsSync(dir)) return [];
    const now = Date.now();
    return readdirSync(dir)
      .map((f) => {
        try {
          const mtimeMs = statSync(join(dir, f)).mtimeMs;
          if (now - mtimeMs > TTL_MS) return null;
          let meta = {};
          try {
            meta = JSON.parse(readFileSync(join(dir, f), "utf8"));
          } catch {
            /* ignore */
          }
          return { type: meta.type || "agent", startedAt: meta.startedAt || new Date(mtimeMs).toISOString() };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));
  } catch {
    return [];
  }
}
