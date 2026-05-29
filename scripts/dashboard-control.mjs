// Dashboard lifecycle control — start (detached/background), stop, status.
// Idempotent via a PID file so multiple Claude sessions share one dashboard
// instead of fighting over the port. Used by the `dashboard` CLI command and by
// the SessionStart hook (opt-in auto-start). Pure module — no work at import.

import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverScript = join(here, "dashboard-server.mjs");

function stateDir() {
  return process.env.ASTACK_STATE_DIR || join(homedir(), ".a-stack");
}
function pidFile(port) {
  return join(stateDir(), `dashboard-${port}.pid`);
}
function logFile(port) {
  return join(stateDir(), `dashboard-${port}.log`);
}
export function dashboardUrl(port) {
  return `http://localhost:${port}`;
}

function readPid(port) {
  try {
    return JSON.parse(readFileSync(pidFile(port), "utf8"));
  } catch {
    return null;
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function isRunning(port) {
  const rec = readPid(port);
  return Boolean(rec && alive(rec.pid));
}

export function startDashboard({ stackRoot, target, port = "4317" }) {
  port = String(port);
  if (isRunning(port)) {
    const rec = readPid(port);
    return { status: "already-running", pid: rec?.pid, port, url: dashboardUrl(port) };
  }
  mkdirSync(stateDir(), { recursive: true });
  const log = openSync(logFile(port), "a");
  const child = spawn(
    process.execPath,
    [serverScript, "--stack-root", stackRoot, "--target", target, "--port", port],
    { detached: true, stdio: ["ignore", log, log] },
  );
  child.unref();
  writeFileSync(
    pidFile(port),
    JSON.stringify({ pid: child.pid, port: Number(port), target, startedAt: new Date().toISOString() }, null, 2),
  );
  return { status: "started", pid: child.pid, port, url: dashboardUrl(port) };
}

export function stopDashboard({ port = "4317" }) {
  port = String(port);
  const rec = readPid(port);
  if (!rec) return { status: "not-running", port };
  try {
    process.kill(rec.pid, "SIGTERM");
  } catch {
    /* already gone */
  }
  try {
    rmSync(pidFile(port), { force: true });
  } catch {
    /* best effort */
  }
  return { status: "stopped", pid: rec.pid, port };
}

export function dashboardStatus({ port = "4317" }) {
  port = String(port);
  const rec = readPid(port);
  const running = isRunning(port);
  return { running, pid: running ? rec?.pid : null, port, url: dashboardUrl(port), logFile: existsSync(logFile(port)) ? logFile(port) : null };
}
