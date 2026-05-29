import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

function run(args, root) {
  return JSON.parse(
    execFileSync("node", ["scripts/learning.mjs", ...args, "--root", root], {
      cwd: process.cwd(),
      encoding: "utf8",
    }),
  );
}

test("records trajectories, recommends patterns, and optimizes promoted memory", () => {
  const root = mkdtempSync(join(tmpdir(), "a-stack-learning-"));
  mkdirSync(join(root, "knowledge", "learning"), { recursive: true });

  try {
    const first = run(
      [
        "record",
        "--task",
        "build auth dashboard",
        "--domain",
        "frontend",
        "--outcome",
        "success",
        "--quality",
        "0.9",
        "--pattern",
        "Run browser QA after layout changes",
      ],
      root,
    );
    assert.ok(first.recorded.startsWith("traj-"));

    run(
      [
        "record",
        "--task",
        "fix dashboard layout",
        "--domain",
        "frontend",
        "--outcome",
        "success",
        "--quality",
        "0.85",
        "--pattern",
        "Run browser QA after layout changes",
      ],
      root,
    );

    const recommendations = run(["recommend", "frontend browser layout"], root);
    assert.equal(recommendations.results[0].promoted, true);
    assert.match(recommendations.results[0].pattern, /browser QA/);

    const optimized = run(["optimize"], root);
    assert.equal(optimized.promotedTotal, 1);
    assert.ok(existsSync(join(root, "knowledge", "learning", "optimizer-report.md")));

    const patterns = readFileSync(join(root, "knowledge", "learning", "patterns.md"), "utf8");
    assert.match(patterns, /Run browser QA after layout changes/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("pattern keys dedupe across word orderings", () => {
  const root = mkdtempSync(join(tmpdir(), "a-stack-learning-dedupe-"));
  mkdirSync(join(root, "knowledge", "learning"), { recursive: true });
  try {
    run(
      [
        "record", "--task", "x", "--domain", "frontend", "--outcome", "success",
        "--quality", "0.8", "--pattern", "Run browser QA after layout changes",
      ],
      root,
    );
    run(
      [
        "record", "--task", "y", "--domain", "frontend", "--outcome", "success",
        "--quality", "0.7", "--pattern", "After layout changes run browser QA",
      ],
      root,
    );
    const status = JSON.parse(
      execFileSync("node", ["scripts/learning.mjs", "status", "--root", root], {
        cwd: process.cwd(), encoding: "utf8",
      }),
    );
    assert.equal(status.patterns, 1, "same pattern with different word order should share a key");
    assert.equal(status.promoted, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("repeated failures demote a previously promoted pattern", () => {
  const root = mkdtempSync(join(tmpdir(), "a-stack-learning-demote-"));
  mkdirSync(join(root, "knowledge", "learning"), { recursive: true });
  try {
    run(["record", "--task", "ok1", "--domain", "ops", "--outcome", "success", "--quality", "0.9", "--pattern", "Use shadow tables for renames"], root);
    run(["record", "--task", "ok2", "--domain", "ops", "--outcome", "success", "--quality", "0.85", "--pattern", "Use shadow tables for renames"], root);
    let s = JSON.parse(execFileSync("node", ["scripts/learning.mjs", "status", "--root", root], { cwd: process.cwd(), encoding: "utf8" }));
    assert.equal(s.promoted, 1);

    run(["record", "--task", "bad1", "--domain", "ops", "--outcome", "failure", "--quality", "0.1", "--pattern", "Use shadow tables for renames"], root);
    run(["record", "--task", "bad2", "--domain", "ops", "--outcome", "failure", "--quality", "0.1", "--pattern", "Use shadow tables for renames"], root);
    const opt = JSON.parse(execFileSync("node", ["scripts/learning.mjs", "optimize", "--root", root], { cwd: process.cwd(), encoding: "utf8" }));
    assert.equal(opt.promotedTotal, 0, "pattern should be demoted after repeated failures");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
