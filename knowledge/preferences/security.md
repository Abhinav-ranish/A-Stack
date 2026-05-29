# Security Preferences
tags: security cyberreview owasp ruflo gates

## Defaults

- Run CyberReview before ship for any web app with auth, data, APIs, uploads, payments, or public traffic.
- Treat exposed secrets, auth bypasses, arbitrary command execution, and data exfiltration as hard stops.
- Check prompt injection before scraped/user content enters privileged LLM prompts.
- Check PII before memory writes or logs.
- Prefer server-side authorization and secure cookie/session defaults.

## Auto-Fix Allowed

- Missing secure cookie options.
- Overly broad CORS in local code.
- Unsafe redirects with obvious allowlist fixes.
- Missing input validation where schema patterns exist.
- Exposed example placeholders that are not live secrets.
