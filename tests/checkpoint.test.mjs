import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

const SCRIPT = resolve("scripts/checkpoint.mjs");

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "a-stack-cp-"));
  const git = (a) => spawnSync("git", ["-C", dir, ...a], { encoding: "utf8" });
  git(["init", "-q"]);
  git(["config", "user.email", "t@t.co"]);
  git(["config", "user.name", "t"]);
  git(["commit", "--allow-empty", "-q", "-m", "init"]);
  return { dir, git };
}

function run(args) {
  return spawnSync("node", [SCRIPT, ...args], { encoding: "utf8" });
}

test("checkpoint commit creates a WIP commit with embedded context block", () => {
  const { dir, git } = makeRepo();
  try {
    writeFileSync(join(dir, "a.txt"), "hello");
    const result = run(["commit", "--target", dir, "--message", "add a", "--remaining", "add b", "--files", "a.txt"]);
    assert.equal(result.status, 0, result.stderr);
    const parsed = JSON.parse(result.stdout);
    assert.deepEqual(parsed.files, ["a.txt"]);
    assert.equal(parsed.pushed, false);
    const msg = git(["log", "-1", "--format=%B"]).stdout;
    assert.match(msg, /^WIP: add a/);
    assert.match(msg, /\[a-stack-context\]/);
    assert.match(msg, /Remaining: add b/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("checkpoint commit refuses when nothing is staged", () => {
  const { dir } = makeRepo();
  try {
    const result = run(["commit", "--target", dir, "--message", "empty"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /nothing staged/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("checkpoint commit requires a message", () => {
  const { dir } = makeRepo();
  try {
    const result = run(["commit", "--target", dir]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /--message is required/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("checkpoint mode defaults to explicit and can be set to continuous", () => {
  const { dir } = makeRepo();
  try {
    assert.equal(JSON.parse(run(["mode", "--target", dir]).stdout).checkpointMode, "explicit");
    const set = run(["mode", "continuous", "--target", dir]);
    assert.equal(JSON.parse(set.stdout).checkpointMode, "continuous");
    assert.equal(JSON.parse(run(["mode", "--target", dir]).stdout).checkpointMode, "continuous");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
