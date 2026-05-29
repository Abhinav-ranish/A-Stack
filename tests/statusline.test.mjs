import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

function runStatusline(payload, env = {}) {
  const state = mkdtempSync(join(tmpdir(), "a-stack-sl-state-"));
  const r = spawnSync("node", [resolve("scripts/statusline.mjs")], {
    encoding: "utf8",
    input: JSON.stringify(payload),
    env: { ...process.env, NO_COLOR: "1", ASTACK_STATE_DIR: state, ...env },
  });
  rmSync(state, { recursive: true, force: true });
  r.stdout = (r.stdout || "").replace(/\x1b\[[0-9;]*m/g, "");
  return r;
}

test("statusline shows framework, branch, model, cost, sessions, dashboard", () => {
  const target = mkdtempSync(join(tmpdir(), "a-stack-sl-"));
  try {
    const git = (a) => spawnSync("git", ["-C", target, ...a], { encoding: "utf8" });
    git(["init", "-q"]);
    git(["config", "user.email", "t@t.co"]);
    git(["config", "user.name", "t"]);
    git(["commit", "--allow-empty", "-q", "-m", "init"]);
    // Force a deterministic branch name: `git init` defaults to `main` on some
    // hosts and `master` on others (e.g. GitHub's ubuntu runner), which would
    // otherwise make the `⎇ main` assertion below environment-dependent.
    git(["branch", "-M", "main"]);

    const result = runStatusline({
      workspace: { current_dir: target },
      model: { display_name: "Opus 4.7" },
      cost: { total_cost_usd: 0.42 },
      session_id: "abc",
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /▊ A-Stack/);
    assert.match(result.stdout, /⎇ main/);
    assert.match(result.stdout, /Opus 4\.7/);
    assert.match(result.stdout, /\$0\.42/);
    assert.match(result.stdout, /⧉ \d+/);
    assert.match(result.stdout, /dashboard/);
    assert.equal(result.stdout.split("\n").length, 1, "must be a single line");
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});

test("statusline shows the active parallel subagent count", () => {
  const state = mkdtempSync(join(tmpdir(), "a-stack-sl-agents-"));
  const hook = resolve("scripts/hooks/session-hook.mjs");
  const env = { ...process.env, NO_COLOR: "1", ASTACK_STATE_DIR: state };
  const sl = () =>
    spawnSync("node", [resolve("scripts/statusline.mjs")], {
      encoding: "utf8",
      input: JSON.stringify({ model: { display_name: "Opus" } }),
      env,
    }).stdout.replace(/\x1b\[[0-9;]*m/g, "");
  const agent = (cmd) =>
    spawnSync("node", [hook, cmd], { encoding: "utf8", input: "{}", env });
  try {
    agent("agent-start");
    agent("agent-start");
    assert.match(sl(), /⧉ 2/, "two subagents running");
    agent("agent-stop");
    assert.match(sl(), /⧉ 1/, "one left");
  } finally {
    rmSync(state, { recursive: true, force: true });
  }
});

test("statusline rich mode adds a project line with real signals", () => {
  const target = mkdtempSync(join(tmpdir(), "a-stack-sl-rich-"));
  const stack = mkdtempSync(join(tmpdir(), "a-stack-sl-rich-stack-"));
  const sessions = mkdtempSync(join(tmpdir(), "a-stack-sl-rich-sess-"));
  try {
    mkdirSync(join(target, ".planning"), { recursive: true });
    writeFileSync(join(target, ".planning", "STATE.md"), "- project: Dashboards\n- current_phase: 2\n");
    writeFileSync(
      join(target, ".planning", "TASKS.json"),
      JSON.stringify({ tasks: [{ title: "a", status: "queued" }, { title: "b", status: "done" }] }),
    );
    writeFileSync(join(target, ".planning", "GATES.md"), "- security-scan: pass\n");
    mkdirSync(join(stack, "knowledge", "x"), { recursive: true });
    writeFileSync(join(stack, "knowledge", "x", "n.md"), "# n\n");

    const r = spawnSync("node", [resolve("scripts/statusline.mjs")], {
      encoding: "utf8",
      input: JSON.stringify({ workspace: { current_dir: target }, model: { display_name: "Opus" }, session_id: "x" }),
      env: { ...process.env, NO_COLOR: "1", ASTACK_STATUSLINE: "rich", ASTACK_ROOT: stack, ASTACK_SESSIONS_DIR: sessions },
    });
    const out = r.stdout.replace(/\x1b\[[0-9;]*m/g, "");
    assert.equal(out.split("\n").length, 2, "rich mode is two lines");
    assert.match(out, /▊ A-Stack/);
    assert.match(out, /📁 Dashboards/);
    assert.match(out, /phase 2/);
    assert.match(out, /⏳ 1\/2/);
    assert.match(out, /pass/);
    assert.match(out, /🧠 1/);
  } finally {
    rmSync(target, { recursive: true, force: true });
    rmSync(stack, { recursive: true, force: true });
    rmSync(sessions, { recursive: true, force: true });
  }
});

test("statusline persists session cost to .planning for the dashboard", () => {
  const target = mkdtempSync(join(tmpdir(), "a-stack-sl-cost-"));
  try {
    mkdirSync(join(target, ".planning"), { recursive: true });
    spawnSync("node", [resolve("scripts/statusline.mjs")], {
      encoding: "utf8",
      input: JSON.stringify({
        workspace: { current_dir: target },
        model: { display_name: "Opus 4.7" },
        cost: { total_cost_usd: 3.81, total_duration_ms: 563000 },
        session_id: "s1",
      }),
      env: { ...process.env, NO_COLOR: "1" },
    });
    const cost = JSON.parse(readFileSync(join(target, ".planning", ".astack-cost.json"), "utf8"));
    assert.equal(cost.costUsd, 3.81);
    assert.equal(cost.model, "Opus 4.7");
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});

test("statusline falls back gracefully on empty input", () => {
  const result = spawnSync("node", [resolve("scripts/statusline.mjs")], {
    encoding: "utf8",
    input: "",
    env: { ...process.env, NO_COLOR: "1" },
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /A-Stack/);
});
