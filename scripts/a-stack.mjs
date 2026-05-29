#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { route } from "./router.mjs";
import { dashboardStatus, startDashboard, stopDashboard } from "./dashboard-control.mjs";

// Directory of this CLI's own scripts — used to locate sibling helpers
// regardless of where the knowledge root (ASTACK_ROOT) points.
const scriptsDir = dirname(fileURLToPath(import.meta.url));
import {
  addEvent as stateAddEvent,
  addTask as stateAddTask,
  collectDashboardState,
  loadTasks,
  updateTask as stateUpdateTask,
} from "./stack-state.mjs";

const args = process.argv.slice(2);
const command = args[0] || "help";
const BT = String.fromCharCode(96);

function flag(name, fallback = "") {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return args[index + 1] || fallback;
}

function boolFlag(name) {
  return args.includes(`--${name}`);
}

function root() {
  return flag("root", process.env.ASTACK_ROOT || process.cwd());
}

function slugify(value) {
  return (value || "app")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "app";
}

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${content.trim()}\n`);
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function commandExists(name) {
  return spawnSync("sh", ["-lc", `command -v ${name}`], { encoding: "utf8" }).status === 0;
}

function packageScripts(targetRoot) {
  const pkg = readJson(join(targetRoot, "package.json"), {});
  return pkg?.scripts || {};
}

function allDependencies(pkg) {
  return {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
    ...(pkg.peerDependencies || {}),
    ...(pkg.optionalDependencies || {}),
  };
}

function runNodeScript(script, scriptArgs, cwd) {
  return spawnSync("node", [script, ...scriptArgs], { cwd, encoding: "utf8" });
}

function loadLearningRecommendations(stackRoot, text) {
  const statePath = join(stackRoot, "knowledge", "learning", ".learning-state.json");
  const state = readJson(statePath, { patterns: [] });
  const tokens = new Set((text || "").toLowerCase().match(/[a-z0-9][a-z0-9-]{1,}/g) || []);
  return (state.patterns || [])
    .map((pattern) => {
      const haystack = `${pattern.domain} ${pattern.pattern} ${(pattern.tags || []).join(" ")}`.toLowerCase();
      const lexical = [...tokens].reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
      const score = lexical + Number(pattern.avgQuality || 0) + (pattern.promoted ? 1 : 0);
      return { key: pattern.key, domain: pattern.domain, pattern: pattern.pattern, score, promoted: pattern.promoted };
    })
    .filter((pattern) => pattern.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function doRoute() {
  const text = args.slice(1).filter((arg, index, arr) => !arr[index - 1]?.startsWith("--") && !arg.startsWith("--")).join(" ");
  const result = route(text);
  const recommendations = loadLearningRecommendations(root(), text);
  console.log(JSON.stringify({ ...result, recommendations }, null, 2));
}

function initProject() {
  // Honor --target like every other command (migrate/gates/task/save-session).
  // Falls back to --root / ASTACK_ROOT / cwd so existing usage keeps working.
  const targetRoot = flag("target", root());
  const name = flag("name", "A-Stack App");
  const idea = flag("idea", args.slice(1).filter((arg) => !arg.startsWith("--")).join(" ") || "Web app");
  const slug = slugify(name);
  const planning = join(targetRoot, ".planning");
  const now = new Date().toISOString();

  write(
    join(planning, "PROJECT.md"),
    `# ${name}

## Vision

${idea}

## Runtime Defaults

- Mode: full-yolo with hard gates.
- Primary app target: web app.
- Memory: markdown source of truth with derived index.
- Quality gates: slop negator, security, browser QA, SEO for public pages, ship readiness.

## Current Goal

Convert the idea into a shipped web app through planned phases, parallel execution where safe, and verified release gates.`,
  );

  write(
    join(planning, "REQUIREMENTS.md"),
    `# Requirements

## REQ-001: Core Product

The app must satisfy the core user job described in PROJECT.md.

Acceptance:
- User can complete the primary workflow end to end.
- Empty, loading, error, and success states exist for the primary workflow.
- The implementation has a clear verification path.

## REQ-002: Web App Quality

Acceptance:
- Responsive layout works on desktop and mobile.
- UI avoids generic slop and follows project design memory.
- Browser QA covers the primary workflow.

## REQ-003: Security Baseline

Acceptance:
- No committed live secrets.
- Server-side auth and authorization are used where accounts/data exist.
- Security scan and CyberReview have no unresolved critical findings.

## REQ-004: Launch Readiness

Acceptance:
- Tests/build run where available.
- SEO audit runs for public pages.
- Ship summary lists verification, security, QA, SEO, risks, and next steps.`,
  );

  write(
    join(planning, "ROADMAP.md"),
    `# Roadmap

## Phase 1: Product Shape And App Shell

- Define app routes, data model, and core workflow.
- Build shell/navigation and first usable UI surface.
- Verification: app loads, primary route renders, no critical console errors.

## Phase 2: Core Workflow

- Implement the primary user workflow end to end.
- Add empty/loading/error/success states.
- Verification: automated test or browser QA proves the workflow.

## Phase 3: Security And Data Hardening

- Add auth/data protections if applicable.
- Run CyberReview and deterministic security scan.
- Verification: no unresolved critical findings.

## Phase 4: Polish, SEO, QA, Ship

- Run AI Council for UI/product quality if visual work exists.
- Run browser QA and SEO audit for public pages.
- Produce ship readiness summary.`,
  );

  write(
    join(planning, "STATE.md"),
    `# State

