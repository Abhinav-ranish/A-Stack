import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

test("security scan reports unsafe patterns", () => {
  const dir = mkdtempSync(join(tmpdir(), "a-stack-security-"));
  try {
    writeFileSync(
      join(dir, "route.ts"),
      "const key = 'sk-proj_12345678901234567890';\napp.get('/x', (req) => req.query.userId);\n",
    );
    const result = spawnSync("node", ["scripts/security-scan.mjs", dir], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    const parsed = JSON.parse(result.stdout);
    assert.ok(parsed.findings.some((finding) => finding.id === "openai-key"));
    assert.ok(parsed.findings.some((finding) => finding.id === "client-user-id-trust"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("security scan passes clean fixture", () => {
  const dir = mkdtempSync(join(tmpdir(), "a-stack-security-clean-"));
  try {
    writeFileSync(join(dir, "route.ts"), "const userId = session.user.id;\n");
    const output = execFileSync("node", ["scripts/security-scan.mjs", dir], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    const parsed = JSON.parse(output);
    assert.equal(parsed.critical, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("security scan detects multiple provider token shapes", () => {
  const dir = mkdtempSync(join(tmpdir(), "a-stack-security-multi-"));
  try {
    // Keys are assembled at runtime so the literal token shapes never appear
    // contiguously in committed source — that keeps GitHub push-protection /
    // secret-scanning quiet (these are fakes, not real keys) while the written
    // fixture file still contains full tokens for our scanner to catch.
    writeFileSync(
      join(dir, "leak.ts"),
      [
        `const gh = '${"ghp_" + "A".repeat(36)}';`,
        `const aws = '${"AKIA" + "EXAMPLEKEY1234WXYZ".slice(0, 16)}';`,
        `const stripe = '${"sk_live_" + "EXAMPLEFAKEKEY0000000000"}';`,
        `const google = '${"AIza" + "A".repeat(35)}';`,
      ].join("\n"),
    );
    const result = spawnSync("node", ["scripts/security-scan.mjs", dir], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    const parsed = JSON.parse(result.stdout);
    const ids = parsed.findings.map((f) => f.id);
    assert.ok(ids.includes("github-token"), "expected github-token");
    assert.ok(ids.includes("aws-access-key"), "expected aws-access-key");
    assert.ok(ids.includes("stripe-live-key"), "expected stripe-live-key");
    assert.ok(ids.includes("google-api-key"), "expected google-api-key");
    assert.equal(result.status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("security scan respects .a-stack/security-ignore.json", () => {
  const dir = mkdtempSync(join(tmpdir(), "a-stack-security-ignore-"));
  try {
    writeFileSync(join(dir, "leak.ts"), "const k = 'sk-proj-abcdefghijklmnopqrstuv';\n");
    const before = spawnSync("node", ["scripts/security-scan.mjs", dir], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    assert.equal(before.status, 1);

    execFileSync("mkdir", ["-p", join(dir, ".a-stack")]);
    writeFileSync(
      join(dir, ".a-stack", "security-ignore.json"),
      JSON.stringify({ ids: ["openai-key"] }),
    );

    const after = spawnSync("node", ["scripts/security-scan.mjs", dir], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    const parsed = JSON.parse(after.stdout);
    assert.equal(parsed.critical, 0);
    assert.equal(after.status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("security scan respects a-stack-ignore inline comment", () => {
  const dir = mkdtempSync(join(tmpdir(), "a-stack-security-inline-"));
  try {
    writeFileSync(
      join(dir, "leak.ts"),
      "const k = 'sk-proj-abcdefghijklmnopqrstuv'; // a-stack-ignore: fixture\n",
    );
    const result = spawnSync("node", ["scripts/security-scan.mjs", dir], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.critical, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
