#!/usr/bin/env node
// Minimal QA-browser tripwire.
//
// This is an HTTP-level smoke test — it spawns the target repo's dev script,
// waits for it to listen, then hits a configured list of URLs and reports
// status / response time / payload size / obvious error markers in the body.
//
// Real visual QA (clicks, screenshots, console capture) is delegated to the
// gstack-browse / agent-browser skills when present. This script exists so
// gates can fail on basic "the dev server doesn't even respond" regressions
// without requiring Playwright/Puppeteer to be installed.
//
// Usage:
//   node scripts/qa-browser.mjs --target <repo> [--url /] [--url /login] \
//     [--port 3000] [--start-script dev] [--ready-regex "Local:"] \
//     [--timeout-ms 60000] [--no-start]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const args = process.argv.slice(2);

function flag(name, fallback = "") {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const next = args[idx + 1];
  return next === undefined ? fallback : next;
}

function multi(name) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === `--${name}` && args[i + 1] !== undefined) out.push(args[i + 1]);
  }
  return out;
}

function bool(name) {
  return args.includes(`--${name}`);
}

const target = resolve(flag("target", process.cwd()));
const startScript = flag("start-script", "dev");
const port = Number(flag("port", "3000"));
const readyRegex = new RegExp(flag("ready-regex", "(localhost|127\\.0\\.0\\.1):\\d+|ready in|Local:\\s*http"));
const timeoutMs = Number(flag("timeout-ms", "60000"));
const noStart = bool("no-start");
const urls = (multi("url").length ? multi("url") : ["/"]).map((u) => (u.startsWith("/") ? u : `/${u}`));

function detectPackageManager(root) {
  if (existsSync(join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(root, "yarn.lock"))) return "yarn";
  if (existsSync(join(root, "bun.lockb")) || existsSync(join(root, "bun.lock"))) return "bun";
  return "npm";
}

function readPackageScripts(root) {
  const path = join(root, "package.json");
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")).scripts || {};
  } catch {
    return {};
  }
}

async function waitForReady(child, regex, timeout) {
  return new Promise((resolveReady, rejectReady) => {
    let stdoutBuf = "";
    let stderrBuf = "";
    const timer = globalThis.setTimeout(() => {
      child.off("exit", onExit);
      rejectReady(new Error(`timeout after ${timeout}ms — stdout tail:\n${stdoutBuf.slice(-400)}\nstderr tail:\n${stderrBuf.slice(-400)}`));
    }, timeout);
    function onData(buf, which) {
      const text = buf.toString();
      if (which === "stdout") stdoutBuf += text;
      else stderrBuf += text;
      if (regex.test(stdoutBuf) || regex.test(stderrBuf)) {
        clearTimeout(timer);
        child.off("exit", onExit);
        resolveReady({ stdoutTail: stdoutBuf.slice(-400), stderrTail: stderrBuf.slice(-400) });
      }
    }
    function onExit(code, signal) {
      clearTimeout(timer);
      rejectReady(new Error(`dev server exited early (code ${code}, signal ${signal})\n${stderrBuf.slice(-400)}`));
    }
    child.stdout.on("data", (b) => onData(b, "stdout"));
    child.stderr.on("data", (b) => onData(b, "stderr"));
    child.on("exit", onExit);
  });
}

async function pollHttp(baseUrl, path) {
  const start = Date.now();
  const url = baseUrl + path;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    const body = await response.text();
    const elapsed = Date.now() - start;
    const errorMarkers = [];
    if (/Uncaught\b/i.test(body)) errorMarkers.push("Uncaught");
    if (/Internal Server Error/i.test(body)) errorMarkers.push("ISE");
    if (/Application error: a client-side exception/i.test(body)) errorMarkers.push("client-exception");
    if (/<title>\s*5\d\d\b/i.test(body)) errorMarkers.push("5xx-title");
    return {
      url: path,
      status: response.status,
      ok: response.ok && errorMarkers.length === 0,
      elapsedMs: elapsed,
      bytes: body.length,
      contentType: response.headers.get("content-type"),
      errorMarkers,
    };
  } catch (error) {
    return {
      url: path,
      status: 0,
      ok: false,
      elapsedMs: Date.now() - start,
      bytes: 0,
      error: String(error.message || error),
    };
  }
}