- project: ${name}
- slug: ${slug}
- created_at: ${now}
- current_phase: 1
- status: planned
- next_action: Execute Phase 1 after reviewing requirements and roadmap.
- hard_gates: security-critical, failed-verification, missing-credentials, destructive-actions`,
  );

  write(
    join(targetRoot, "knowledge", "projects", `${slug}.md`),
    `# ${name}
tags: project ${slug} web-app

## Idea

${idea}

## Created

${now}

## Planning

See ${BT}.planning/${BT} in the project root.`,
  );

  console.log(JSON.stringify({ initialized: true, project: name, planning: ".planning", files: 5 }, null, 2));
}

const MIGRATION_IGNORE_DIRS = new Set([
  ".git",
  ".planning",
  ".a-stack",
  ".next",
  ".nuxt",
  ".svelte-kit",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".vercel",
  ".wrangler",
]);

function walkRepoFiles(targetRoot, dir = targetRoot, files = []) {
  if (files.length >= 800) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    const relativePath = fullPath.slice(targetRoot.length + 1);
    if (entry.isDirectory()) {
      if (MIGRATION_IGNORE_DIRS.has(entry.name)) continue;
      walkRepoFiles(targetRoot, fullPath, files);
      continue;
    }
    if (!entry.isFile()) continue;
    if (relativePath.includes(".env") && !relativePath.endsWith(".example")) continue;
    files.push(relativePath);
    if (files.length >= 800) break;
  }
  return files;
}

function readFirstHeading(path) {
  if (!existsSync(path)) return "";
  const text = readFileSync(path, "utf8");
  return text.match(/^#\s+(.+)$/m)?.[1]?.trim() || "";
}

function detectRepo(targetRoot) {
  const files = walkRepoFiles(targetRoot);
  const pkg = readJson(join(targetRoot, "package.json"), {});
  const deps = allDependencies(pkg);
  const hasDep = (name) => Object.prototype.hasOwnProperty.call(deps, name);
  const hasFile = (file) => files.includes(file) || existsSync(join(targetRoot, file));
  const hasAnyFile = (...patterns) => files.some((file) => patterns.some((pattern) => file.includes(pattern)));
  const packageManager =
    hasFile("pnpm-lock.yaml") ? "pnpm" : hasFile("yarn.lock") ? "yarn" : hasFile("bun.lockb") || hasFile("bun.lock") ? "bun" : "npm";

  const frameworks = [];
  if (hasDep("next") || hasAnyFile("next.config.")) frameworks.push("Next.js");
  if (hasDep("vite") || hasFile("vite.config.ts") || hasFile("vite.config.js")) frameworks.push("Vite");
  if (hasDep("@remix-run/react")) frameworks.push("Remix");
  if (hasDep("astro")) frameworks.push("Astro");
  if (hasDep("@sveltejs/kit")) frameworks.push("SvelteKit");
  if (hasDep("react")) frameworks.push("React");
  if (hasDep("vue")) frameworks.push("Vue");
  if (hasDep("express")) frameworks.push("Express");
  if (hasDep("hono")) frameworks.push("Hono");

  const data = [];
  if (hasDep("prisma") || hasDep("@prisma/client") || hasAnyFile("schema.prisma")) data.push("Prisma");
  if (hasDep("drizzle-orm") || hasAnyFile("drizzle.config")) data.push("Drizzle");
  if (hasDep("@supabase/supabase-js") || hasAnyFile("supabase/")) data.push("Supabase");
  if (hasDep("firebase")) data.push("Firebase");
  if (hasDep("convex")) data.push("Convex");
  if (hasDep("@vercel/postgres") || hasDep("postgres") || hasDep("pg")) data.push("Postgres");

  const auth = [];
  if (hasDep("next-auth") || hasDep("@auth/core")) auth.push("Auth.js");
  if (hasDep("@clerk/nextjs") || hasDep("@clerk/clerk-react")) auth.push("Clerk");
  if (hasDep("better-auth")) auth.push("Better Auth");
  if (hasAnyFile("middleware.ts", "middleware.js")) auth.push("middleware present");
  if (hasAnyFile("auth.ts", "auth.js", "auth/")) auth.push("auth files present");

  const deployment = [];
  if (hasFile("vercel.json")) deployment.push("Vercel");
  if (hasFile("wrangler.toml") || hasFile("wrangler.json")) deployment.push("Cloudflare");
  if (hasFile("netlify.toml")) deployment.push("Netlify");
  if (hasFile("Dockerfile") || hasFile("docker-compose.yml")) deployment.push("Docker");

  const scripts = pkg.scripts || {};
  const routeFiles = files.filter((file) =>
    /(^|\/)(page|route|layout)\.(js|jsx|ts|tsx|mdx)$/.test(file) || /^pages\/.+\.(js|jsx|ts|tsx)$/.test(file),
  );
  const testFiles = files.filter((file) => /\.(test|spec)\.(js|jsx|ts|tsx|mjs|cjs)$/.test(file) || file.includes("__tests__/"));
  const uiLikely = frameworks.some((item) => ["Next.js", "Vite", "React", "Vue", "SvelteKit", "Astro", "Remix"].includes(item));
  const publicLikely = uiLikely && (routeFiles.length > 0 || hasAnyFile("public/"));
  const readmeTitle = readFirstHeading(join(targetRoot, "README.md"));
  const name = pkg.name || readmeTitle || basename(targetRoot);

  return {
    name,
    packageManager,
    frameworks,
    data,
    auth,
    deployment,
    scripts,
    routeFiles: routeFiles.slice(0, 40),
    testFiles: testFiles.slice(0, 40),
    directories: [...new Set(files.map((file) => file.split("/")[0]))].slice(0, 40),
    uiLikely,
    publicLikely,
    hasPackageJson: hasFile("package.json"),
    hasReadme: hasFile("README.md"),
    hasClaude: hasFile("CLAUDE.md"),
    totalIndexedFiles: files.length,
  };
}

function writeMaybe(path, content, force, written, preserved) {
  if (existsSync(path) && !force) {
    preserved.push(path);
    return;
  }
  write(path, content);
  written.push(path);
}

function markdownList(items, fallback = "None detected") {
  return items?.length ? items.map((item) => `- ${item}`).join("\n") : `- ${fallback}`;
}

function appendClaudeMigrationBlock(targetRoot, analysis, force, written, preserved) {
  const claudePath = join(targetRoot, "CLAUDE.md");
  const start = "<!-- A-STACK:MIGRATION START -->";
  const end = "<!-- A-STACK:MIGRATION END -->";
  const block = `${start}

