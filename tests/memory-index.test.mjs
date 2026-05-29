import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
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
