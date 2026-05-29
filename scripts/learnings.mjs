#!/usr/bin/env node
// Operational learnings log. Curated from gstack's gstack-learnings-log/-search:
// an append-only JSONL of durable, project-level operational insights ("command
// X fixes quirk Y", "this build needs flag Z"). Distinct from learning.mjs,
// which scores routing/pattern trajectories — this is the lightweight wiki of
// gotchas, surfaced at session start.
//
// Commands:
//   add    --insight "..." [--key short-key] [--skill name] [--type operational]
//          [--confidence 0..1] [--tags "a b"] [--root <dir>]
//   search --query "..." [--limit N] [--root <dir>]
//   recent [--limit N] [--root <dir>]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const command = args[0] || "recent";

function flag(name, fallback = "") {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return args[i + 1] ?? fallback;
}

// Operational learnings are PROJECT-local — durable gotchas about THIS project,
// stored in its .planning/, not in the shared A-Stack install.
function rootDir() {
  return flag("root", process.env.CLAUDE_PROJECT_DIR || process.cwd());
}

function logPath(root) {
  return join(root, ".planning", "learnings.jsonl");
}

function tokenize(text) {
  return [...new Set((text || "").toLowerCase().match(/[a-z0-9][a-z0-9-]{1,}/g) || [])];
}

function redact(text) {
  return (text || "")
    .replace(/sk-[a-zA-Z0-9_-]{12,}/g, "[REDACTED_SECRET]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_SSN]");
}

export function loadLearnings(root) {
  const path = logPath(root);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function recentLearnings({ root, limit = 20 }) {
  return loadLearnings(root).slice(-limit).reverse();
}

export function searchLearnings({ root, query, limit = 20 }) {
  const q = tokenize(query);
  return loadLearnings(root)
    .map((entry) => {
      const hay = new Set(tokenize(`${entry.key || ""} ${entry.insight || ""} ${(entry.tags || []).join(" ")}`));
      const score = q.reduce((sum, token) => sum + (hay.has(token) ? 1 : 0), 0);
      return { ...entry, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || String(b.ts).localeCompare(String(a.ts)))
    .slice(0, limit);
}

function doAdd(root) {
  const insight = redact(flag("insight"));
  if (!insight) {
    console.error("learnings add: --insight is required");
    process.exit(2);
  }
  const entry = {
    id: `learn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: new Date().toISOString(),
    skill: flag("skill", "manual"),
    type: flag("type", "operational"),
    key: flag("key", ""),
    insight,
    confidence: Math.max(0, Math.min(1, Number(flag("confidence", "0.7")))),
    source: flag("source", "observed"),
    tags: tokenize(flag("tags", "")),
  };
  const path = logPath(root);
  mkdirSync(join(root, ".planning"), { recursive: true });
  const prior = existsSync(path) ? readFileSync(path, "utf8") : "";
  writeFileSync(path, `${prior}${JSON.stringify(entry)}\n`);
  console.log(JSON.stringify({ added: entry.id, total: loadLearnings(root).length }, null, 2));
}

function main() {
  const root = rootDir();
  if (command === "add") {
    doAdd(root);
  } else if (command === "search") {
    const query =
      args.slice(1).filter((a, i) => !a.startsWith("--") && !args.slice(1)[i - 1]?.startsWith("--")).join(" ") ||
      flag("query");
    console.log(JSON.stringify({ query, results: searchLearnings({ root, query, limit: Number(flag("limit", "20")) }) }, null, 2));
  } else if (command === "recent") {
    console.log(JSON.stringify({ results: recentLearnings({ root, limit: Number(flag("limit", "20")) }) }, null, 2));
  } else {
    console.error("Usage: learnings.mjs add --insight \"...\" | search <query> | recent [--limit N]");
    process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
