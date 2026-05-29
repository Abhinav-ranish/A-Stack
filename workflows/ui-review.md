# UI Review Workflow

Use for UI, UX, frontend slop, design taste, screenshots, landing pages, dashboards, or when the agent is unsure about visual direction.

## Inputs

- URL or screenshot path.
- User focus if available.
- Desktop by default; include mobile for public/responsive pages.

## Flow

1. Read design memory:
   - `knowledge/preferences/design-taste.md`
   - `knowledge/skills/catalog.md`
2. Apply frontend baseline rules:
   - accessible primitives
   - clear hierarchy
   - no generic gradient/orb slop
   - responsive text and stable layouts
3. Use AI Council for high-risk visual decisions:
   - Codex: architecture/accessibility/polish
   - Gemini: distinctiveness/brand/memorability
   - Claude: product fit, tradeoffs, final verdict
4. Convert findings into a top-3 fix list.
5. If implementing fixes, rerun screenshot/browser verification.
