import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

function freshState() {
  const dir = mkdtempSync(join(tmpdir(), "a-stack-dash-state-"));
  process.env.ASTACK_STATE_DIR = dir;
  return dir;
}

async function load() {
  // Fresh import so ASTACK_STATE_DIR is read per-test (module reads it lazily).
  return await import(`../scripts/dashboard-control.mjs?cacheBust=${Math.random()}`);
}

const PORT = String(48000 + Math.floor(Math.random() * 1000));

test("dashboard control: start (detached) → status running → stop", async () => {
  const stateDir = freshState();
  const { startDashboard, dashboardStatus, stopDashboard, isRunning } = await load();
  try {
    const started = startDashboard({ stackRoot: process.cwd(), target: process.cwd(), port: PORT });
    assert.equal(started.status, "started");
    assert.ok(started.pid > 0);
    assert.match(started.url, /^http:\/\/localhost:/);

    assert.equal(isRunning(PORT), true);
    const status = dashboardStatus({ port: PORT });
    assert.equal(status.running, true);
    assert.equal(status.pid, started.pid);

    // Idempotent: a second start finds the first already running.
    const again = startDashboard({ stackRoot: process.cwd(), target: process.cwd(), port: PORT });
    assert.equal(again.status, "already-running");
    assert.equal(again.pid, started.pid);

    const stopped = stopDashboard({ port: PORT });
    assert.equal(stopped.status, "stopped");
    assert.equal(isRunning(PORT), false);
  } finally {
    try {
      const { stopDashboard } = await load();
      stopDashboard({ port: PORT });
    } catch {
      /* ignore */
    }
    rmSync(stateDir, { recursive: true, force: true });
    delete process.env.ASTACK_STATE_DIR;
  }
});

test("dashboard control: stop is a no-op when nothing is running", async () => {
  const stateDir = freshState();
  const { stopDashboard, dashboardStatus } = await load();
  try {
    assert.equal(stopDashboard({ port: "49999" }).status, "not-running");
    assert.equal(dashboardStatus({ port: "49999" }).running, false);
  } finally {
    rmSync(stateDir, { recursive: true, force: true });
    delete process.env.ASTACK_STATE_DIR;
  }
});