## A-Stack Operating Context

This repo has been migrated into A-Stack. Before planning, coding, reviewing, or shipping, read:

- ${BT}.a-stack/config.json${BT}
- ${BT}.planning/MIGRATION.md${BT}
- ${BT}.planning/PROJECT.md${BT}
- ${BT}.planning/REQUIREMENTS.md${BT}
- ${BT}.planning/ROADMAP.md${BT}
- ${BT}.planning/STATE.md${BT}

Detected stack:
- Project: ${analysis.name}
- Frameworks: ${analysis.frameworks.join(", ") || "unknown"}
- Data: ${analysis.data.join(", ") || "none detected"}
- Auth: ${analysis.auth.join(", ") || "none detected"}
- Package manager: ${analysis.packageManager}

Default to A-Stack full-yolo execution, but stop for destructive actions, missing credentials, failed verification, or unresolved critical security findings.

${end}`;
  const current = existsSync(claudePath) ? readFileSync(claudePath, "utf8") : "";
  if (current.includes(start) && !force) {
    preserved.push(claudePath);
    return;
  }
  const next = current.includes(start)
    ? current.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block)
    : `${current.trim() ? `${current.trim()}\n\n` : ""}${block}`;
  write(claudePath, next);
  written.push(claudePath);
}

function seedMigrationTasks(targetRoot, analysis) {
  const existingTitles = new Set(loadTasks(targetRoot).tasks.map((task) => task.title));
  const candidates = [
    { title: "Run A-Stack baseline gates", details: "Run security scan, detect scripts, mark browser QA and SEO requirements.", priority: "high", intent: "security-review" },
    { title: "Run CyberReview on migrated codebase", details: "Use CyberReview to inspect auth, access control, secrets, PII, prompt injection, and dependency risks.", priority: "high", intent: "security-review" },
    analysis.uiLikely
      ? { title: "Run browser QA on core flows", details: "Launch the app, click primary flows, inspect console/network errors, screenshot evidence.", priority: "normal", intent: "qa-browser" }
      : null,
    analysis.publicLikely
      ? { title: "Run SEO audit for public routes", details: "Check metadata, headings, OG tags, sitemap, robots, canonical URLs, and structured data where relevant.", priority: "normal", intent: "seo-audit" }
      : null,
    !analysis.scripts.test
      ? { title: "Add or document test command", details: "A-Stack could not detect a package test script. Add one or document the repo's verification command.", priority: "normal", intent: "plan" }
      : null,
    !analysis.scripts.build && analysis.hasPackageJson
      ? { title: "Add or document build command", details: "A-Stack could not detect a package build script. Add one or document why the repo has no build.", priority: "normal", intent: "plan" }
      : null,
  ].filter(Boolean);

  const added = [];
  for (const task of candidates) {
    if (existingTitles.has(task.title)) continue;
    added.push(stateAddTask(targetRoot, { ...task, agent: "claude-code" }));
  }
  return added;
}

function migrate() {
  const targetRoot = flag("target", root());
  const stackRoot = root();
  const force = boolFlag("force") || boolFlag("refresh");
  const analysis = detectRepo(targetRoot);
  const name = flag("name", analysis.name || basename(targetRoot));
  const now = new Date().toISOString();
  const planning = join(targetRoot, ".planning");
  const written = [];
  const preserved = [];

  writeJson(join(targetRoot, ".a-stack", "config.json"), {
    version: 1,
    migratedAt: now,
    stackRoot,
    mode: "full-yolo",
    project: name,
    packageManager: analysis.packageManager,
    frameworks: analysis.frameworks,
    data: analysis.data,
    auth: analysis.auth,
    deployment: analysis.deployment,
    scripts: analysis.scripts,
    gates: {
      security: "required",
      browserQa: analysis.uiLikely ? "required" : "as-needed",
      seo: analysis.publicLikely ? "required" : "as-needed",
      shipReadiness: "required",
    },
  });
  written.push(join(targetRoot, ".a-stack", "config.json"));

  writeMaybe(
    join(planning, "MIGRATION.md"),
    `# A-Stack Migration

Migrated at: ${now}

## Purpose

This repo already had code. Migration makes A-Stack understand the existing codebase before future planning, execution, security review, QA, or ship work.

## Detected Stack

- Project: ${name}
- Package manager: ${analysis.packageManager}
- Frameworks: ${analysis.frameworks.join(", ") || "unknown"}
- Data layer: ${analysis.data.join(", ") || "none detected"}
- Auth/access: ${analysis.auth.join(", ") || "none detected"}
- Deployment: ${analysis.deployment.join(", ") || "none detected"}
- Indexed files: ${analysis.totalIndexedFiles}

## Package Scripts

${markdownList(Object.entries(analysis.scripts).map(([scriptName, command]) => `\`${scriptName}\`: \`${command}\``), "No package scripts detected")}

