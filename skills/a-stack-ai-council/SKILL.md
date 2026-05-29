---
name: a-stack-ai-council
description: Multi-model review council for UI, UX, product uncertainty, and high-risk decisions. Uses Codex, Gemini, and Claude perspectives with cross-round critique, then produces a prioritized verdict. Use for visual slop, unclear product direction, design taste disputes, or when an agent is unsure and needs adversarial review.
---

# A-Stack AI Council

AI Council is a quality gate, not a brainstorming toy. Use it when a decision could create slop or when UI/product direction is uncertain.

## Reviewers

- **Codex Architect**: hierarchy, accessibility, spacing, typography, implementation polish.
- **Gemini Visionary**: distinctiveness, mood, brand voice, memorability.
- **Claude Product Judge**: user goal, tradeoffs, feasibility, final prioritization.

## Visual Workflow

1. Capture screenshot with:
   ```bash
   node ai-council/scripts/screenshot.mjs <url> <out-dir> [width] [height] [--mobile]
   ```
2. Read `ai-council/references/personas.md`.
3. Run Codex and Gemini round 1 independently.
4. Run cross-talk round 2.
5. Claude synthesizes a verdict:
   - top 3 fixes
   - agreed findings
   - split decisions
   - skipped/deferred items
   - implementation targets

## Non-Visual Workflow

Use the same council structure for product/architecture uncertainty:

- Codex reviews technical feasibility and implementation risk.
- Gemini reviews product distinctiveness and user appeal.
- Claude decides the smallest shippable path.

Keep council output short and actionable. Prefer fixes that remove slop or risk before adding scope.
