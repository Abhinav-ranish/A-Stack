import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { listAgents } from "./agent-counter.mjs";

export function ensureDir(path) {
  mkdirSync(dirname(path), { recursive: true });
}

export function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(path, value) {
  ensureDir(path);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function readText(path, fallback = "") {
  return existsSync(path) ? readFileSync(path, "utf8") : fallback;
}

export function writeText(path, value) {
  ensureDir(path);
  writeFileSync(path, `${value.trim()}\n`);
}

export function planningPath(targetRoot, file) {
  return join(targetRoot, ".planning", file);
}

export function loadTasks(targetRoot) {
  return readJson(planningPath(targetRoot, "TASKS.json"), { version: 1, tasks: [] });
}

export function saveTasks(targetRoot, tasks) {
  writeJson(planningPath(targetRoot, "TASKS.json"), tasks);
}

export function loadEvents(targetRoot) {
  return readJson(planningPath(targetRoot, "A-STACK-EVENTS.json"), { version: 1, events: [] });
}

export function saveEvents(targetRoot, events) {
  writeJson(planningPath(targetRoot, "A-STACK-EVENTS.json"), events);
}

export function addTask(targetRoot, input) {
  const state = loadTasks(targetRoot);
  const now = new Date().toISOString();
  const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const task = {
    id,
    title: input.title || "Untitled task",
    details: input.details || "",
    intent: input.intent || "route",
    agent: input.agent || "claude-code",
    priority: input.priority || "normal",
    status: input.status || "queued",
    createdAt: now,
    updatedAt: now,
  };
  state.tasks.push(task);
  saveTasks(targetRoot, state);
  return task;
}

export function updateTask(targetRoot, id, patch) {
  const state = loadTasks(targetRoot);
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return null;
  Object.assign(task, patch, { updatedAt: new Date().toISOString() });
  saveTasks(targetRoot, state);
  return task;
}

export function addEvent(targetRoot, input) {
  const state = loadEvents(targetRoot);
  const id = `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const event = {
    id,
    type: input.type || "note",
    title: input.title || input.type || "event",
    details: input.details || "",
    tokensIn: Number(input.tokensIn || 0),
    tokensOut: Number(input.tokensOut || 0),
    costUsd: Number(input.costUsd || 0),
    source: input.source || "manual",
    createdAt: new Date().toISOString(),
  };
  state.events.push(event);
  saveEvents(targetRoot, state);
  return event;
}

function parseStateMarkdown(text) {
  const state = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^-\s*([^:]+):\s*(.+)$/);
    if (match) state[match[1].trim()] = match[2].trim();
  }
  return state;
}

function parseRoadmap(text) {
  // Accept "## Phase 1: Title", "## Phase 1 — Title", "## Phase 1 - Title".
  return [...text.matchAll(/^##\s+Phase\s+(\d+)\s*[:—-]\s*(.+)$/gm)].map((match) => ({
    phase: Number(match[1]),
    title: match[2].trim(),
  }));
}

// Parse a "## Phase status" checklist like:
//   - [x] P0 Foundation — DONE
//   - [ ] P1 Connectors
// so the dashboard reflects real progress even when STATE.md has no
// "- current_phase: N" line.
function parsePhaseStatus(text) {
  const items = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*-\s*\[([ xX])\]\s*P?(\d+)\b(.*)$/);
    if (m) items.push({ done: m[1].toLowerCase() === "x", phase: Number(m[2]), label: m[3].trim() });
  }
  if (!items.length) return null;
  const done = items.filter((i) => i.done).length;
  const firstOpen = items.find((i) => !i.done);
  return { done, total: items.length, current: firstOpen ? firstOpen.phase : items[items.length - 1].phase, items };
}

// Per-phase status for the dashboard roadmap tracker, joining checklist state
// with roadmap titles.
function buildPhases(roadmap, phaseStatus) {
  const titleFor = (n) => roadmap.find((r) => r.phase === n)?.title || "";
  if (phaseStatus?.items?.length) {
    return phaseStatus.items.map((i) => ({
      phase: i.phase,
      title: titleFor(i.phase) || i.label || `Phase ${i.phase}`,
      status: i.done ? "done" : i.phase === phaseStatus.current ? "current" : "todo",
    }));
  }
  return roadmap.map((r) => ({ phase: r.phase, title: r.title, status: "todo" }));
}

// Recent git activity in the target repo for the dashboard.
function gitActivity(targetRoot) {
  const run = (gitArgs) => spawnSync("git", ["-C", targetRoot, ...gitArgs], { encoding: "utf8" });
  if (run(["rev-parse", "--is-inside-work-tree"]).status !== 0) {
    return { isRepo: false, branch: "", commits: [], changed: [] };
  }
  const branch = run(["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
  const US = String.fromCharCode(31); // unit separator — safe inside commit subjects
  const commits = run(["log", "-8", `--pretty=format:%h${US}%s${US}%cI`]).stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [hash, subject, at] = line.split(US);
      return { hash, subject, at };
    });
  const changed = run(["status", "--short"]).stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.trim())
    .slice(0, 40);
  return { isRepo: true, branch, commits, changed };
}

function walkMarkdown(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walkMarkdown(path);
    if (entry.isFile() && entry.name.endsWith(".md")) return [path];
    return [];
  });
}

function latestGateReport(targetRoot) {
  const text = readText(planningPath(targetRoot, "GATES.md"));
  const statuses = [...text.matchAll(/^-\s+([^:]+):\s+([^(\n]+)(?:\s+\((\d+)\s+critical,\s+(\d+)\s+findings\))?/gm)].map((match) => ({
    gate: match[1],
    status: match[2].trim(),
    critical: match[3] ? Number(match[3]) : null,
    findings: match[4] ? Number(match[4]) : null,
  }));
  return { exists: Boolean(text), statuses };
}

function humanizeMs(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// Prefer the live Claude Code session cost (written by the status line) over the
// manual token-event tally.
function costSummary({ targetRoot, tokenTotals }) {
  const base = {
    tokensIn: tokenTotals.tokensIn,
    tokensOut: tokenTotals.tokensOut,
    totalTokens: tokenTotals.tokensIn + tokenTotals.tokensOut,
  };
  const file = readJson(join(targetRoot, ".planning", ".astack-cost.json"), null);
  if (file && typeof file.costUsd === "number") {
    return {
      ...base,
      costUsd: Number(file.costUsd.toFixed(4)),
      measured: true,
      model: file.model || "",
      durationLabel: file.durationMs ? humanizeMs(file.durationMs) : "",
      source: "session (statusline)",
    };
  }
  return {
    ...base,
    costUsd: Number(tokenTotals.costUsd.toFixed(4)),
    measured: tokenTotals.tokensIn + tokenTotals.tokensOut > 0 || tokenTotals.costUsd > 0,
    model: "",
    durationLabel: "",
    source: "manual (event --tokens-in/--tokens-out)",
  };
}

export function collectDashboardState({ targetRoot, stackRoot }) {
  const planning = join(targetRoot, ".planning");
  const projectText = readText(join(planning, "PROJECT.md"));
  const stateText = readText(join(planning, "STATE.md"));
  const roadmapText = readText(join(planning, "ROADMAP.md"));
  const parsedState = parseStateMarkdown(stateText);
  const roadmap = parseRoadmap(roadmapText);
  const phaseStatus = parsePhaseStatus(stateText);
  const stageHeading = (stateText.match(/^##\s+Current stage\s*\r?\n+([^\n#]+)/m)?.[1] || "").trim();
  const currentPhase = Number(parsedState.current_phase || phaseStatus?.current || 0);
  const currentRoadmap = roadmap.find((item) => item.phase === currentPhase) || roadmap[0] || null;
  const tasks = loadTasks(targetRoot).tasks;
  const events = loadEvents(targetRoot).events;
  const learning = readJson(join(stackRoot, "knowledge", "learning", ".learning-state.json"), { trajectories: [], patterns: [] });
  const memoryFiles = walkMarkdown(join(stackRoot, "knowledge"));
  const gateReport = latestGateReport(targetRoot);

  const eventCounts = events.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
  }, {});
  const tokenTotals = events.reduce(
    (acc, event) => {
      acc.tokensIn += Number(event.tokensIn || 0);
      acc.tokensOut += Number(event.tokensOut || 0);
      acc.costUsd += Number(event.costUsd || 0);
      return acc;
    },
    { tokensIn: 0, tokensOut: 0, costUsd: 0 },
  );
  const toolActivity = events.reduce(
    (acc, event) => {
      if (event.type !== "tool-use") return acc;
      acc.total += 1;
      acc.byTool[event.toolName] = (acc.byTool[event.toolName] || 0) + 1;
      if (event.success === false) acc.errors += 1;
      return acc;
    },
    { total: 0, errors: 0, byTool: {} },
  );

  const nodes = [
    { id: "router", label: "Router", group: "runtime" },
    { id: "planning", label: "GSD Planning", group: "planning" },
    { id: "execute", label: "Swarm-Lite Execute", group: "runtime" },
    { id: "security", label: "Security Gates", group: "gate" },
    { id: "qa", label: "Browser QA", group: "gate" },
    { id: "seo", label: "SEO Audit", group: "gate" },
    { id: "ship", label: "Ship Flow", group: "release" },
    { id: "memory", label: "Markdown Memory", group: "memory" },
    { id: "learning", label: "Self-Learning", group: "memory" },
    ...tasks.slice(0, 12).map((task) => ({ id: task.id, label: task.title, group: "task" })),
  ];
  const edges = [
    ["router", "planning"],
    ["planning", "execute"],
    ["execute", "security"],
    ["security", "qa"],
    ["qa", "seo"],
    ["seo", "ship"],
    ["memory", "router"],
    ["learning", "router"],
    ["execute", "learning"],
    ...tasks.slice(0, 12).map((task) => ["planning", task.id]),
  ].map(([from, to]) => ({ from, to }));

  return {
    generatedAt: new Date().toISOString(),
    targetRoot,
    project: {
      name: parsedState.project || projectText.match(/^#\s+(.+)$/m)?.[1] || "Uninitialized project",
      status: parsedState.status || "unknown",
      currentPhase,
      currentStage: [
        currentRoadmap?.title || stageHeading || "Not planned",
        phaseStatus ? `${phaseStatus.done}/${phaseStatus.total} phases done` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      phasesDone: phaseStatus?.done || 0,
      phasesTotal: phaseStatus?.total || roadmap.length || 0,
      nextAction: parsedState.next_action || stageHeading || "Initialize or route the next task.",
      planningExists: existsSync(planning),
    },
    tasks: {
      total: tasks.length,
      queued: tasks.filter((task) => task.status === "queued").length,
      inProgress: tasks.filter((task) => task.status === "in-progress").length,
      done: tasks.filter((task) => task.status === "done").length,
      items: tasks.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    },
    quality: {
      vulnerabilitiesPatched: eventCounts["vulnerability-patched"] || 0,
      slopRemoved: eventCounts["slop-removed"] || 0,
      securityFindings: gateReport.statuses.find((item) => item.gate === "security-scan")?.findings || 0,
      criticalSecurity: gateReport.statuses.find((item) => item.gate === "security-scan")?.critical || 0,
      gates: gateReport.statuses,
    },
    costs: costSummary({ targetRoot, tokenTotals }),
    activity: toolActivity,
    memory: {
      markdownFiles: memoryFiles.length,
      trajectories: learning.trajectories?.length || 0,
      patterns: learning.patterns?.length || 0,
      promotedPatterns: learning.patterns?.filter((pattern) => pattern.promoted).length || 0,
      files: memoryFiles.map((file) => relative(stackRoot, file)).slice(0, 20),
    },
    phases: buildPhases(roadmap, phaseStatus),
    agents: listAgents(),
    git: gitActivity(targetRoot),
    graph: { nodes, edges },
    events: events.slice().reverse().slice(0, 50),
  };
}

export function runSecurityScan({ targetRoot, stackRoot }) {
  const result = spawnSync("node", [join(stackRoot, "scripts", "security-scan.mjs"), targetRoot], {
    cwd: stackRoot,
    encoding: "utf8",
  });
  return {
    status: result.status,
    data: result.stdout ? JSON.parse(result.stdout) : { findings: [], critical: 0 },
  };
}