## App Routes And Entry Points

${markdownList(analysis.routeFiles.map((file) => `\`${file}\``), "No route files detected")}

## Tests Detected

${markdownList(analysis.testFiles.map((file) => `\`${file}\``), "No test files detected")}

## Top-Level Directories

${markdownList(analysis.directories.map((dir) => `\`${dir}\``), "No directories detected")}

## Initial Risk Notes

- Treat existing behavior as canonical until verified by tests or browser QA.
- Do not rewrite architecture during migration.
- Preserve existing Claude/project guidance.
- Run gates before ship because migration only inventories the repo.`,
    force,
    written,
    preserved,
  );

  writeMaybe(
    join(planning, "PROJECT.md"),
    `# ${name}

## Vision

Existing codebase imported into A-Stack. Preserve current product behavior while improving planning, verification, security, UI quality, and ship readiness.

## Current Stack

- Frameworks: ${analysis.frameworks.join(", ") || "unknown"}
- Data: ${analysis.data.join(", ") || "none detected"}
- Auth: ${analysis.auth.join(", ") || "none detected"}
- Deployment: ${analysis.deployment.join(", ") || "none detected"}

## Runtime Defaults

- Mode: full-yolo with hard gates.
- Memory: markdown source of truth with derived index.
- Quality gates: slop negator, security, browser QA when UI exists, SEO for public routes, ship readiness.

## Current Goal

Continue development from the existing codebase with A-Stack context, task queue, dashboard visibility, and verification gates.`,
    force,
    written,
    preserved,
  );

  writeMaybe(
    join(planning, "REQUIREMENTS.md"),
    `# Requirements

## REQ-001: Preserve Existing Behavior

Acceptance:
- Existing routes and core workflows continue to work.
- Migration does not rewrite product code.
- Future changes document behavior changes explicitly.

## REQ-002: Establish Verification

Acceptance:
- Test, build, lint, or documented manual verification exists for changed areas.
- Browser QA covers primary UI flows when the app has a frontend.
- Failed verification blocks ship until fixed or explicitly documented.

## REQ-003: Security Baseline

Acceptance:
- No committed live secrets.
- Auth and authorization are server-side where accounts or private data exist.
- CyberReview and deterministic security scan have no unresolved critical findings.

## REQ-004: A-Stack Operability

Acceptance:
- ${BT}.planning/STATE.md${BT} tells the next agent what to do.
- Dashboard state can be loaded.
- Tasks can be queued from CLI or UI.
- Gates are tracked before release.`,
    force,
    written,
    preserved,
  );

  writeMaybe(
    join(planning, "ROADMAP.md"),
    `# Roadmap

## Phase 0: Migration And Orientation

- Inventory stack, scripts, routes, tests, auth/data/deploy files.
- Create A-Stack config, migration report, state, tasks, and dashboard event.
- Verification: migration command completes and dashboard state loads.

## Phase 1: Baseline Verification

- Run existing test/build/lint scripts where available.
- Add or document missing verification commands.
- Run browser QA for UI projects.

## Phase 2: Security And Quality Hardening

- Run CyberReview and deterministic security scan.
- Fix critical findings.
- Run slop negator for UI/product quality issues in touched surfaces.

## Phase 3: Normal A-Stack Delivery

- Route tasks through plan, execute, verify, security, QA, SEO, and ship readiness.
- Use parallel execution only after file ownership is clear.`,
    force,
    written,
    preserved,
  );

  writeMaybe(
    join(planning, "STATE.md"),
    `# State

