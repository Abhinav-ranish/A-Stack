# Memory Workflow

Use when remembering preferences, recalling stack choices, updating design taste, or resuming a session.

## Source Of Truth

Markdown under `knowledge/` is canonical. The BM25 lexical index at `knowledge/.a-stack-index.json` is a derived lexical index, not a vector store — never read it directly; use it only as a pointer to the underlying markdown files. Rebuild after any memory write.

## Write Rules

Write memory only when it will be useful later:

- stack preference
- skill preference
- design taste approval/rejection
- deployment default
- repeated correction from the user
- project lesson
- session state needed for resume

Every memory entry should include source/date/context when possible.

## Recall

Use:

```bash
node scripts/memory-index.mjs search "<query>"
```

Then read the matching markdown files directly before acting.
