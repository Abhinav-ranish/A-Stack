#!/usr/bin/env node
// Continuous-checkpoint commit helper. Curated from gstack's "Continuous
// Checkpoint Mode": commit completed logical units with a WIP: prefix and an
// embedded [a-stack-context] block, so a future session (or /ship) can read the
// decisions/remaining/tried trail. Honest + safe: never `git add -A`, only
// stages files you name (or what is already staged), refuses empty commits.
//
// Commands:
//   commit  --target <repo> --message "..." [--decisions ...] [--remaining ...]
//           [--tried ...] [--skill ...] [--files "a b c"] [--push]
//   mode    --target <repo> [continuous|explicit]   # get (no arg) or set
//
// `mode` resolves the checkpoint mode from ASTACK_CHECKPOINT_MODE, then
// .a-stack/config.json {"checkpointMode": ...}, default "explicit".

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const command = args[0] || "help";

function flag(name, fallback = "") {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return args[i + 1] ?? fallback;
}
function boolFlag(name) {
  return args.includes(`--${name}`);
}
function positional() {
  return args.slice(1).filter((a, i) => !a.startsWith("--") && !args.slice(1)[i - 1]?.startsWith("--"));
}

function git(target, gitArgs) {
  return spawnSync("git", ["-C", target, ...gitArgs], { encoding: "utf8" });
}

function isGitRepo(target) {
  return git(target, ["rev-parse", "--is-inside-work-tree"]).status === 0;
}

function configPath(target) {
  return join(target, ".a-stack", "config.json");
}

function readMode(target) {
  if (process.env.ASTACK_CHECKPOINT_MODE) return process.env.ASTACK_CHECKPOINT_MODE;
  try {
    const cfg = JSON.parse(readFileSync(configPath(target), "utf8"));
    return cfg.checkpointMode || "explicit";
  } catch {
    return "explicit";
  }
}

function writeMode(target, mode) {
  const p = configPath(target);
  let cfg = {};
  try {
    cfg = JSON.parse(readFileSync(p, "utf8"));
  } catch {
    cfg = {};
  }
  cfg.checkpointMode = mode;
  mkdirSync(join(target, ".a-stack"), { recursive: true });
  writeFileSync(p, `${JSON.stringify(cfg, null, 2)}\n`);
  return cfg;
}

function buildMessage({ message, decisions, remaining, tried, skill }) {
  const ctx = ["[a-stack-context]"];
  ctx.push(`Decisions: ${decisions || "none recorded"}`);
  ctx.push(`Remaining: ${remaining || "none recorded"}`);
  if (tried) ctx.push(`Tried: ${tried}`);
  if (skill) ctx.push(`Skill: ${skill}`);
  ctx.push("[/a-stack-context]");
  return `WIP: ${message}\n\n${ctx.join("\n")}`;
}

function doCommit() {
  const target = flag("target", process.cwd());
  const message = flag("message");
  if (!message) {
    console.error("checkpoint commit: --message is required");
    process.exit(2);
  }
  if (!isGitRepo(target)) {
    console.error(`checkpoint commit: ${target} is not a git repository`);
    process.exit(2);
  }

  const files = flag("files").split(/\s+/).filter(Boolean);
  if (files.length) {
    const add = git(target, ["add", "--", ...files]);
    if (add.status !== 0) {
      console.error(`checkpoint commit: git add failed: ${add.stderr.trim()}`);
      process.exit(1);
    }
  }

  // Refuse an empty commit — staging must be intentional, never `git add -A`.
  const staged = git(target, ["diff", "--cached", "--name-only"]).stdout.split(/\r?\n/).filter(Boolean);
  if (staged.length === 0) {
    console.error("checkpoint commit: nothing staged. Pass --files \"a b\" or stage changes first (never git add -A).");
    process.exit(1);
  }

  const msg = buildMessage({
    message,
    decisions: flag("decisions"),
    remaining: flag("remaining"),
    tried: flag("tried"),
    skill: flag("skill"),
  });
  const commit = git(target, ["commit", "-m", msg]);
  if (commit.status !== 0) {
    console.error(`checkpoint commit: git commit failed: ${commit.stderr.trim()}`);
    process.exit(1);
  }
  const sha = git(target, ["rev-parse", "HEAD"]).stdout.trim();

  let pushed = false;
  if (boolFlag("push")) {
    const branch = git(target, ["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
    pushed = git(target, ["push", "origin", branch]).status === 0;
  }

  console.log(JSON.stringify({ committed: sha.slice(0, 12), files: staged, pushed }, null, 2));
}

function doMode() {
  const target = flag("target", process.cwd());
  const next = positional()[0];
  if (!next) {
    console.log(JSON.stringify({ checkpointMode: readMode(target) }, null, 2));
    return;
  }
  if (next !== "continuous" && next !== "explicit") {
    console.error("checkpoint mode: value must be 'continuous' or 'explicit'");
    process.exit(2);
  }
  const cfg = writeMode(target, next);
  console.log(JSON.stringify({ checkpointMode: cfg.checkpointMode }, null, 2));
}

if (command === "commit") doCommit();
else if (command === "mode") doMode();
else {
  console.error("Usage: checkpoint.mjs commit --message \"...\" [--decisions ...] [--remaining ...] [--tried ...] [--skill ...] [--files \"a b\"] [--push] [--target <repo>]\n       checkpoint.mjs mode [continuous|explicit] [--target <repo>]");
  process.exit(2);
}
