import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { recentLearnings, searchLearnings } from "../scripts/learnings.mjs";

const SCRIPT = resolve("scripts/learnings.mjs");

function run(args, root) {
  return spawnSync("node", [SCRIPT, ...args, "--root", root], { encoding: "utf8" });
}

test("learnings add appends and search/recent read back", () => {
  const root = mkdtempSync(join(tmpdir(), "a-stack-learn-"));
  try {
    const add = run(["add", "--insight", "build needs NODE_OPTIONS for migration", "--key", "mig", "--tags", "build migration"], root);
    assert.equal(add.status, 0, add.stderr);
    assert.equal(JSON.parse(add.stdout).total, 1);

    run(["add", "--insight", "playwright flakes without --workers=1", "--key", "pw", "--tags", "qa playwright"], root);

    const searched = searchLearnings({ root, query: "migration build" });
    assert.ok(searched.some((e) => e.key === "mig"));
    assert.ok(searched.every((e) => e.score > 0));

    const recent = recentLearnings({ root, limit: 1 });
    assert.equal(recent.length, 1);
    assert.equal(recent[0].key, "pw"); // most recent first
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("learnings add requires an insight and redacts secrets", () => {
  const root = mkdtempSync(join(tmpdir(), "a-stack-learn-r-"));
  try {
    assert.equal(run(["add"], root).status, 2);
    run(["add", "--insight", "the token sk-abcdef1234567890 unlocks staging"], root);
    const recent = recentLearnings({ root, limit: 1 });
    assert.match(recent[0].insight, /\[REDACTED_SECRET\]/);
    assert.doesNotMatch(recent[0].insight, /sk-abcdefg/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
