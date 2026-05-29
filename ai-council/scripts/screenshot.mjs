#!/usr/bin/env node
// Capture full-page screenshot(s) for the AI Council.
// Usage: node screenshot.mjs <url> <outDir> [width] [height] [--mobile]

import { mkdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const [, , urlArg, outDirArg, widthArg = "1440", heightArg = "900", ...flags] = process.argv;

if (!urlArg || !outDirArg) {
  console.error("Usage: screenshot.mjs <url> <outDir> [width] [height] [--mobile]");
  process.exit(2);
}

const outDir = resolve(outDirArg);
mkdirSync(outDir, { recursive: true });

const wantsMobile = flags.includes("--mobile");

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    try {
      return await import("playwright-core");
    } catch {
      console.error("Installing playwright on first run (one-time, ~30s)…");
      const r = spawnSync("npx", ["--yes", "playwright@latest", "install", "chromium"], {
        stdio: "inherit",
      });
      if (r.status !== 0) {
        console.error("Failed to install playwright. Install it manually: npm i -g playwright && npx playwright install chromium");
        process.exit(1);
      }
      return await import("playwright");
    }
  }
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();

async function shoot(name, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(urlArg, { waitUntil: "networkidle", timeout: 30_000 }).catch(async (e) => {
    console.error(`networkidle timed out (${e.message}); falling back to load`);
    await page.goto(urlArg, { waitUntil: "load", timeout: 30_000 });
  });
  // small settle delay for fonts / lazy bits
  await page.waitForTimeout(500);
  const path = `${outDir}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(path);
  await ctx.close();
}

await shoot("desktop", { width: Number(widthArg), height: Number(heightArg) });
if (wantsMobile) {
  await shoot("mobile", { width: 390, height: 844 });
}

await browser.close();
