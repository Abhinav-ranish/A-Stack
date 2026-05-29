#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

function walk(dir) {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    if (entry.isFile() && entry.name.endsWith(".md")) return [path];
    return [];
  });
}

function tokenize(text) {
  return [...new Set(text.toLowerCase().match(/[a-z0-9][a-z0-9-]{1,}/g) || [])];
}

function buildSummary(content) {
  const lines = content.split(/\r?\n/);
  const heading = lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, "").trim() || "";
  const firstPara = [];
  let inBody = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inBody) {
      if (/^#\s+/.test(trimmed) || /^tags:/i.test(trimmed) || trimmed === "") continue;
      inBody = true;
    }
    if (inBody) {
      if (trimmed === "") break;
      firstPara.push(trimmed);
    }
  }
  return [heading, firstPara.join(" ")].filter(Boolean).join(" — ").slice(0, 280);
}

function paths(root) {
  const knowledgeDir = join(root, "knowledge");
  return { knowledgeDir, indexPath: join(knowledgeDir, ".a-stack-index.json") };
}

export function buildIndex(root) {
  const { knowledgeDir, indexPath } = paths(root);
  mkdirSync(dirname(indexPath), { recursive: true });
  const files = walk(knowledgeDir).filter((file) => basename(file) !== ".a-stack-index.json");
  const docs = files.map((file) => {
    const content = readFileSync(file, "utf8");
    return {
      path: relative(root, file),
      hash: createHash("sha256").update(content).digest("hex"),
      title: content.match(/^#\s+(.+)$/m)?.[1] || basename(file),
      summary: buildSummary(content),
      tags: [...content.matchAll(/^tags:\s*(.+)$/gim)].flatMap((match) =>
        match[1]
          .split(/[, ]+/)
          .map((tag) => tag.trim())
          .filter(Boolean),
      ),
      tokens: tokenize(content),
      updatedAt: new Date().toISOString(),
    };
  });
  writeFileSync(indexPath, `${JSON.stringify({ version: 2, kind: "token-bag", docs }, null, 2)}\n`);
  return { indexed: docs.length, indexPath: relative(root, indexPath), kind: "token-bag" };
}

// Pure, side-effect-light search usable both from the CLI and from hooks.
// Builds the index on demand if it is missing. Returns ranked token-bag hits.
export function searchMemory({ query, root, limit = 10 }) {
  const { indexPath } = paths(root);
  if (!existsSync(indexPath)) buildIndex(root);
  const index = JSON.parse(readFileSync(indexPath, "utf8"));
  const queryTokens = tokenize(query);
  const results = index.docs
    .map((doc) => {
      const haystack = new Set([
        doc.title.toLowerCase(),
        ...doc.tags.map((tag) => tag.toLowerCase()),
        ...doc.tokens,
      ]);
      const score = queryTokens.reduce((sum, token) => sum + (haystack.has(token) ? 1 : 0), 0);
      return { path: doc.path, title: doc.title, summary: doc.summary || "", score, tags: doc.tags };
    })
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, limit);
  return { query, results };
}

function flagValue(allArgs, name, fallback = "") {
  const idx = allArgs.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const next = allArgs[idx + 1];
  return next === undefined ? fallback : next;
}

function nonFlagArgs(allArgs) {
  const out = [];
  for (let i = 0; i < allArgs.length; i++) {
    const arg = allArgs[i];
    if (arg.startsWith("--")) {
      const next = allArgs[i + 1];
      if (next !== undefined && !next.startsWith("--")) i += 1;
      continue;
    }
    out.push(arg);
  }
  return out;
}

function main() {
  const allArgs = process.argv.slice(2);
  const root = flagValue(allArgs, "root", process.env.ASTACK_ROOT || process.cwd());
  const positional = nonFlagArgs(allArgs);
  const command = positional[0] || "index";
  const query = positional.slice(1).join(" ").toLowerCase();

  if (command === "index") {
    console.log(JSON.stringify(buildIndex(root), null, 2));
  } else if (command === "search") {
    console.log(JSON.stringify(searchMemory({ query, root }), null, 2));
  } else if (command === "serve") {
    console.error("a-stack-memory MCP shim is not implemented yet. Use `node scripts/memory-index.mjs search <query>`.");
    process.exit(0);
  } else {
    console.error("Usage: memory-index.mjs index | search <query> | serve");
    process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