- project: ${name}
- migrated_at: ${now}
- current_phase: 0
- status: migrated
- next_action: Run baseline gates, then process the next queued task.
- hard_gates: security-critical, failed-verification, missing-credentials, destructive-actions`,
    force,
    written,
    preserved,
  );

  appendClaudeMigrationBlock(targetRoot, { ...analysis, name }, force, written, preserved);
  const tasks = seedMigrationTasks(targetRoot, analysis);
  const event = stateAddEvent(targetRoot, {
    type: "stack-migrated",
    title: "A-Stack migrated existing repo",
    details: `${analysis.frameworks.join(", ") || "unknown stack"} with ${analysis.totalIndexedFiles} indexed files`,
    source: "migrate",
  });

  console.log(
    JSON.stringify(
      {
        migrated: true,
        target: targetRoot,
        project: name,
        analysis,
        written: written.map((path) => path.slice(targetRoot.length + 1)),
        preserved: preserved.map((path) => path.slice(targetRoot.length + 1)),
        tasksAdded: tasks.length,
        event: event.id,
        next: "Run node scripts/a-stack.mjs gates --target <repo> with --ui/--public as applicable.",
      },
      null,
      2,
    ),
  );
}

function detectPackageManager(targetRoot) {
  if (existsSync(join(targetRoot, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(targetRoot, "yarn.lock"))) return "yarn";
  if (existsSync(join(targetRoot, "bun.lockb")) || existsSync(join(targetRoot, "bun.lock"))) return "bun";
  return "npm";
}

function runScript(targetRoot, scriptName, pm) {
  const cmd =
    pm === "pnpm" ? ["pnpm", "run", scriptName] :
    pm === "yarn" ? ["yarn", scriptName] :
    pm === "bun" ? ["bun", "run", scriptName] :
    ["npm", "run", "--silent", scriptName];
  const result = spawnSync(cmd[0], cmd.slice(1), { cwd: targetRoot, encoding: "utf8" });
  const tail = (text) => (text || "").trim().split(/\r?\n/).slice(-20).join("\n");
  return {
    status: result.status === 0 ? "pass" : "fail",
    exitCode: result.status,
    pm,
    command: cmd.join(" "),
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
  };
}

function runDependencyAudit(targetRoot, pm) {
  if (!existsSync(join(targetRoot, "package.json"))) {
    return { status: "skip", reason: "no package.json" };
  }
  const cmd =
    pm === "pnpm" ? ["pnpm", "audit", "--json"] :
    pm === "yarn" ? ["yarn", "npm", "audit", "--json"] :
    pm === "bun" ? null :
    ["npm", "audit", "--json"];
  if (!cmd) return { status: "skip", reason: `${pm} audit not supported` };
  const result = spawnSync(cmd[0], cmd.slice(1), { cwd: targetRoot, encoding: "utf8" });
  let parsed = null;
  try {
    parsed = result.stdout ? JSON.parse(result.stdout) : null;
  } catch {
    parsed = null;
  }
  const meta = parsed?.metadata?.vulnerabilities || parsed?.advisories ? parsed.metadata?.vulnerabilities : null;
  const highCritical = meta ? (meta.high || 0) + (meta.critical || 0) : null;
  if (highCritical === null) {
    return {
      status: result.status === 0 ? "pass" : "skip",
      reason: result.status === 0 ? "no advisories reported" : "audit unavailable or unparseable",
      exitCode: result.status,
    };
  }
  return {
    status: highCritical > 0 ? "fail" : "pass",
    high: meta.high || 0,
    critical: meta.critical || 0,
    moderate: meta.moderate || 0,
    low: meta.low || 0,
    command: cmd.join(" "),
  };
}

function gates() {
  const targetRoot = flag("target", root());
  const stackRoot = root();
  const planning = join(targetRoot, ".planning");
  const scripts = packageScripts(targetRoot);
  const pm = detectPackageManager(targetRoot);
  const statuses = [];
  const skipFlags = {
    test: boolFlag("skip-tests"),
    build: boolFlag("skip-build"),
    lint: boolFlag("skip-lint"),
    audit: boolFlag("skip-audit"),
  };

  const security = runNodeScript(join(stackRoot, "scripts", "security-scan.mjs"), [targetRoot], stackRoot);
  const securityJson = security.stdout ? JSON.parse(security.stdout) : { findings: [], critical: 0 };
  statuses.push({
    gate: "security-scan",
    status: securityJson.critical > 0 ? "fail" : "pass",
    critical: securityJson.critical,
    findings: securityJson.findings.length,
  });

  for (const scriptName of ["test", "build", "lint"]) {
    if (skipFlags[scriptName]) {
      statuses.push({ gate: `script:${scriptName}`, status: "skip", reason: `--skip-${scriptName} flag` });
      continue;
    }
    if (!scripts[scriptName]) {
      statuses.push({ gate: `script:${scriptName}`, status: "skip", reason: `no ${scriptName} script in package.json` });
      continue;
    }
    const result = runScript(targetRoot, scriptName, pm);
    statuses.push({ gate: `script:${scriptName}`, ...result });
  }

  if (skipFlags.audit) {
    statuses.push({ gate: "dependency-audit", status: "skip", reason: "--skip-audit flag" });
  } else {
    statuses.push({ gate: "dependency-audit", ...runDependencyAudit(targetRoot, pm) });
  }

  if (boolFlag("ui") && !boolFlag("skip-browser-qa")) {
    const urls = (() => {
      const out = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === "--qa-url" && args[i + 1]) out.push(args[i + 1]);
      }
      return out.length ? out : ["/"];
    })();
    const qaArgs = ["--target", targetRoot];
    for (const url of urls) qaArgs.push("--url", url);
    const port = flag("qa-port", "");
    if (port) qaArgs.push("--port", port);
    const result = spawnSync("node", [join(stackRoot, "scripts", "qa-browser.mjs"), ...qaArgs], {
      encoding: "utf8",
    });
    let parsed = null;
    try { parsed = result.stdout ? JSON.parse(result.stdout) : null; } catch { parsed = null; }
    statuses.push({
      gate: "browser-qa",
      status: result.status === 0 ? "pass" : "fail",
      exitCode: result.status,
      report: parsed?.report,
      reason: parsed?.reason,
    });
  } else {
    statuses.push({ gate: "browser-qa", status: boolFlag("ui") ? "skip" : "not-required", reason: boolFlag("ui") ? "--skip-browser-qa flag" : undefined });
  }

  statuses.push({ gate: "seo-audit", status: boolFlag("public") ? "required" : "not-required" });

  function fmt(item) {
    let line = `- ${item.gate}: ${item.status}`;
    if (item.critical !== undefined && item.findings !== undefined) {
      line += ` (${item.critical} critical, ${item.findings} findings)`;
    }
    if (item.exitCode !== undefined && item.exitCode !== null) line += ` [exit ${item.exitCode}]`;
    if (item.command) line += ` — ${item.command}`;
    if (item.reason) line += ` (${item.reason})`;
    return line;
  }

  const report = `# A-Stack Gates

## ${new Date().toISOString()}

${statuses.map(fmt).join("\n")}

## Security Findings

