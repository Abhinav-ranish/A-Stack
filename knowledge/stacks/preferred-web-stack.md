# Preferred Web Stack
tags: stack web nextjs vercel cloudflare supabase ai-app

## Defaults

- Prefer the existing project stack when working in an existing repo.
- For new web apps, default to Next.js App Router unless the request or repo points elsewhere.
- Prefer TypeScript, server-side auth checks, environment variables, and explicit verification commands.
- For backend/data, prefer the simplest durable managed service that fits the app: Supabase/Postgres, Neon, or existing project DB.
- For deployment, prefer Vercel for Next.js and Cloudflare Pages/Workers for static or edge-first apps.

## Avoid

- Frontend-only auth enforcement.
- Hardcoded secrets or client-exposed privileged keys.
- Unowned one-file mega-app implementations for production features.
- Decorative UI without real product flow.
