#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const command = args[0] || "status";

function readFlag(name, fallback = "") {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return args[index + 1] || fallback;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

function rootDir() {
  return readFlag("root", process.env.ASTACK_ROOT || process.cwd());
}

function paths(root) {
  const dir = join(root, "knowledge", "learning");
  return {
    dir,
    state: join(dir, ".learning-state.json"),
    trajectories: join(dir, "trajectories.md"),
    patterns: join(dir, "patterns.md"),
    report: join(dir, "optimizer-report.md"),
  };
}

function ensure(root) {
  const p = paths(root);
  mkdirSync(p.dir, { recursive: true });
  if (!existsSync(p.trajectories)) writeFileSync(p.trajectories, "# Learning Trajectories\n\n");
  if (!existsSync(p.patterns)) writeFileSync(p.patterns, "# Learned Patterns\n\n");
  if (!existsSync(p.state)) writeFileSync(p.state, JSON.stringify({ version: 1, trajectories: [], patterns: [] }, null, 2));
  return p;
}

function loadState(root) {
  const p = ensure(root);
  return JSON.parse(readFileSync(p.state, "utf8"));
}

function saveState(root, state) {
  const p = ensure(root);
  writeFileSync(p.state, `${JSON.stringify(state, null, 2)}\n`);
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

function append(file, content) {
  const prior = existsSync(file) ? readFileSync(file, "utf8") : "";
  writeFileSync(file, `${prior.trimEnd()}\n\n${content.trim()}\n`);
}

function patternKey(domain, pattern) {
  const stop = new Set(["the", "and", "for", "with", "from", "into", "that", "this", "then", "when", "after", "before", "a", "an"]);
  const tokens = tokenize(pattern)
    .filter((token) => !stop.has(token) && token.length > 2)
    .slice()
    .sort()
    .slice(0, 12);
  return `${domain}:${tokens.join("-")}`;
}

function record(root) {
  const p = ensure(root);
  const state = loadState(root);
  const task = redact(readFlag("task", "unspecified task"));
  const domain = readFlag("domain", "general").toLowerCase();
  const outcome = readFlag("outcome", "success").toLowerCase();
  const quality = Math.max(0, Math.min(1, Number(readFlag("quality", outcome === "success" ? "0.7" : "0.2"))));
  const pattern = redact(readFlag("pattern", ""));
  const notes = redact(readFlag("notes", ""));
  const tags = tokenize(readFlag("tags", `${domain} ${outcome}`));
  const id = `traj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  const trajectory = { id, task, domain, outcome, quality, pattern, notes, tags, createdAt: now };
  state.trajectories.push(trajectory);

  if (pattern) {
    const key = patternKey(domain, pattern);
    let stored = state.patterns.find((item) => item.key === key);
    if (!stored) {
      stored = {
        key,
        domain,
        pattern,
        tags,
        uses: 0,
        successes: 0,
        failures: 0,
        avgQuality: 0,
        promoted: false,
        createdAt: now,
        updatedAt: now,
      };
      state.patterns.push(stored);
    }
    stored.uses += 1;
    stored.successes += outcome === "success" ? 1 : 0;
    stored.failures += outcome === "failure" ? 1 : 0;
    stored.avgQuality = Number((((stored.avgQuality * (stored.uses - 1)) + quality) / stored.uses).toFixed(3));
    stored.updatedAt = now;
    stored.tags = [...new Set([...stored.tags, ...tags])];
    const successRate = stored.uses ? stored.successes / stored.uses : 0;
    const shouldPromote = stored.uses >= 2 && stored.avgQuality >= 0.6 && successRate >= 0.5;
    const shouldDemote = stored.failures > stored.successes || stored.avgQuality < 0.4;
    stored.promoted = shouldPromote && !shouldDemote;
  }

  saveState(root, state);
  append(
    p.trajectories,
    `## ${now} - ${task}

- id: ${id}
- domain: ${domain}
- outcome: ${outcome}
- quality: ${quality}
- tags: ${tags.join(", ")}
- pattern: ${pattern || "none"}
- notes: ${notes || "none"}`,
  );

  console.log(JSON.stringify({ recorded: id, promotedPatterns: state.patterns.filter((item) => item.promoted).length }, null, 2));
}

function recommend(root, query) {
  const state = loadState(root);
  const q = tokenize(query);
  const results = state.patterns
    .map((pattern) => {
      const haystack = new Set(tokenize(`${pattern.domain} ${pattern.pattern} ${pattern.tags.join(" ")}`));
      const lexical = q.reduce((sum, token) => sum + (haystack.has(token) ? 1 : 0), 0);
      const successRate = pattern.uses ? pattern.successes / pattern.uses : 0;
      const score = lexical * 2 + pattern.avgQuality + successRate + (pattern.promoted ? 1 : 0);
      return { ...pattern, successRate: Number(successRate.toFixed(3)), score: Number(score.toFixed(3)) };
    })
    .filter((pattern) => pattern.score > 0)
    .sort((a, b) => b.score - a.score || b.avgQuality - a.avgQuality)
    .slice(0, 8)
    .map(({ key, domain, pattern, uses, successes, failures, avgQuality, promoted, successRate, score }) => ({
      key,
      domain,
      pattern,
      uses,
      successes,
      failures,
      avgQuality,
      successRate,
      promoted,
      score,
    }));
  console.log(JSON.stringify({ query, results }, null, 2));
}

function optimize(root) {
  const p = ensure(root);
  const state = loadState(root);
  const now = new Date().toISOString();
  let promoted = 0;
  let demoted = 0;

  for (const pattern of state.patterns) {
    const successRate = pattern.uses ? pattern.successes / pattern.uses : 0;
    const shouldPromote = pattern.uses >= 2 && pattern.avgQuality >= 0.6 && successRate >= 0.5;
    const shouldDemote = pattern.failures > pattern.successes || pattern.avgQuality < 0.4;
    const wasPromoted = pattern.promoted;
    const willBePromoted = shouldPromote && !shouldDemote;
    if (willBePromoted && !wasPromoted) promoted += 1;
    if (!willBePromoted && wasPromoted) demoted += 1;
    pattern.promoted = willBePromoted;
    pattern.updatedAt = now;
  }

  const promotedPatterns = state.patterns
    .filter((pattern) => pattern.promoted)
    .sort((a, b) => b.avgQuality - a.avgQuality || b.uses - a.uses);

  const avoidPatterns = state.patterns
    .filter((pattern) => pattern.failures > pattern.successes && pattern.avgQuality < 0.5)
    .sort((a, b) => b.failures - a.failures);

  saveState(root, state);

  const patternsMd = [
    "# Learned Patterns",
    "tags: reasoningbank patterns optimization",
    "",
    "Promoted patterns from successful trajectories.",
    "",
    ...promotedPatterns.map(
      (pattern) => `## ${pattern.domain} - ${pattern.pattern}

- key: ${pattern.key}
- uses: ${pattern.uses}
- success rate: ${pattern.uses ? (pattern.successes / pattern.uses).toFixed(2) : "0.00"}
- average quality: ${pattern.avgQuality}
- tags: ${pattern.tags.join(", ")}`,
    ),
    avoidPatterns.length ? "\n# Avoid List\n" : "",
    ...avoidPatterns.map(
      (pattern) => `## Avoid: ${pattern.domain} - ${pattern.pattern}

- failures: ${pattern.failures}
- average quality: ${pattern.avgQuality}`,
    ),
  ].join("\n");

  writeFileSync(p.patterns, `${patternsMd.trim()}\n`);

  const report = `# Optimizer Report
tags: learning optimizer report

## ${now}

- trajectories: ${state.trajectories.length}
- patterns: ${state.patterns.length}
- promoted this run: ${promoted}
- demoted this run: ${demoted}
- promoted total: ${promotedPatterns.length}
- avoid-list total: ${avoidPatterns.length}

## Recommendation

Use promoted patterns before planning and execution. Review avoid-list patterns when a similar task fails or repeats.`;

  writeFileSync(p.report, `${report}\n`);
  console.log(JSON.stringify({ promoted, demoted, promotedTotal: promotedPatterns.length, report: "knowledge/learning/optimizer-report.md" }, null, 2));
}

function status(root) {
  const state = loadState(root);
  console.log(
    JSON.stringify(
      {
        trajectories: state.trajectories.length,
        patterns: state.patterns.length,
        promoted: state.patterns.filter((pattern) => pattern.promoted).length,
      },
      null,
      2,
    ),
  );
}

const root = rootDir();

if (command === "record") {
  record(root);
} else if (command === "recommend") {
  recommend(root, args.filter((arg, index) => index > 0 && !arg.startsWith("--") && !args[index - 1]?.startsWith("--")).join(" "));
} else if (command === "optimize") {
  optimize(root);
} else if (command === "status") {
  status(root);
} else {
  console.error("Usage: learning.mjs record|recommend|optimize|status [--root <dir>]");
  process.exit(2);
}
