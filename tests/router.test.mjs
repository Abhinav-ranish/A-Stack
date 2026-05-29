import assert from "node:assert/strict";
import { test } from "node:test";
import { route } from "../scripts/router.mjs";

test("routes new web-app requests to new-app workflow", () => {
  const result = route("build me a SaaS dashboard for creators");
  assert.equal(result.intent, "new-app");
  assert.equal(result.workflow, "workflows/new-app.md");
  assert.equal(result.mode, "full-yolo");
});

test("routes security requests to security review", () => {
  const result = route("run a cyber security audit for auth and exposed secrets");
  assert.equal(result.intent, "security-review");
  assert.equal(result.workflow, "workflows/security-review.md");
});

test("routes ship requests to ship workflow", () => {
  const result = route("ship this and deploy it to production");
  assert.equal(result.intent, "ship");
  assert.equal(result.workflow, "workflows/ship.md");
});

test("falls back to find-skill for unknown work", () => {
  const result = route("transcribe flute sheet music into midi");
  assert.equal(result.intent, "find-skill");
});

test("routes short bug-fix requests to debug", () => {
  const result = route("fix this bug");
  assert.equal(result.intent, "debug");
  assert.equal(result.workflow, "workflows/debug.md");
});

test("routes 'not working' phrasing to debug", () => {
  const result = route("the login form is not working in production");
  assert.equal(result.intent, "debug");
});

test("routes stack-trace style descriptions to debug", () => {
  const result = route("getting a stack trace when I click submit");
  assert.equal(result.intent, "debug");
});

test("routes unknown nonsense to find-skill", () => {
  const result = route("xyzzy plugh quux");
  assert.equal(result.intent, "find-skill");
});

test("router defaults to full-yolo mode", () => {
  const result = route("build me a SaaS dashboard");
  assert.equal(result.mode, "full-yolo");
});

test("router detects review-only mode", () => {
  const result = route("review only the auth code — don't fix anything");
  assert.equal(result.mode, "review-only");
  assert.equal(result.intent, "security-review");
});

test("router detects interactive mode", () => {
  const result = route("ask me first before each change while you fix the bug");
  assert.equal(result.mode, "interactive");
  assert.equal(result.intent, "debug");
});

test("router preserves explicit yolo override", () => {
  const result = route("yolo it — just ship");
  assert.equal(result.mode, "full-yolo");
});

test("routes self-learning requests", () => {
  const result = route("add self learning so it can improve over time from successful patterns");
  assert.equal(result.intent, "self-learning");
  assert.equal(result.workflow, "workflows/self-learning.md");
});

test("routes existing repo import requests to migrate", () => {
  const result = route("this repo already has code, run /migrate so a-stack understands it");
  assert.equal(result.intent, "migrate");
  assert.equal(result.workflow, "workflows/migrate.md");
});
