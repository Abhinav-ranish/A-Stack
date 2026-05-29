#!/usr/bin/env node
// A-Stack status line. Two styles, every value real (no fake panels):
//
//   minimal (default):
//     ▊ A-Stack │ ⎇ main │ Opus 4.7 │ $0.42 │ ⧉ 2 │ ⊞ dashboard
//
//   rich (ASTACK_STATUSLINE=rich): the minimal line, plus a project line:
//     ▊ A-Stack │ ⎇ main │ Opus 4.7 │ $0.42 │ ⧉ 2 │ ⊞ dashboard
//     📁 project1 │ phase 2 │ ⏳ 3/7 │ 🛡 pass │ 🧠 12 │ 🎯 4
//
// Must-haves (both styles): framework name, git branch, model, session cost,
// parallel-session count, clickable dashboard link.
//
// Claude Code pipes a JSON event on stdin; stdout becomes the status line.
// Never crashes; respects NO_COLOR. Parallel sessions are counted via a
// heartbeat: each render touches ASTACK_SESSIONS_DIR/<id> and we count the files
// touched in the last 5 minutes.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { activeAgents } from "./agent-counter.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const stackRoot = process.env.ASTACK_ROOT || resolve(here, "..");
const STYLE = (process.env.ASTACK_STATUSLINE || "minimal").toLowerCase();
const COLOR = !process.env.NO_COLOR;
const DASH_PORT = process.env.ASTACK_DASHBOARD_PORT || "4317";

function paint(code, text) {
  return COLOR ? `\x1b[${code}m${text}\x1b[0m` : `${text}`;
}
const dim = (t) => paint("2", t);
const SEP = dim(" │ ");

// OSC-8 hyperlink: clickable in iTerm2, Terminal.app, VSCode, WezTerm, Kitty;
// degrades to plain visible text where unsupported.
function link(url, text) {
  return COLOR ? `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\` : text;
}

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}
function readText(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}
function parseState(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^-\s*([^:]+):\s*(.+)$/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}
function git(targetRoot, gitArgs) {
  const r = spawnSync("git", ["-C", targetRoot, ...gitArgs], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : "";
}

function branchSegment(targetRoot) {
  if (git(targetRoot, ["rev-parse", "--is-inside-work-tree"]) !== "true") return "";
  const branch = git(targetRoot, ["rev-parse", "--abbrev-ref", "HEAD"]) || "?";
  const dirty = git(targetRoot, ["status", "--porcelain"]).split(/\r?\n/).filter(Boolean).length;
  const label = paint("1;34", `⎇ ${branch}`);
  return dirty ? `${label} ${paint("33", `±${dirty}`)}` : label;
}

function countKnowledge() {
  try {
    const dir = join(stackRoot, "knowledge");
    if (!existsSync(dir)) return 0;
    const walk = (d) =>
      readdirSync(d, { withFileTypes: true }).reduce((n, e) => {
        const p = join(d, e.name);
        if (e.isDirectory()) return n + walk(p);
        return n + (e.isFile() && e.name.endsWith(".md") ? 1 : 0);
      }, 0);
    return walk(dir);
  } catch {
    return 0;
  }
}
function promotedPatterns() {
  const state = readJson(join(stackRoot, "knowledge", "learning", ".learning-state.json"));
  return state?.patterns ? state.patterns.filter((p) => p.promoted).length : 0;
}
function gateSegment(targetRoot) {
  const text = readText(join(targetRoot, ".planning", "GATES.md"));
  if (!text) return "";
  const fails = (text.match(/\b(fail|failed|blocked)\b/gi) || []).length;
  if (fails > 0) return paint("1;31", `🛡 ${fails} fail`);
  if (/\b(pass|passed|ok)\b/i.test(text)) return paint("1;32", "🛡 pass");
  return "";
}

// The minimal line — the must-haves, shown in both styles.
function minimalLine(payload, targetRoot) {
  const parts = [paint("1;35", "▊ A-Stack")];

  const branch = branchSegment(targetRoot);
  if (branch) parts.push(branch);

  const model = payload?.model?.display_name;
  if (model) parts.push(paint("35", model));

  const cost = payload?.cost?.total_cost_usd;
  if (typeof cost === "number") parts.push(paint("1;37", `$${cost.toFixed(2)}`));

  // Parallel A-Stack subagents running right now (SubagentStart/Stop tracked).
  const agents = activeAgents();
  parts.push(paint("36", `⧉ ${Math.max(1, agents)}`));

  parts.push(paint("36", link(`http://localhost:${DASH_PORT}`, "⊞ dashboard")));

  return parts.join(SEP);
}

// The rich project line — only the real signals A-Stack tracks on disk.
function projectLine(targetRoot) {
  const planning = join(targetRoot, ".planning");
  const state = parseState(readText(join(planning, "STATE.md")));
  const projectText = readText(join(planning, "PROJECT.md"));
  const name = state.project || projectText.match(/^#\s+(.+)$/m)?.[1] || basename(targetRoot) || "project";

  const parts = [paint("1;36", `📁 ${name}`)];
  if (state.current_phase) parts.push(paint("34", `phase ${state.current_phase}`));

  const tasks = readJson(join(planning, "TASKS.json"));
  if (tasks?.tasks?.length) {
    const open = tasks.tasks.filter((t) => t.status !== "done").length;
    parts.push(paint("33", `⏳ ${open}/${tasks.tasks.length}`));
  }

  const gate = gateSegment(targetRoot);
  if (gate) parts.push(gate);

  const mem = countKnowledge();
  if (mem > 0) parts.push(paint("36", `🧠 ${mem}`));

  const promoted = promotedPatterns();
  if (promoted > 0) parts.push(paint("32", `🎯 ${promoted}`));

  return parts.join(SEP);
}

// The statusline is the one place that sees Claude Code's live session cost, so
// it persists it where the dashboard can read it (only if .planning exists — we
// never litter non-A-Stack dirs).
function persistCost(targetRoot, payload) {
  try {
    const cost = payload?.cost?.total_cost_usd;
    if (typeof cost !== "number") return;
    const planning = join(targetRoot, ".planning");
    if (!existsSync(planning)) return;
    writeFileSync(
      join(planning, ".astack-cost.json"),
      JSON.stringify({
        costUsd: cost,
        model: payload?.model?.display_name || "",
        durationMs: payload?.cost?.total_duration_ms || 0,
        sessionId: payload?.session_id || "",
        updatedAt: new Date().toISOString(),
      }),
    );
  } catch {
    /* best effort */
  }
}

function build(payload) {
  const targetRoot = payload?.workspace?.current_dir || payload?.cwd || process.cwd();
  persistCost(targetRoot, payload);
  const minimal = minimalLine(payload, targetRoot);
  if (STYLE === "rich") return `${minimal}\n${projectLine(targetRoot)}`;
  return minimal;
}

try {
  process.stdout.write(build(JSON.parse(readStdin() || "{}")));
} catch {
  process.stdout.write(paint("1;35", "▊ A-Stack"));
}
process.exit(0);