\`\`\`json
${JSON.stringify(securityJson.findings, null, 2)}
\`\`\`

## Failed Script Output

${statuses
  .filter((item) => item.status === "fail" && (item.stdoutTail || item.stderrTail))
  .map((item) => `### ${item.gate}\n\n${BT}${BT}${BT}\n${item.stderrTail || item.stdoutTail}\n${BT}${BT}${BT}`)
  .join("\n\n") || "_None_"}`;

  write(join(planning, "GATES.md"), report);
  console.log(JSON.stringify({ target: targetRoot, packageManager: pm, statuses, report: ".planning/GATES.md" }, null, 2));
  process.exit(statuses.some((item) => item.status === "fail") ? 1 : 0);
}

function gitInfo(targetRoot) {
  const run = (gitArgs) => spawnSync("git", ["-C", targetRoot, ...gitArgs], { encoding: "utf8" });
  if (run(["rev-parse", "--is-inside-work-tree"]).status !== 0) {
    return { branch: "unknown", filesModified: [] };
  }
  const branch = run(["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim() || "unknown";
  const filesModified = run(["status", "--short"]).stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
  return { branch, filesModified };
}

function stampNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// Curated from gstack /context-save: rich, branch-aware, append-only checkpoints
// (frontmatter + Decisions/Remaining/Notes) plus a concise current.md pointer
// that the SessionStart hook and statusline read.
function saveSession() {
  // Session state is PROJECT-local: it belongs in the project's .planning/,
  // never in the A-Stack install. Default the target to the cwd (the project),
  // not ASTACK_ROOT.
  const targetRoot = flag("target", process.env.CLAUDE_PROJECT_DIR || process.cwd());

  if (args[1] === "list") return saveSessionList(targetRoot);

  const next = flag("next", "Route the next user request through A-Stack.");
  const blocker = flag("blocker", "none");
  const status = flag("status", "in-progress");
  const title = flag("title", "session checkpoint");
  const decisions = flag("decisions", "");
  const notes = flag("notes", "");
  const now = new Date().toISOString();
  const { branch, filesModified } = gitInfo(targetRoot);

  const notesBody = [notes, blocker !== "none" ? `Blocker: ${blocker}` : ""].filter(Boolean).join("\n") || "none";
  const checkpoint = `---
status: ${status}
branch: ${branch}
timestamp: ${now}
target: ${targetRoot}
files_modified:
${filesModified.length ? filesModified.map((f) => `  - ${f}`).join("\n") : "  []"}
---

## Working on: ${title}
tags: session checkpoint resume

### Summary

${flag("summary", title)}

### Decisions Made

${decisions || "none recorded"}

### Remaining Work

${next}

### Notes

${notesBody}`;

  const slug = slugify(title);
  const checkpointFile = join(targetRoot, ".planning", "sessions", "checkpoints", `${stampNow()}-${slug}.md`);
  write(checkpointFile, checkpoint);

  // Concise resume pointer (read by SessionStart hook + statusline).
  const pointer = `# Current Session
tags: session state resume

## ${now}

