---
name: ai-council
description: Multi-AI critique panel for UI/UX, product uncertainty, and high-risk decisions. Captures a screenshot when visual review is needed, asks Codex CLI and Gemini CLI to review from distinct personas, has Claude act as product judge, exchanges critiques between models, and produces a prioritized punch list of fixes. Use when the user asks to "convene the council", "ai council", "council review", "panel review my UI", "have the AIs argue about my design", or wants multiple AI perspectives before implementing fixes.
---

# AI Council

Three reviewers debate the UI or product decision, then Claude synthesizes a punch list.

- **Architect** (Codex CLI) — typography, hierarchy, spacing, alignment, polish, accessibility
- **Visionary** (Gemini CLI) — distinctiveness, mood, brand voice, "is this memorable?"
- **Product Judge** (Claude — you) — owns the user's actual goal, weighs trade-offs, rejects slop, ships the verdict

## Inputs

Ask the user for whichever of these aren't obvious from context:
1. **Target** — a URL (default `http://localhost:5173` if a Vite dev server is running) **or** a path to an existing screenshot
2. **Focus** — what they care about (e.g., "the home page", "the Netflix theme nav", "mobile layout")
3. **Viewports** — desktop only, or also mobile (default: 1440×900 desktop)

One round of clarification max.

## Workflow

### 1. Capture

If the user gave a screenshot path, skip to step 2. Otherwise:

```bash
node .claude/skills/ai-council/scripts/screenshot.mjs <url> <output-dir> [width] [height]
```

Use `/tmp/ai-council-$(date +%s)` as the output dir. The script writes `desktop.png` (and `mobile.png` if requested) into the output dir.

If `playwright` isn't installed in the project, the script falls back to `npx playwright@latest` and downloads chromium on first run (~30s).

### 2. Round 1 — independent critiques (parallel)

Run Codex and Gemini in parallel — single message, two `Bash` calls with `run_in_background: true`. Each gets only its own persona prompt; they do **not** see each other yet.

See `references/personas.md` for the full prompts and the exact CLI invocations.

Save outputs to `<output-dir>/round1-architect.md` and `<output-dir>/round1-visionary.md`.

### 3. Round 2 — cross-talk

Feed each AI the **other's** round-1 critique and ask them to respond: agree, push back, or add. Run in parallel again. See `references/personas.md` § "Round 2".

Save to `round2-architect.md` and `round2-visionary.md`.

### 4. Claude Product Judge

You — the Product Judge — produce the final report. Don't concatenate; decide.

Write to `<output-dir>/VERDICT.md` and surface inline:

```markdown
# Council Verdict — <page/URL>

## Top 3 fixes (ship these first)
1. <fix> — <one-line why> — <file/component to touch>
2. ...
3. ...

## Agreed (both AIs flagged this)
- ...

## Split decisions (Moderator's call)
- **<issue>** — Architect said X, Visionary said Y. **Verdict:** <call> because <reason tied to user's stated focus>.

## Skipped (raised but not worth it now)
- <issue> — <why deferred>
```

Then ask the user: "Want me to implement the top 3?"

## Non-Visual Council

If there is no screenshot but the agent is unsure about product direction, architecture scope, or whether an idea is slop:

1. Ask Codex for implementation risk, complexity, and verification gaps.
2. Ask Gemini for product distinctiveness, user appeal, and genericness.
3. Claude makes the final call and returns the smallest shippable path plus the top risks.

## Notes

- Both `codex` and `gemini` are at `/opt/homebrew/bin/`. If one is missing, tell the user and run a 2-person council with whichever is available.
- Codex accepts images via `-i <path>`. Gemini has no image flag — pass the **absolute path** in the prompt and it will read the file as part of its agent run.
- Don't paraphrase the persona prompts; pass them verbatim so rounds are reproducible.
- Don't run more than 2 rounds. Diminishing returns.
- Persona prompts already cap each critique at ~400 words; keep it that way.