function writeReport(dir, summary) {
  const planning = join(dir, ".planning");
  mkdirSync(planning, { recursive: true });
  const reportPath = join(planning, "QA.md");
  const lines = [
    "# A-Stack QA Smoke",
    "",
    `- generated: ${new Date().toISOString()}`,
    `- target: ${dir}`,
    `- baseUrl: ${summary.baseUrl}`,
    `- startScript: ${summary.startScript || "(skipped)"} (${summary.packageManager || "n/a"})`,
    `- result: ${summary.ok ? "pass" : "fail"}`,
    "",
    "## URLs",
    "",
  ];
  for (const r of summary.results) {
    lines.push(`- ${r.ok ? "✓" : "✗"} ${r.url} — status ${r.status} in ${r.elapsedMs}ms (${r.bytes}b)${r.errorMarkers?.length ? ` [markers: ${r.errorMarkers.join(", ")}]` : ""}${r.error ? ` [error: ${r.error}]` : ""}`);
  }
  if (summary.devStdoutTail) {
    lines.push("", "## Dev server stdout (tail)", "", "```", summary.devStdoutTail.trim(), "```");
  }
  if (summary.devStderrTail) {
    lines.push("", "## Dev server stderr (tail)", "", "```", summary.devStderrTail.trim(), "```");
  }
  writeFileSync(reportPath, lines.join("\n") + "\n");
  return reportPath;
}

async function main() {
  const scripts = readPackageScripts(target);
  const pm = detectPackageManager(target);
  let child = null;
  let stdoutTail = "";
  let stderrTail = "";
  const baseUrl = `http://127.0.0.1:${port}`;

  if (!noStart) {
    if (!scripts[startScript]) {
      const out = {
        status: "skip",
        reason: `no "${startScript}" script in package.json`,
        scriptsAvailable: Object.keys(scripts),
      };
      const report = writeReport(target, {
        baseUrl,
        startScript: null,
        packageManager: pm,
        ok: false,
        results: [],
      });
      console.log(JSON.stringify({ ...out, report }, null, 2));
      process.exit(0);
    }
    const cmd =
      pm === "pnpm" ? ["pnpm", "run", startScript] :
      pm === "yarn" ? ["yarn", startScript] :
      pm === "bun" ? ["bun", "run", startScript] :
      ["npm", "run", "--silent", startScript];
    child = spawn(cmd[0], cmd.slice(1), {
      cwd: target,
      env: { ...process.env, PORT: String(port), BROWSER: "none", FORCE_COLOR: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    try {
      const ready = await waitForReady(child, readyRegex, timeoutMs);
      stdoutTail = ready.stdoutTail;
      stderrTail = ready.stderrTail;
    } catch (error) {
      try { child.kill("SIGTERM"); } catch {}
      const summary = {
        baseUrl,
        startScript,
        packageManager: pm,
        ok: false,
        results: [],
        devStdoutTail: stdoutTail,
        devStderrTail: `${stderrTail}\n${error.message}`,
      };
      const report = writeReport(target, summary);
      console.log(
        JSON.stringify({ status: "fail", reason: `dev server never reported ready: ${error.message}`, report }, null, 2),
      );
      process.exit(1);
    }
    // give it a beat to actually accept sockets
    await sleep(500);
  }

  const results = [];
  for (const path of urls) {
    results.push(await pollHttp(baseUrl, path));
  }

  if (child) {
    try { child.kill("SIGTERM"); } catch {}
  }

  const ok = results.every((r) => r.ok);
  const summary = {
    baseUrl,
    startScript: noStart ? null : startScript,
    packageManager: noStart ? null : pm,
    ok,
    results,
    devStdoutTail: stdoutTail,
    devStderrTail: stderrTail,
  };
  const report = writeReport(target, summary);
  console.log(JSON.stringify({ status: ok ? "pass" : "fail", baseUrl, results, report }, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(`qa-browser fatal: ${err.message}`);
  process.exit(2);
});
