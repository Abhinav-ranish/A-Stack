#!/usr/bin/env node
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { addEvent, addTask, collectDashboardState, updateTask } from "./stack-state.mjs";

const args = process.argv.slice(2);

function flag(name, fallback = "") {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return args[index + 1] || fallback;
}

const stackRoot = resolve(flag("stack-root", process.cwd()));
const targetRoot = resolve(flag("target", process.cwd()));
const port = Number(flag("port", "4317"));
const dashboardRoot = join(stackRoot, "dashboard");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

// One-click actions: run a real A-Stack operation against the target and return
// a short summary. Allowlisted — no arbitrary command execution from the UI.
const ACTIONS = {
  security: {
    script: "security-scan.mjs",
    args: () => [targetRoot],
    summarize: (out) => {
      try {
        const j = JSON.parse(out);
        return `${j.critical || 0} critical · ${(j.findings || []).length} findings`;
      } catch {
        return out.trim().slice(-400);
      }
    },
  },
  gates: {
    script: "a-stack.mjs",
    args: () => ["gates", "--root", stackRoot, "--target", targetRoot],
    summarize: (out) => out.trim().slice(-700),
  },
  "qa-browser": {
    script: "qa-browser.mjs",
    args: () => ["--target", targetRoot],
    summarize: (out) => {
      try {
        return `status: ${JSON.parse(out).status}`;
      } catch {
        return out.trim().slice(-400);
      }
    },
  },
  reindex: {
    script: "memory-index.mjs",
    args: () => ["index", "--root", stackRoot],
    summarize: (out) => out.trim().slice(-300),
  },
};

function runAction(name) {
  const def = ACTIONS[name];
  if (!def) return null;
  const start = Date.now();
  const result = spawnSync("node", [join(stackRoot, "scripts", def.script), ...def.args()], {
    cwd: stackRoot,
    encoding: "utf8",
    timeout: 180000,
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  return {
    name,
    ok: result.status === 0,
    durationMs: Date.now() - start,
    summary: def.summarize(output),
    output: output.trim().slice(-2000),
  };
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${port}`);
  const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const file = resolve(join(dashboardRoot, requestPath));
  if (!file.startsWith(dashboardRoot) || !existsSync(file)) {
    send(res, 404, "Not found", "text/plain; charset=utf-8");
    return;
  }
  send(res, 200, readFileSync(file), mime[extname(file)] || "application/octet-stream");
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (req.method === "GET" && url.pathname === "/api/state") {
      send(res, 200, JSON.stringify(collectDashboardState({ targetRoot, stackRoot }), null, 2));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/tasks") {
      const task = addTask(targetRoot, await readBody(req));
      send(res, 201, JSON.stringify({ task }, null, 2));
      return;
    }
    if (req.method === "PATCH" && url.pathname.startsWith("/api/tasks/")) {
      const id = decodeURIComponent(url.pathname.split("/").pop());
      const task = updateTask(targetRoot, id, await readBody(req));
      if (!task) send(res, 404, JSON.stringify({ error: "Task not found" }));
      else send(res, 200, JSON.stringify({ task }, null, 2));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/events") {
      const event = addEvent(targetRoot, await readBody(req));
      send(res, 201, JSON.stringify({ event }, null, 2));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/actions") {
      const { name } = await readBody(req);
      const result = runAction(name);
      if (!result) {
        send(res, 400, JSON.stringify({ error: `Unknown action: ${name}` }));
        return;
      }
      send(res, 200, JSON.stringify(result, null, 2));
      return;
    }
    if (req.method === "GET") {
      serveStatic(req, res);
      return;
    }
    send(res, 405, JSON.stringify({ error: "Method not allowed" }));
  } catch (error) {
    send(res, 500, JSON.stringify({ error: error.message }, null, 2));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`A-Stack dashboard: http://127.0.0.1:${port}`);
  console.log(`Target: ${targetRoot}`);
});
