# QA Browser Workflow

Use for app QA, flow testing, screenshots, console errors, local dev servers, or regression checks.

## Flow

1. Identify how to run the app from package scripts or existing docs.
2. Start the dev server if needed.
3. Open the app in a browser.
4. Exercise core flows:
   - navigation
   - auth states when possible
   - forms
   - CRUD actions
   - responsive layout
5. Record:
   - console errors
   - network failures
   - visual breakage
   - blocked flows
6. Fix issues one at a time and re-test.

## Completion

QA passes only when the tested flows work in-browser and no high-impact console/runtime errors remain.
