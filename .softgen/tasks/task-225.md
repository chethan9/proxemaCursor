---
title: Sentry + PostHog error & analytics tracking
status: done
priority: high
type: feature
tags: [observability, error-tracking, analytics]
created_by: agent
created_at: 2026-04-26
position: 225
---

## Notes

Wire up two complementary observability layers so the next runtime bug surfaces with full context instead of a user screenshot:

**Sentry — error tracking**
- Captures unhandled exceptions, hydration errors, API route failures, with full stack trace, breadcrumbs, user, route, and release version.
- Sources: client (browser), server (API routes + getServerSideProps), edge (middleware if any).
- Free tier (5k errors/month) covers current scale.

**PostHog — product analytics**
- Page views, feature usage, conversion funnels (signup → site connected → first sync → subscription).
- Self-hosted or cloud free tier.
- Session replay (off by default, opt-in for support cases).

**Performance considerations** — both libs are async and lazy-loaded:
- Sentry SDK ~30KB gzipped, deferred init, beacon-based reporting (no main-thread blocking).
- PostHog ~50KB gzipped, lazy chunk, batched events with sendBeacon on unload.
- Combined impact on Time-to-Interactive: <50ms on a typical connection. Both can be tree-shaken to only what's used.

**Privacy & compliance**
- Mask all input fields by default in Sentry (`maskAllInputs: true`).
- PostHog with `capture_pageview: true`, `autocapture: false` (manually capture meaningful events only — avoids noise + GDPR scope creep).
- Strip PII from breadcrumbs (email, tokens) via `beforeSend` hook.
- Add cookie banner notice if not already present (PostHog uses cookies by default).

**Environment setup**
- Env vars: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`.
- Source map upload only in production builds (Sentry CLI in `next.config.mjs`).
- Disable both in `NODE_ENV !== "production"` to keep dev console clean.

**Integration points**
- `_app.tsx`: PostHog provider wrapping the app, identify user on auth.
- `sentry.client.config.ts` + `sentry.server.config.ts` + `sentry.edge.config.ts` (Sentry standard layout).
- `_app.tsx`: capture page views on route change.
- `AuthProvider.tsx`: call `posthog.identify(user.id, { email })` and `Sentry.setUser({ id, email })` on login; `posthog.reset()` + `Sentry.setUser(null)` on logout.
- Track these key events in PostHog: `site_connected`, `sync_started`, `sync_completed`, `subscription_created`, `subscription_canceled`, `template_printed`, `bulk_job_started`.

**Documentation**
- Add `docs/OBSERVABILITY.md` with: how to view errors, how to query events, how to replay sessions, on-call escalation.

## Checklist

- [ ] Install `@sentry/nextjs` and `posthog-js`.
- [ ] Run `npx @sentry/wizard@latest -i nextjs` to scaffold Sentry config files; review the changes before committing.
- [ ] Configure `sentry.client.config.ts`: DSN from env, `maskAllInputs: true`, `tracesSampleRate: 0.1`, `replaysOnErrorSampleRate: 0.1`, `replaysSessionSampleRate: 0`.
- [ ] Configure `sentry.server.config.ts` and `sentry.edge.config.ts` with same DSN, server-side tags.
- [ ] Add `beforeSend` hook stripping PII (email, tokens, API keys) from breadcrumbs and event payloads.
- [ ] Add `next.config.mjs` Sentry webpack plugin for source map upload (production only).
- [ ] Create `src/lib/posthog.ts` initializing PostHog client with `capture_pageview: true`, `autocapture: false`.
- [ ] Wrap `_app.tsx` with PostHog provider; capture pageview on `router.events.on("routeChangeComplete")`.
- [ ] Wire user identification in `AuthProvider.tsx` for both Sentry and PostHog (identify on login, reset on logout).
- [ ] Add manual event captures for: site_connected, sync_started, sync_completed, subscription_created, subscription_canceled, template_printed, bulk_job_started.
- [ ] Both libs only initialize when `NODE_ENV === "production"` AND env keys are present.
- [ ] Add `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` to `.env.local` template (commented placeholders).
- [ ] Create `docs/OBSERVABILITY.md` with usage guide.
- [ ] Verify production build size impact (<100KB added to first-load JS).
- [ ] Smoke test: throw a deliberate error in a dev route, confirm it surfaces in Sentry; click a button, confirm event in PostHog.

## Acceptance

- A runtime error (like the recent `supabaseAdmin` client leak) shows up in Sentry with stack trace, route, and user within seconds of occurrence.
- PostHog dashboard shows a basic funnel: signup → site connected → first sync.
- No measurable degradation in Lighthouse performance score (>90 still).
- Both layers respect `NODE_ENV` — dev console stays clean.
