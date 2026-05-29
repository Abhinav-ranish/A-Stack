# Security Review Workflow

Use for security audits, authenticated apps, public web apps, API routes, payments, uploads, or before ship.

## Layers

1. Run the deterministic scan:
   ```bash
   node scripts/security-scan.mjs <target>
   ```
2. Load `skills/a-stack-cyber-review/SKILL.md` for the full CyberReview checklist.
3. Apply Ruflo-inspired gates:
   - secrets and keys
   - auth and authorization
   - input validation
   - injection
   - unsafe command execution
   - PII handling before memory/storage
   - prompt injection before extracted text enters LLM prompts
   - dependency/CVE review where package tooling exists

## Fix Policy

- Auto-fix obvious low-risk issues.
- Hard-stop on critical secrets, auth bypass, arbitrary command execution, exposed admin routes, or unresolved data-leak paths.
- Every finding needs severity, exploit scenario, affected file/route, and fix status.