- status: ${status}
- branch: ${branch}
- next_action: ${next}
- blocker: ${blocker}
- target: ${targetRoot}
- checkpoint: ${checkpointFile.slice(targetRoot.length + 1)}`;
  write(join(targetRoot, ".planning", "SESSION.md"), pointer);

  console.log(
    JSON.stringify(
      {
        saved: true,
        checkpoint: checkpointFile.slice(targetRoot.length + 1),
        branch,
        filesModified: filesModified.length,
        target: targetRoot,
      },
      null,
      2,
    ),
  );
}

function saveSessionList(targetRoot) {
  const all = boolFlag("all");
  const dir = join(targetRoot, ".planning", "sessions", "checkpoints");
  const currentBranch = gitInfo(targetRoot).branch;
  let files = [];
  try {
    files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")).sort().reverse() : [];
  } catch {
    files = [];
  }
  const checkpoints = files
    .map((file) => {
      const content = readFileSync(join(dir, file), "utf8");
      const fm = (key) => content.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]?.trim() || "";
      const title = content.match(/^##\s+Working on:\s*(.+)$/m)?.[1]?.trim() || file.replace(/\.md$/, "");
      return { file, title, status: fm("status"), branch: fm("branch"), timestamp: fm("timestamp") };
    })
    .filter((cp) => all || !currentBranch || currentBranch === "unknown" || cp.branch === currentBranch);
  console.log(JSON.stringify({ branch: all ? "all" : currentBranch, count: checkpoints.length, checkpoints }, null, 2));
}

function taskCommand() {
  const subcommand = args[1] || "list";
  const targetRoot = flag("target", root());

  if (subcommand === "add") {
    const title = flag("title", args.slice(2).filter((arg) => !arg.startsWith("--")).join(" "));
    const task = stateAddTask(targetRoot, {
      title,
      details: flag("details", ""),
      agent: flag("agent", "claude-code"),
      priority: flag("priority", "normal"),
      intent: flag("intent", "route"),
    });
    console.log(JSON.stringify({ task }, null, 2));
    return;
  }

  if (subcommand === "next") {
    const tasks = loadTasks(targetRoot).tasks;
    const next = tasks.find((task) => task.status === "queued") || null;
    console.log(JSON.stringify({ task: next }, null, 2));
    return;
  }

  if (subcommand === "update") {
    const task = stateUpdateTask(targetRoot, flag("id"), {
      status: flag("status", undefined),
      agent: flag("agent", undefined),
      priority: flag("priority", undefined),
    });
    console.log(JSON.stringify({ task }, null, 2));
    return;
  }

  console.log(JSON.stringify(loadTasks(targetRoot), null, 2));
}

function eventCommand() {
  const targetRoot = flag("target", root());
  const event = stateAddEvent(targetRoot, {
    type: flag("type", "note"),
    title: flag("title", args.slice(1).filter((arg) => !arg.startsWith("--")).join(" ") || "event"),
    details: flag("details", ""),
    tokensIn: flag("tokens-in", "0"),
    tokensOut: flag("tokens-out", "0"),
    costUsd: flag("cost-usd", "0"),
    source: flag("source", "cli"),
  });
  console.log(JSON.stringify({ event }, null, 2));
}

function dashboardState() {
  console.log(JSON.stringify(collectDashboardState({ targetRoot: flag("target", root()), stackRoot: root() }), null, 2));
}

function dashboard() {
  const sub = args[1] && !args[1].startsWith("--") ? args[1] : "";
  const port = flag("port", process.env.ASTACK_DASHBOARD_PORT || "4317");
  const target = flag("target", root());

  if (sub === "stop") {
    console.log(JSON.stringify(stopDashboard({ port }), null, 2));
    return;
  }
  if (sub === "status") {
    console.log(JSON.stringify(dashboardStatus({ port }), null, 2));
    return;
  }
  if (sub === "start") {
    // Background/detached — survives this process so a session can launch it.
    console.log(JSON.stringify(startDashboard({ stackRoot: root(), target, port }), null, 2));
    return;
  }

  // Default: foreground (blocks, streams logs) — interactive use.
  const result = spawnSync(
    "node",
    [join(scriptsDir, "dashboard-server.mjs"), "--stack-root", root(), "--target", target, "--port", port],
    { stdio: "inherit" },
  );
  process.exit(result.status || 0);
}

function doctor() {
  const targetRoot = root();
  const required = [
    "SKILL.md",
    "README.md",
    "LICENSE",
    ".claude-plugin/plugin.json",
    ".claude-plugin/marketplace.json",
    "skills/a-stack-router/SKILL.md",
    "skills/a-stack-ai-council/SKILL.md",
    "skills/a-stack-cyber-review/SKILL.md",
    "scripts/a-stack.mjs",
    "scripts/router.mjs",
    "scripts/learning.mjs",
    "scripts/memory-index.mjs",
    "scripts/security-scan.mjs",
    "scripts/stack-state.mjs",
    "scripts/dashboard-server.mjs",
    "scripts/ai-council.mjs",
    "scripts/qa-browser.mjs",
    "scripts/hooks/user-prompt-router.mjs",
    "scripts/hooks/pretool-bash-guard.mjs",
    "scripts/hooks/posttool-activity.mjs",
    "scripts/hooks/session-hook.mjs",
    "scripts/statusline.mjs",
    "scripts/checkpoint.mjs",
    "scripts/learnings.mjs",
    "scripts/dashboard-control.mjs",
    "scripts/agent-counter.mjs",
    "dashboard/index.html",
    "dashboard/app.js",
    "dashboard/styles.css",
    "commands/route.md",
    "commands/plan.md",
    "commands/execute.md",
    "commands/migrate.md",
    "commands/security-review.md",
    "commands/ui-review.md",
    "commands/qa.md",
    "commands/qa-browser.md",
    "commands/seo.md",
    "commands/ship.md",
    "commands/debug.md",
    "commands/gates.md",
    "commands/dashboard.md",
    "agents/planner.md",
    "agents/executor.md",
    "agents/security-reviewer.md",
    "agents/qa-tester.md",
    "agents/ui-reviewer.md",
    "agents/release-manager.md",
    "workflows/new-app.md",
    "workflows/migrate.md",
    "workflows/execute.md",
    "workflows/orchestration.md",
    "workflows/ship.md",
    "knowledge/stacks/preferred-web-stack.md",
    "knowledge/preferences/voice.md",
    ".github/workflows/test.yml",
  ];
  const checks = required.map((file) => ({ file, ok: existsSync(join(targetRoot, file)) }));

  let pluginRegistry = { commands: 0, agents: 0, hooks: 0, statusLine: false, marketplace: false, ok: false };
  try {
    const plugin = readJson(join(targetRoot, ".claude-plugin", "plugin.json"), {});
    pluginRegistry = {
      commands: Array.isArray(plugin.commands) ? plugin.commands.length : 0,
      agents: Array.isArray(plugin.agents) ? plugin.agents.length : 0,
      hooks: plugin.hooks && typeof plugin.hooks === "object" ? Object.keys(plugin.hooks).length : 0,
      statusLine: Boolean(plugin.statusLine),
      marketplace: existsSync(join(targetRoot, ".claude-plugin", "marketplace.json")),
      ok: true,
    };
  } catch {
    pluginRegistry.ok = false;
  }

  const tools = ["node", "npm", "git", "codex", "gemini"].map((tool) => ({
    tool,
    ok: commandExists(tool),
    optional: ["codex", "gemini"].includes(tool),
  }));
  const ok =
    checks.every((check) => check.ok) &&
    tools.filter((tool) => !tool.optional).every((tool) => tool.ok) &&
    pluginRegistry.ok;
  console.log(JSON.stringify({ ok, checks, tools, plugin: pluginRegistry }, null, 2));
  process.exit(ok ? 0 : 1);
}

// Self-contained, offline, auto-cleaning proof of the core claims. Runs the
// real CLI (route/init-project/gates/security-scan) against a throwaway project
// so a first-time user can watch gates pass on clean code and FAIL on a planted
// secret — "real gates, not vibes" — in ~10 seconds, then deletes everything.
function demo() {
  const self = join(scriptsDir, "a-stack.mjs");
  const scanScript = join(scriptsDir, "security-scan.mjs");
  const tmpRoot = mkdtempSync(join(tmpdir(), "a-stack-demo-"));
  const proj = join(tmpRoot, "sample-app");
  mkdirSync(proj, { recursive: true });

  const runJson = (cmdArgs, script = self) => {
    const result = spawnSync("node", [script, ...cmdArgs], { encoding: "utf8" });
    let parsed = null;
    try {
      parsed = JSON.parse(result.stdout);
    } catch {
      parsed = null;
    }
    return { parsed, status: result.status, stdout: result.stdout };
  };
  const line = (text = "") => console.log(text);

  try {
    line("A-Stack demo — proving the core claims in a throwaway project.");
    line("Everything runs offline in a temp dir and is deleted at the end.");
    line("");

    line("1) Natural-language routing (no slash commands to memorize):");
    const phrases = [
      "build me a SaaS dashboard for invoice follow-up",
      "the login redirect is broken",
      "review my auth code for security vulnerabilities",
      "ship it to production",
    ];
    for (const phrase of phrases) {
      const { parsed } = runJson(["route", phrase]);
      line(`   "${phrase}"`);
      line(`      -> ${parsed ? parsed.intent : "?"}  (${parsed ? parsed.workflow : "?"})`);
    }
    line("");

    line("2) GSD-style planning artifacts:");
    runJson(["init-project", "--target", proj, "--name", "Demo App", "--idea", "a sample app for the A-Stack demo"]);
    const planning = join(proj, ".planning");
    for (const file of ["PROJECT.md", "REQUIREMENTS.md", "ROADMAP.md", "STATE.md"]) {
      line(`   ${existsSync(join(planning, file)) ? "ok" : "MISSING"}  .planning/${file}`);
    }
    line("");

    line("3) Real gates on clean code (each one actually executes):");
    writeFileSync(
      join(proj, "package.json"),
      JSON.stringify(
        { name: "demo-app", private: true, scripts: { test: 'node -e "process.exit(0)"', build: 'node -e "process.exit(0)"' } },
        null,
        2,
      ),
    );
    writeFileSync(join(proj, "index.js"), "export const hello = () => 'world';\n");
    const gatesPass = runJson(["gates", "--target", proj, "--skip-audit"]);
    for (const gate of (gatesPass.parsed && gatesPass.parsed.statuses) || []) {
      if (["security-scan", "script:test", "script:build"].includes(gate.gate)) {
        line(`   ${gate.status === "pass" ? "PASS" : gate.status.toUpperCase()}  ${gate.gate}`);
      }
    }
    line(`   gates exit code: ${gatesPass.status} (0 = clean)`);
    line("");

    line('4) "Not vibes": plant a leaked API key and watch the scanner block it:');
    writeFileSync(join(proj, "leak.ts"), "const key = 'sk-proj_12345678901234567890';\n");
    const scan = runJson([proj], scanScript);
    const findings = scan.parsed && Array.isArray(scan.parsed.findings) ? scan.parsed.findings : [];
    const first = findings[0];
    line(`   scanner exit code: ${scan.status} (non-zero = build blocked)`);
    line(`   patterns scanned: ${scan.parsed ? scan.parsed.scannedPatterns : "?"}`);
    line(
      `   findings: ${findings.length}${first ? ` — ${first.severity} "${first.id}" in ${first.file}:${first.line}` : ""}`,
    );
    line("");

    line("That's the pitch: routing + planning + gates that PASS on clean code");
    line("and FAIL on real problems. Nothing here was hardcoded — it just ran.");
    line("");
    line("Install:  /plugin marketplace add Abhinav-ranish/A-Stack");
    line("          /plugin install a-stack@a-stack");
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
  process.exit(0);
}

function help() {
  console.log(`A-Stack

