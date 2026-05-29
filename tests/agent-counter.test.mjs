import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { activeAgents, agentStart, agentStop } from "../scripts/agent-counter.mjs";

test("agent counter tracks parallel subagents via start/stop", () => {
  const dir = mkdtempSync(join(tmpdir(), "a-stack-agents-"));
  const prev = process.env.ASTACK_STATE_DIR;
  process.env.ASTACK_STATE_DIR = dir;
  try {
    assert.equal(activeAgents(), 0);
    agentStart({ type: "a-stack-executor" });
    agentStart({ type: "a-stack-executor" });
    agentStart({ type: "a-stack-executor" });
    assert.equal(activeAgents(), 3);
    agentStop();
    assert.equal(activeAgents(), 2);
    agentStop();
    agentStop();
    assert.equal(activeAgents(), 0);
    agentStop(); // extra stop is a harmless no-op
    assert.equal(activeAgents(), 0);
  } finally {
    if (prev === undefined) delete process.env.ASTACK_STATE_DIR;
    else process.env.ASTACK_STATE_DIR = prev;
    rmSync(dir, { recursive: true, force: true });
  }
});
