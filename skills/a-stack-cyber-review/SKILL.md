---
name: a-stack-cyber-review
description: Practical OWASP-focused web-app security review for AI-built MVPs and fast-moving codebases. Use before shipping, when auth/data/API routes are touched, or when checking for secrets, auth bypasses, missing access controls, injection, prompt injection, PII leaks, unsafe commands, and insecure defaults.
---

# A-Stack CyberReview

CyberReview is the baseline security gate for A-Stack web apps.

## First Pass

Run the deterministic scan:

```bash
node scripts/security-scan.mjs <target>
```

Then use the full checklist in `docs/CyberReview.md`.

## Must Check

- Secrets in source, env files, frontend bundles, fixtures, comments.
- Auth identity from URL/body instead of server session.
- Missing server-side role checks.
- Unsafe SQL/NoSQL/query construction.
- Unsafe command execution or path traversal.
- Insecure cookies, sessions, CORS, redirects.
- Upload/file handling.
- Webhook signature validation.
- PII handling and memory writes.
- Prompt injection from scraped or user-provided text before LLM use.
- Missing rate limits on expensive/auth routes.

## Fix Policy

- Auto-fix obvious safe issues.
- Hard-stop on critical findings.
- Every finding needs: severity, exploit path, affected file/route, fix, verification.

Critical includes exposed live secret, auth bypass, arbitrary command execution, data exfiltration, public admin route, payment/webhook forgery, or unresolved prompt-injection path into privileged tools.
