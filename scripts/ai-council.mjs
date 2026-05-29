#!/usr/bin/env node
// A-Stack AI Council — multi-model review pass.
//
// Calls `codex` and `gemini` CLIs if available. Skips cleanly with an
// install hint if either is missing. Claude (the calling agent) is
// expected to read the resulting verdict file and synthesize.
//
// Usage:
//   node scripts/ai-council.mjs review --url <url> [--focus "..."] [--out <path>]
//   node scripts/ai-council.mjs review --target <repo-or-file> [--focus "..."]
//
// The verdict markdown is written to <target>/.planning/AI-COUNCIL.md
// (or the path passed via --out) and is also printed to stdout as JSON.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const command = args[0] || "review";

function flag(name, fallback = "") {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const next = args[idx + 1];
  return next === undefined ? fallback : next;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

function commandExists(name) {
  return spawnSync("sh", ["-lc", `command -v ${name}`], { encoding: "utf8" }).status === 0;
}

const INVOCATIONS = {
  codex: [
    { args: ["exec", "--skip-git-repo-check", "-"], stdin: true },
    { args: ["exec", "-"], stdin: true },
    { args: ["--json", "-"], stdin: true },
    { args: [], stdin: true },
  ],
  gemini: [
    { args: ["-p", "@PROMPT@"], stdin: false },
    { args: ["--prompt", "@PROMPT@"], stdin: false },
    { args: [], stdin: true },
  ],
};

function runReviewer(bin, prompt) {
  const attempts = INVOCATIONS[bin] || [{ args: [], stdin: true }];
  let lastResult = null;
  for (const attempt of attempts) {
    const argv = attempt.args.map((a) => (a === "@PROMPT@" ? prompt : a));
    const opts = { encoding: "utf8", timeout: 120_000 };
    if (attempt.stdin) opts.input = prompt;
    const result = spawnSync(bin, argv, opts);
    if (result.error) {
      lastResult = { ok: false, exitCode: -1, stderr: String(result.error.message || result.error), stdout: "" };
      continue;
    }
    if (result.status === 0 && (result.stdout || "").trim()) {
      return {
        ok: true,
        exitCode: 0,
        stdout: (result.stdout || "").trim(),
        stderr: (result.stderr || "").trim(),
        invocation: `${bin} ${argv.slice(0, attempt.stdin ? argv.length : 1).join(" ")}`,
      };
    }
    lastResult = {
      ok: false,
      exitCode: result.status,
      stdout: (result.stdout || "").trim(),
      stderr: (result.stderr || "").trim(),
      invocation: `${bin} ${argv.slice(0, attempt.stdin ? argv.length : 1).join(" ")}`,
    };
  }
  return lastResult || { ok: false, exitCode: -1, stdout: "", stderr: "no invocations attempted" };
}

function basePrompt({ target, focus, round, peers }) {
  const peerSection = peers && peers.length
    ? `\n\nPEER REVIEW INPUT (cross-talk round 2):\n${peers.map((p) => `### ${p.name}\n${p.body}`).join("\n\n")}\n`
    : "";
  return `You are participating in an A-Stack AI Council review.

ROUND: ${round}
TARGET: ${target}
FOCUS: ${focus || "general UI/product quality"}

Respond with terse, actionable findings only. Use this exact structure:

## Findings
- <severity>: <one-line finding> — <file:line or selector if known>

## Top 3 Fixes
1. ...
2. ...
3. ...

## Skipped / Deferred
- ...

Keep total length under 400 words. No fluff, no praise.${peerSection}`;
}

function review() {
  const target = flag("target", flag("url", flag("path", process.cwd())));
  const focus = flag("focus", "");
  const outPath = flag("out", "");
  const skipPeers = hasFlag("solo");
  const dryRun = hasFlag("dry-run");

  const codexAvailable = dryRun ? true : commandExists("codex");
  const geminiAvailable = dryRun ? true : commandExists("gemini");

  const dryReview = (name, target, focus) => ({
    ok: true,
    exitCode: 0,
    stdout: `## Findings\n- medium: dry-run placeholder for ${name} reviewing ${target}\n\n## Top 3 Fixes\n1. Wire ${name} to a real CLI before relying on this output.\n2. Set ASTACK_COUNCIL_DRY=off to run live reviewers.\n3. Capture exit code + stderr on failure.\n\n## Skipped / Deferred\n- focus: ${focus || "(none)"}`,
    stderr: "",
    invocation: `${name} (dry-run)`,
  });

  if (!codexAvailable && !geminiAvailable) {
    const message = {
      status: "skipped",
      reason: "Neither `codex` nor `gemini` is on PATH.",
      install: {
        codex: "https://github.com/openai/codex (or `brew install codex`)",
        gemini: "https://github.com/google-gemini/gemini-cli",
      },
    };
    console.log(JSON.stringify(message, null, 2));
    process.exit(0);
  }

  const round1 = [];
  if (codexAvailable) {
    const result = dryRun
      ? dryReview("Codex Architect", target, focus)
      : runReviewer("codex", basePrompt({ target, focus, round: "1 (Codex Architect)" }));
    round1.push({ name: "Codex Architect", ...result });
  }
  if (geminiAvailable) {
    const result = dryRun
      ? dryReview("Gemini Visionary", target, focus)
      : runReviewer("gemini", basePrompt({ target, focus, round: "1 (Gemini Visionary)" }));
    round1.push({ name: "Gemini Visionary", ...result });
  }

  const round2 = [];
  if (!skipPeers && round1.length >= 2 && round1.every((r) => r.ok)) {
    const peers = round1.map((r) => ({ name: r.name, body: r.stdout }));
    if (codexAvailable) {
      const result = dryRun
        ? dryReview("Codex Architect (cross-talk)", target, focus)
        : runReviewer("codex", basePrompt({ target, focus, round: "2 cross-talk (Codex Architect)", peers }));
      round2.push({ name: "Codex Architect (cross-talk)", ...result });
    }
    if (geminiAvailable) {
      const result = dryRun
        ? dryReview("Gemini Visionary (cross-talk)", target, focus)
        : runReviewer("gemini", basePrompt({ target, focus, round: "2 cross-talk (Gemini Visionary)", peers }));
      round2.push({ name: "Gemini Visionary (cross-talk)", ...result });
    }
  }

  const now = new Date().toISOString();
  const sections = [];
  sections.push(`# A-Stack AI Council Verdict\n\n- target: ${target}\n- focus: ${focus || "(default)"}\n- generated: ${now}\n`);

  function appendRound(label, rows) {
    if (!rows.length) return;
    sections.push(`## ${label}\n`);
    for (const row of rows) {
      sections.push(`### ${row.name}${row.ok ? "" : " — error"}\n`);
      if (row.ok) {
        sections.push(row.stdout || "_(empty)_");
      } else {
        sections.push(`_exit ${row.exitCode}_\n\n${row.stderr || row.stdout || "(no output)"}`);
      }
      sections.push("");
    }
  }

  appendRound("Round 1", round1);
  appendRound("Round 2 (cross-talk)", round2);

  sections.push(`## Claude Synthesis

Claude (the calling agent) reads round 1 and round 2 above, then writes:

- Top 3 fixes
- Agreed findings (both reviewers said yes)
- Split decisions (note both opinions)
- Skipped / deferred items
- Implementation targets
`);

  const verdict = sections.join("\n").trim() + "\n";

  let writtenPath = null;
  if (outPath) {
    writtenPath = resolve(outPath);
  } else if (existsSync(join(target, ".planning")) || existsSync(target)) {
    const planning = join(target, ".planning");
    if (!existsSync(planning)) mkdirSync(planning, { recursive: true });
    writtenPath = join(planning, "AI-COUNCIL.md");
  }
  if (writtenPath) {
    mkdirSync(dirname(writtenPath), { recursive: true });
    writeFileSync(writtenPath, verdict);
  }

  const summary = {
    status: "ok",
    target,
    focus,
    reviewers: {
      codex: codexAvailable,
      gemini: geminiAvailable,
    },
    rounds: {
      round1: round1.map((r) => ({ name: r.name, ok: r.ok, exitCode: r.exitCode })),
      round2: round2.map((r) => ({ name: r.name, ok: r.ok, exitCode: r.exitCode })),
    },
    verdictPath: writtenPath,
  };

  console.log(JSON.stringify(summary, null, 2));
}

if (command === "review") {
  review();
} else {
  console.error("Usage: ai-council.mjs review --target <path|url> [--focus '...'] [--solo] [--out <file>]");
  process.exit(2);
}
