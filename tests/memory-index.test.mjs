import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { searchMemory } from "../scripts/memory-index.mjs";

test("indexes markdown memory and searches by token", () => {
  const indexOutput = execFileSync("node", ["scripts/memory-index.mjs", "index"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const indexed = JSON.parse(indexOutput);
  assert.ok(indexed.indexed >= 1);
  assert.ok(existsSync("knowledge/.a-stack-index.json"));

  const searchOutput = execFileSync("node", ["scripts/memory-index.mjs", "search", "security auth"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const searched = JSON.parse(searchOutput);
  assert.ok(searched.results.some((result) => result.path.includes("security.md")));
});

test("searchMemory is callable as a pure function (used by hooks)", () => {
  const { results } = searchMemory({ query: "security auth secrets", root: process.cwd(), limit: 3 });
  assert.ok(results.length >= 1);
  assert.ok(results.length <= 3);
  assert.ok(results.some((r) => r.path.includes("security.md")));
  assert.ok(results.every((r) => r.score > 0));
});

test("BM25 ranks by term frequency, not just presence", () => {
  const root = mkdtempSync(join(tmpdir(), "a-stack-bm25-"));
  try {
    mkdirSync(join(root, "knowledge"), { recursive: true });
    // Both docs contain "widget"; only the term frequency differs. The old
    // presence-only token-bag would tie them — BM25 must rank "high" first.
    writeFileSync(join(root, "knowledge", "high.md"), "# High\n\nwidget widget widget widget widget.\n");
    writeFileSync(join(root, "knowledge", "low.md"), "# Low\n\nwidget appears once here.\n");
    const { results } = searchMemory({ query: "widget", root, limit: 5 });
    assert.equal(results.length, 2);
    assert.ok(results[0].path.includes("high.md"), "higher term frequency should rank first");
    assert.ok(results[0].score > results[1].score, "scores must differentiate, not tie");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
