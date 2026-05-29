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

// Term-frequency map (counts, not deduped) — the raw material for BM25 ranking.
function termCounts(text) {
  const counts = Object.create(null);
  for (const token of text.toLowerCase().match(/[a-z0-9][a-z0-9-]{1,}/g) || []) {
    counts[token] = (counts[token] || 0) + 1;
  }
  return counts;
}

// BM25 tuning. k1 controls term-frequency saturation; b controls length
// normalization. Standard, conservative defaults.
const BM25_K1 = 1.5;
const BM25_B = 0.75;

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
  const df = Object.create(null); // document frequency per token
  let totalLen = 0;
  const docs = files.map((file) => {
    const content = readFileSync(file, "utf8");
    const title = content.match(/^#\s+(.+)$/m)?.[1] || basename(file);
    const tags = [...content.matchAll(/^tags:\s*(.+)$/gim)].flatMap((match) =>
      match[1]
        .split(/[, ]+/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    );
    // Term frequencies over the body, with title (x2) and tags (x3) boosted so
    // a hit in the heading or tags outranks a passing mention in the body.
    const tf = termCounts(content);
    for (const token of tokenize(title)) tf[token] = (tf[token] || 0) + 2;
    for (const token of tokenize(tags.join(" "))) tf[token] = (tf[token] || 0) + 3;
    const len = Object.values(tf).reduce((sum, n) => sum + n, 0);
    totalLen += len;
    for (const token of Object.keys(tf)) df[token] = (df[token] || 0) + 1;
    return {
      path: relative(root, file),
      hash: createHash("sha256").update(content).digest("hex"),
      title,
      summary: buildSummary(content),
      tags,
      tf,
      len,
      updatedAt: new Date().toISOString(),
    };
  });
  const index = { version: 3, kind: "bm25", n: docs.length, avgdl: docs.length ? totalLen / docs.length : 0, df, docs };
  writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  return { indexed: docs.length, indexPath: relative(root, indexPath), kind: "bm25" };
}

// Pure, side-effect-light search usable both from the CLI and from hooks.
// Builds the index on demand if it is missing. Returns ranked token-bag hits.
export function searchMemory({ query, root, limit = 10 }) {
  const { indexPath } = paths(root);
  if (!existsSync(indexPath)) buildIndex(root);
  let index = JSON.parse(readFileSync(indexPath, "utf8"));
  // Upgrade legacy (token-bag) indexes in place so search always ranks with BM25.
  if (index.kind !== "bm25" || !index.df) {
    buildIndex(root);
    index = JSON.parse(readFileSync(indexPath, "utf8"));
  }
  const { n, avgdl, df } = index;
  const queryTokens = tokenize(query);
  const results = index.docs
    .map((doc) => {
      let score = 0;
      for (const token of queryTokens) {
        const tf = doc.tf[token] || 0;
        if (!tf) continue;
        const docFreq = df[token] || 0;
        // BM25 IDF (always positive via the +1 smoothing) and TF saturation.
        const idf = Math.log(1 + (n - docFreq + 0.5) / (docFreq + 0.5));
        const denom = tf + BM25_K1 * (1 - BM25_B + (BM25_B * doc.len) / (avgdl || 1));
        score += idf * ((tf * (BM25_K1 + 1)) / denom);
      }
      return { path: doc.path, title: doc.title, summary: doc.summary || "", score: Number(score.toFixed(4)), tags: doc.tags };
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
