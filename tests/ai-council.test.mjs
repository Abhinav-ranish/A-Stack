import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

test("ai-council dry-run writes a verdict file with both reviewers", () => {
  const dir = mkdtempSync(join(tmpdir(), "a-stack-council-"));
  try {
    const out = JSON.parse(
      execFileSync(
        "node",
        ["scripts/ai-council.mjs", "review", "--target", dir, "--focus", "hero", "--dry-run"],
        { cwd: process.cwd(), encoding: "utf8" },
      ),
    );
    assert.equal(out.status, "ok");
    assert.equal(out.rounds.round1.length, 2);
    assert.equal(out.rounds.round2.length, 2);
    assert.ok(existsSync(out.verdictPath));
    const verdict = readFileSync(out.verdictPath, "utf8");
    assert.match(verdict, /Codex Architect/);
    assert.match(verdict, /Gemini Visionary/);
    assert.match(verdict, /Claude Synthesis/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ai-council --solo skips round 2 cross-talk", () => {
  const dir = mkdtempSync(join(tmpdir(), "a-stack-council-solo-"));
  try {
    const out = JSON.parse(
      execFileSync(
        "node",
        ["scripts/ai-council.mjs", "review", "--target", dir, "--dry-run", "--solo"],
        { cwd: process.cwd(), encoding: "utf8" },
      ),
    );
    assert.equal(out.rounds.round1.length, 2);
    assert.equal(out.rounds.round2.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
