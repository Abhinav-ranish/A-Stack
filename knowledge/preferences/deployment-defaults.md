# Deployment Defaults
tags: deploy ship release vercel cloudflare

## Defaults

- Vercel for Next.js apps unless the project already uses another platform.
- Cloudflare Pages/Workers for static, edge-first, or lightweight serverless apps.
- Always run tests/build before ship when scripts exist.
- For public pages, run SEO audit before release.
- For UI apps, run browser QA before release.

## Ship Summary Must Include

- What changed.
- Verification commands and results.
- Security review status.
- Browser QA status.
- SEO status if public.
- Known risks and unresolved follow-ups.
