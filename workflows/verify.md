# Verify Workflow (gate → fix → re-run loop)

Use when the user wants work proven correct/secure before ship, or after any
non-trivial change to auth, data, APIs, UI, or dependencies. This is the
deterministic closed loop that turns A-Stack's gates from a one-shot check into
a convergent loop.

## The loop

```bash
node scripts/a-stack.mjs verify --target <repo> [--ui] [--public] [--max-iters 5]
```

The command runs the real gate suite (security scan, dependency audit,
test/build/lint, and browser-QA/SEO when `--ui`/`--public`) and prints JSON:

```json
{ "pass": false, "iteration": 1, "maxIters": 5,
  "failures": [ { "gate": "script:test", "status": "fail", "action": "…fix the code, not the test" } ],
  "nextAction": "Fix the 1 failing gate(s) above, then run verify again." }
```

Then iterate:

1. **Run `verify`.**
2. **`pass: true`** → stop. The change is ship-ready; hand off to `workflows/ship.md`.
3. **`pass: false`** → for each `failures[]` entry, do exactly what `action` says:
   read `.planning/GATES.md` for the detail (failing test output tail, secret
   `file:line`, lint violations), fix the **source**, and re-run `verify`.
4. **Budget reached** (`iteration >= maxIters` and still failing) → **STOP and
   escalate.** State what is still failing and what you tried. Do **not** weaken,
   allowlist, skip, or delete a gate to force a pass.

## Hard rules

- Fix the code, never the gate. Editing the test/scanner/lint config to go green
  is a hard violation — surface it instead.
- A critical security finding is a hard stop regardless of iteration budget.
- Every iteration is logged append-only to `.planning/VERIFY.md` so the loop is
  auditable (how many rounds, what failed, when it converged).

## Why this matters

One-shot gates tell you *whether* something is broken. This loop drives it to
*green* with a bounded, auditable number of fix rounds — the difference between a
checklist and a convergent verification step.
