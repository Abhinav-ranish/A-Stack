import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

function run(args, options = {}) {
  return JSON.parse(
    execFileSync("node", ["scripts/a-stack.mjs", ...args], {
      cwd: process.cwd(),
      encoding: "utf8",
      ...options,
    }),
  );
}

test("a-stack route returns workflow plus recommendations field", () => {
  const result = run(["route", "build me a web app for invoices"]);
  assert.equal(result.intent, "new-app");
  assert.equal(result.workflow, "workflows/new-app.md");
  assert.ok(Array.isArray(result.recommendations));
});

test("a-stack init-project creates GSD-style planning artifacts", () => {
  const dir = mkdtempSync(join(tmpdir(), "a-stack-project-"));
  try {
    const result = run([
      "init-project",
      "--root",
      dir,
      "--name",
      "Invoice Pilot",
      "--idea",
      "A SaaS dashboard for invoice follow-up",
    ]);
    assert.equal(result.initialized, true);
    assert.ok(existsSync(join(dir, ".planning", "PROJECT.md")));
    assert.ok(existsSync(join(dir, ".planning", "REQUIREMENTS.md")));
    assert.ok(existsSync(join(dir, ".planning", "ROADMAP.md")));
    assert.ok(existsSync(join(dir, ".planning", "STATE.md")));
    assert.ok(existsSync(join(dir, "knowledge", "projects", "invoice-pilot.md")));
    assert.match(readFileSync(join(dir, ".planning", "PROJECT.md"), "utf8"), /Invoice Pilot/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a-stack migrate imports an existing coded repo without overwriting guidance", () => {
  const dir = mkdtempSync(join(tmpdir(), "a-stack-migrate-"));
  try {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "existing-saas",
        scripts: { dev: "next dev", build: "next build", test: "node --test" },
        dependencies: { next: "16.0.0", react: "19.0.0", "@clerk/nextjs": "latest", prisma: "latest" },
      }),
    );
    writeFileSync(join(dir, "CLAUDE.md"), "# Existing Guidance\n\nKeep this line.\n");

    const appDir = join(dir, "app");
    const prismaDir = join(dir, "prisma");
    execFileSync("mkdir", ["-p", appDir, prismaDir]);
    writeFileSync(join(appDir, "page.tsx"), "export default function Page() { return <main>Existing</main>; }\n");
    writeFileSync(join(prismaDir, "schema.prisma"), "datasource db { provider = \"postgresql\" url = env(\"DATABASE_URL\") }\n");

    const result = run(["migrate", "--root", process.cwd(), "--target", dir]);
    assert.equal(result.migrated, true);
    assert.equal(result.analysis.frameworks.includes("Next.js"), true);
    assert.equal(result.analysis.auth.includes("Clerk"), true);
    assert.ok(existsSync(join(dir, ".a-stack", "config.json")));
    assert.ok(existsSync(join(dir, ".planning", "MIGRATION.md")));
    assert.ok(existsSync(join(dir, ".planning", "STATE.md")));
    assert.ok(existsSync(join(dir, ".planning", "TASKS.json")));
    assert.match(readFileSync(join(dir, "CLAUDE.md"), "utf8"), /Keep this line/);
    assert.match(readFileSync(join(dir, "CLAUDE.md"), "utf8"), /A-Stack Operating Context/);

    const state = run(["dashboard-state", "--root", process.cwd(), "--target", dir]);
    assert.equal(state.project.status, "migrated");
    assert.equal(state.quality.vulnerabilitiesPatched, 0);
    assert.equal(state.events[0].type, "stack-migrated");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a-stack gates writes report for clean target", () => {
  const dir = mkdtempSync(join(tmpdir(), "a-stack-gates-"));
  try {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ scripts: { test: "echo ok", build: "echo ok" } }));
    const result = run(["gates", "--root", process.cwd(), "--target", dir, "--ui", "--public"]);
    assert.equal(result.statuses.find((item) => item.gate === "security-scan").status, "pass");
    assert.ok(existsSync(join(dir, ".planning", "GATES.md")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a-stack gates fails when a script exits non-zero", () => {
  const dir = mkdtempSync(join(tmpdir(), "a-stack-gates-script-fail-"));
  try {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ scripts: { test: "exit 1", build: "echo ok" } }),
    );
    const result = spawnSync(
      "node",
      ["scripts/a-stack.mjs", "gates", "--root", process.cwd(), "--target", dir, "--skip-audit"],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    assert.equal(result.status, 1);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.statuses.find((item) => item.gate === "script:test").status, "fail");
    assert.equal(parsed.statuses.find((item) => item.gate === "script:build").status, "pass");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a-stack gates fails on critical secret", () => {
  const dir = mkdtempSync(join(tmpdir(), "a-stack-gates-fail-"));
  try {
    writeFileSync(join(dir, "route.ts"), "const key = 'sk-proj_12345678901234567890';\n");
    const result = spawnSync("node", ["scripts/a-stack.mjs", "gates", "--root", process.cwd(), "--target", dir], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.statuses.find((item) => item.gate === "security-scan").status, "fail");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a-stack task and event commands feed dashboard state", () => {
  const dir = mkdtempSync(join(tmpdir(), "a-stack-dashboard-state-"));
  try {
    run(["init-project", "--root", dir, "--name", "Dash App", "--idea", "Track agent stack outcomes"]);
    const taskResult = run([
      "task",
      "add",
      "--target",
      dir,
      "--title",
      "Patch auth redirect",
      "--agent",
      "codex",
      "--priority",
      "high",
    ]);
    assert.match(taskResult.task.id, /^task-/);

    run([
      "event",
      "--target",
      dir,
      "--type",
      "vulnerability-patched",
      "--title",
      "Fixed open redirect",
      "--tokens-in",
      "1000",
      "--tokens-out",
      "250",
      "--cost-usd",
      "0.01",
    ]);

    const state = run(["dashboard-state", "--root", process.cwd(), "--target", dir]);
    assert.equal(state.project.name, "Dash App");
    assert.equal(state.tasks.total, 1);
    assert.equal(state.tasks.items[0].agent, "codex");
    assert.equal(state.quality.vulnerabilitiesPatched, 1);
    assert.equal(state.costs.totalTokens, 1250);
    assert.ok(state.graph.nodes.some((node) => node.id === taskResult.task.id));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a-stack save-session writes a project-local checkpoint and lists it", () => {
  const target = mkdtempSync(join(tmpdir(), "a-stack-sess-cli-t-"));
  try {
    const saved = run([
      "save-session",
      "--target",
      target,
      "--title",
      "auth refactor",
      "--next",
      "wire the callback",
      "--decisions",
      "server-side sessions",
    ]);
    assert.equal(saved.saved, true);
    assert.equal(saved.target, target);
    assert.match(saved.checkpoint, /^\.planning\/sessions\/checkpoints\/.*auth-refactor\.md$/);
    // Checkpoint lives in the PROJECT, not the A-Stack install.
    const checkpoint = readFileSync(join(target, saved.checkpoint), "utf8");
    assert.match(checkpoint, /## Working on: auth refactor/);
    assert.match(checkpoint, /server-side sessions/);
    assert.match(checkpoint, /wire the callback/);
    assert.ok(existsSync(join(target, ".planning", "SESSION.md")));

    const list = run(["save-session", "list", "--all", "--target", target]);
    assert.equal(list.count, 1);
    assert.equal(list.checkpoints[0].title, "auth refactor");
    assert.equal(list.checkpoints[0].status, "in-progress");
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});

test("a-stack demo runs the full offline proof end to end", () => {
  const result = spawnSync("node", ["scripts/a-stack.mjs", "demo"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  const out = result.stdout;
  // Routing classifies distinct intents from plain language.
  assert.match(out, /new-app {2}\(workflows\/new-app\.md\)/);
  assert.match(out, /debug {2}\(workflows\/debug\.md\)/);
  assert.match(out, /security-review {2}\(workflows\/security-review\.md\)/);
  // Planning artifacts created and real gates pass on clean code.
  assert.match(out, /ok {2}\.planning\/PROJECT\.md/);
  assert.match(out, /PASS {2}security-scan/);
  assert.match(out, /gates exit code: 0/);
  // The scanner actually catches a planted secret and blocks (non-zero exit).
  assert.match(out, /scanner exit code: 1/);
  assert.match(out, /critical "openai-key"/);
});
