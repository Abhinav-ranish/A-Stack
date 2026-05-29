import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

function makeFixture(behavior) {
  const dir = mkdtempSync(join(tmpdir(), "a-stack-qa-"));
  const server = `import http from "node:http";
const port = Number(process.env.PORT || 0);
const server = http.createServer((req, res) => {
  if (req.url === "/fail") {
    res.statusCode = 500;
    res.setHeader("content-type", "text/html");
    res.end("<title>500 Internal Server Error</title>");
    return;
  }
  if (req.url === "/error-body") {
    res.statusCode = 200;
    res.setHeader("content-type", "text/html");
    res.end("Uncaught TypeError: oops");
    return;
  }
  res.statusCode = 200;
  res.setHeader("content-type", "text/html");
  res.end("<title>ok</title><h1>hello from " + req.url + "</h1>");
});
server.listen(port, "127.0.0.1", () => {
  const addr = server.address();
  console.log("Local: http://127.0.0.1:" + addr.port);
});
`;
  writeFileSync(join(dir, "server.mjs"), server);
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "qa-fixture", scripts: { [behavior.script || "dev"]: "node server.mjs" } }),
  );
  return dir;
}

function runQa(args) {
  return spawnSync(
    "node",
    [resolve("scripts/qa-browser.mjs"), ...args, "--ready-regex", "Local: http", "--timeout-ms", "8000"],
    { cwd: process.cwd(), encoding: "utf8" },
  );
}

test("qa-browser passes on a healthy dev server", () => {
  const dir = makeFixture({});
  try {
    const port = 7000 + Math.floor(Math.random() * 1000);
    const result = runQa(["--target", dir, "--port", String(port), "--url", "/", "--url", "/about"]);
    assert.equal(result.status, 0, `expected pass, got stderr=${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.status, "pass");
    assert.equal(parsed.results.length, 2);
    assert.ok(parsed.results.every((r) => r.ok));
    const report = readFileSync(join(dir, ".planning", "QA.md"), "utf8");
    assert.match(report, /result: pass/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("qa-browser fails on 5xx response", () => {
  const dir = makeFixture({});
  try {
    const port = 7000 + Math.floor(Math.random() * 1000);
    const result = runQa(["--target", dir, "--port", String(port), "--url", "/fail"]);
    assert.equal(result.status, 1);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.status, "fail");
    assert.equal(parsed.results[0].status, 500);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("qa-browser flags uncaught error markers in body", () => {
  const dir = makeFixture({});
  try {
    const port = 7000 + Math.floor(Math.random() * 1000);
    const result = runQa(["--target", dir, "--port", String(port), "--url", "/error-body"]);
    assert.equal(result.status, 1);
    const parsed = JSON.parse(result.stdout);
    assert.ok(parsed.results[0].errorMarkers.includes("Uncaught"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("qa-browser skips cleanly when no dev script", () => {
  const dir = mkdtempSync(join(tmpdir(), "a-stack-qa-noscript-"));
  try {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "no-dev", scripts: {} }));
    const result = runQa(["--target", dir]);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.status, "skip");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
