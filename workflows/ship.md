# Ship Workflow

Use for release, PR, deploy, launch, merge, or production verification.

## Ship Gates

1. Current branch and diff understood.
2. Tests/build/lint run or explicitly unavailable.
3. Security review complete.
4. Browser QA complete for UI apps.
5. SEO audit complete for public pages.
6. Documentation/release notes updated when behavior changed.
7. No critical unresolved findings.

## Release Output

Produce:

- Changed behavior summary.
- Verification commands and results.
- Security/QA/SEO status.
- Known risks.
- Deployment instructions or production verification URL if available.

Hard-stop before destructive actions, force-pushes, production deploys without required credentials, or unresolved critical security findings.
