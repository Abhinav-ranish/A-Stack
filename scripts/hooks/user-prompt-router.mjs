#!/usr/bin/env node
// UserPromptSubmit hook: classifies the user's prompt with the A-Stack router
// and injects the matched workflow path as additional context.
//
// Hook contract: receives a JSON event on stdin with shape { prompt: string, ... }
// and prints additional context to stdout (read by Claude Code as a system
// reminder). Stays silent if the router has no opinion.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { route } from "../router.mjs";
import { searchMemory } from "../memory-index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const stackRoot = process.env.ASTACK_ROOT || resolve(here, "..", "..");

// Curated from claude-flow's "[INTELLIGENCE] pattern suggestions": surface the
// most relevant saved memory for the prompt. Honest token-bag lexical recall —
// not vector/RAG. Guarded so a recall failure never blocks the prompt.
function recallMemory(prompt) {
  try {
    const { results } = searchMemory({ query: prompt, root: stackRoot, limit: 3 });
    return results.filter((r) => r.score > 1);
  } catch {
    return [];
  }
}

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

let payload = {};
try {
  payload = JSON.parse(readStdin() || "{}");
} catch {
  payload = {};
}

const prompt = (payload.prompt || payload.user_prompt || "").trim();
if (!prompt) process.exit(0);

const result = route(prompt);
if (result.confidence === "none") process.exit(0);

const modeNote =
  result.mode === "review-only"
    ? "  mode: review-only — DO NOT make changes; report findings only."
    : result.mode === "interactive"
      ? "  mode: interactive — confirm each non-trivial change with the user before applying."
      : `  mode: ${result.mode}`;

const memory = recallMemory(prompt);
const memoryLines = memory.length
  ? ["", "  relevant memory:", ...memory.map((m) => `    - ${m.path} — ${m.title}`)]
  : [];

const message = [
  "[a-stack] Router suggests:",
  `  intent: ${result.intent} (confidence: ${result.confidence})`,
  `  workflow: ${result.workflow}`,
  modeNote,
  result.matches?.length ? `  matched: ${result.matches.join(", ")}` : null,
  ...memoryLines,
  "",
  `Read ${join(stackRoot, result.workflow)} before acting. Honor the hard gates listed in SKILL.md.`,
]
  .filter(Boolean)
  .join("\n");

process.stdout.write(message);
process.stdout.write("\n");
