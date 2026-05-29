# Self-Learning Workflow

Use for self-learning, self-optimization, feedback loops, trajectory tracking, successful-pattern promotion, and routing improvement.

## RuVector Ideas We Borrow

- **Trajectory tracking**: record task, domain, actions, outcome, quality, and verdict.
- **ReasoningBank**: promote successful repeated patterns into reusable guidance.
- **Feedback scoring**: quality and success/failure adjust future recommendations.
- **Optimization pass**: periodically consolidate, dedupe, and rank patterns.
- **Markdown-first memory**: human-readable notes stay canonical; JSON metrics are derived.

## Commands

Record an outcome:

```bash
node scripts/learning.mjs record --task "build auth dashboard" --domain frontend --outcome success --quality 0.9 --pattern "Run browser QA after layout changes"
```

Get recommendations before planning/execution:

```bash
node scripts/learning.mjs recommend "auth dashboard frontend"
```

Consolidate and produce an optimization report:

```bash
node scripts/learning.mjs optimize
```

## When To Record

- After a phase ships or fails.
- After a security, QA, or UI gate catches something useful.
- After user corrects a stack, design, or implementation choice.
- After a pattern succeeds at least once and is likely reusable.

## Quality Scale

- `1.0`: strongly reusable, verified, user-approved.
- `0.7`: useful but context-dependent.
- `0.4`: weak signal, keep short-term only.
- `0.0`: failed pattern or avoid-this lesson.

## Usage Rule

Before planning new work, run recommendations for the project domain and read the matching markdown learning files directly. Do not blindly follow a pattern with poor quality or low support.
