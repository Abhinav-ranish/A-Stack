import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { collectDashboardState } from "../scripts/stack-state.mjs";

test("dashboard derives current phase from a '## Phase status' checklist", () => {
  const target = mkdtempSync(join(tmpdir(), "a-stack-dstate-"));
  const stack = mkdtempSync(join(tmpdir(), "a-stack-dstate-stack-"));
  try {
    mkdirSync(join(target, ".planning"), { recursive: true });
    writeFileSync(
      join(target, ".planning", "STATE.md"),
      [
        "# STATE — Demo",
        "",
        "## Current stage",
        "Executing Phase 1.",
        "",
        "## Phase status",
        "- [x] P0 Foundation — DONE",
        "- [ ] P1 Connectors",
        "- [ ] P2 Tailoring",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(target, ".planning", "ROADMAP.md"),
      ["# ROADMAP", "", "## Phase 0 — Foundation", "## Phase 1 — Connector service", "## Phase 2 — Tailoring", ""].join("\n"),
    );

    const state = collectDashboardState({ targetRoot: target, stackRoot: stack });
    assert.equal(state.project.currentPhase, 1, "first unchecked phase is current");
    assert.equal(state.project.phasesDone, 1);
    assert.equal(state.project.phasesTotal, 3);
    assert.match(state.project.currentStage, /Connector service/);
    assert.match(state.project.currentStage, /1\/3 phases done/);

    // Roadmap tracker: per-phase status with titles.
    assert.equal(state.phases.length, 3);
    assert.equal(state.phases[0].status, "done");
    assert.equal(state.phases[1].status, "current");
    assert.equal(state.phases[2].status, "todo");
    assert.match(state.phases[1].title, /Connector service/);

    // Agents + git panels present and well-formed.
    assert.ok(Array.isArray(state.agents));
    assert.equal(state.git.isRepo, false, "temp target is not a git repo");
  } finally {
    rmSync(target, { recursive: true, force: true });
    rmSync(stack, { recursive: true, force: true });
  }
});

test("dashboard reports the live session cost when the status line recorded it", () => {
  const target = mkdtempSync(join(tmpdir(), "a-stack-cost-"));
  const stack = mkdtempSync(join(tmpdir(), "a-stack-cost-stack-"));
  try {
    mkdirSync(join(target, ".planning"), { recursive: true });
    writeFileSync(
      join(target, ".planning", ".astack-cost.json"),
      JSON.stringify({ costUsd: 3.81, model: "Opus 4.7", durationMs: 563000, sessionId: "s1" }),
    );
    const state = collectDashboardState({ targetRoot: target, stackRoot: stack });
    assert.equal(state.costs.measured, true);
    assert.equal(state.costs.costUsd, 3.81);
    assert.equal(state.costs.model, "Opus 4.7");
    assert.equal(state.costs.durationLabel, "9m 23s");
    assert.equal(state.costs.source, "session (statusline)");
  } finally {
    rmSync(target, { recursive: true, force: true });
    rmSync(stack, { recursive: true, force: true });
  }
});