Usage:
  node scripts/a-stack.mjs demo                                      # 10s offline proof of routing + gates
  node scripts/a-stack.mjs route "<request>"
  node scripts/a-stack.mjs init-project --name "App" --idea "..." [--target <dir>]
  node scripts/a-stack.mjs migrate --target <existing-repo> [--force]
  node scripts/a-stack.mjs gates --target <repo> [--ui] [--public]
  node scripts/a-stack.mjs task add --target <repo> --title "..." [--agent claude-code|codex]
  node scripts/a-stack.mjs task next --target <repo>
  node scripts/a-stack.mjs event --target <repo> --type vulnerability-patched --title "..."
  node scripts/a-stack.mjs dashboard --target <repo> [--port 4317]   # foreground
  node scripts/a-stack.mjs dashboard start --target <repo>            # background
  node scripts/a-stack.mjs dashboard status | dashboard stop
  node scripts/a-stack.mjs dashboard-state --target <repo>
  node scripts/a-stack.mjs save-session --title "..." --next "..." [--decisions "..."] [--notes "..."]
  node scripts/a-stack.mjs save-session list [--all]
  node scripts/a-stack.mjs learn add --insight "..." [--key ...] [--tags "..."]
  node scripts/a-stack.mjs learn search "<query>"
  node scripts/a-stack.mjs checkpoint commit --target <repo> --message "..." [--remaining "..."] [--files "a b"]
  node scripts/a-stack.mjs checkpoint mode [continuous|explicit] --target <repo>
  node scripts/a-stack.mjs doctor
`);
}

function delegate(scriptName, { injectRoot = false } = {}) {
  const passthrough = args.slice(1);
  if (injectRoot && !passthrough.includes("--root")) passthrough.push("--root", root());
  const result = spawnSync("node", [join(scriptsDir, scriptName), ...passthrough], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "inherit",
  });
  process.exit(result.status ?? 0);
}

if (command === "route") doRoute();
else if (command === "demo") demo();
else if (command === "init-project") initProject();
else if (command === "migrate") migrate();
else if (command === "gates") gates();
else if (command === "task") taskCommand();
else if (command === "event") eventCommand();
else if (command === "dashboard") dashboard();
else if (command === "dashboard-state") dashboardState();
else if (command === "save-session") saveSession();
else if (command === "learn") delegate("learnings.mjs");
else if (command === "checkpoint") delegate("checkpoint.mjs");
else if (command === "doctor") doctor();
else help();
