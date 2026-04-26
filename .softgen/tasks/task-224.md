---
title: Server-only import guards (server-only pkg + ESLint)
status: todo
priority: urgent
type: chore
tags: [security, build, dx]
created_by: agent
created_at: 2026-04-26
position: 224
---

## Notes

Prevent the class of bug where server-only modules (like `supabaseAdmin`) leak into the client bundle and crash the page at runtime. Today this only surfaces when a user clicks the broken page; we want a **build-time** error instead.

Two complementary guards:

**1. `server-only` package**
- Add `server-only` to dependencies.
- Import `import "server-only"` at the top of:
  - `src/integrations/supabase/admin.ts`
  - Every `*.server.ts` file under `src/services/` (e.g. `subscriptionService.server.ts`, `invoiceService.server.ts`, `couponService.server.ts`, `quota.server.ts`)
  - `src/lib/payments/*` server modules that touch secret keys
- The Next.js bundler then throws a clear build error if any Client Component imports them.

**2. ESLint `no-restricted-imports` rule**
- In `eslint.config.mjs`, add a rule that errors when files matching `src/components/**`, `src/contexts/**`, `src/hooks/**`, `src/pages/**/*.tsx` (excluding `src/pages/api/**`) import:
  - `@/integrations/supabase/admin`
  - Any path matching `**/*.server` or `**/*.server.ts`
- Error message: "Server-only module — use an API route or `*.server.ts` service module instead."

**3. Verification pass**
- Run `npm run build` and `npm run lint` after applying — they must both pass.
- Deliberately add a temporary `import { supabaseAdmin } from "@/integrations/supabase/admin"` to a client component, confirm both ESLint and build flag it, then remove.

Document the pattern in `docs/JOURNAL.md` and the new `docs/KNOWN_TRAPS.md` (task-226) so future code follows it.

## Checklist

- [ ] Install `server-only` package (`npm install server-only`).
- [ ] Add `import "server-only"` to `src/integrations/supabase/admin.ts` as the first line.
- [ ] Add `import "server-only"` to all `src/services/*.server.ts` files.
- [ ] Add `import "server-only"` to server-secret payment modules (`src/lib/payments/myfatoorah.ts`, `razorpay.ts`, `tap.ts`).
- [ ] Update `eslint.config.mjs` with `no-restricted-imports` blocking `@/integrations/supabase/admin` and `**/*.server` from client paths.
- [ ] Verify `npm run build` succeeds with no client-bundle leaks.
- [ ] Verify `npm run lint` is clean.
- [ ] Manual test: temporarily add a forbidden import to a client file → confirm both ESLint and build flag it → revert.

## Acceptance

- Importing `supabaseAdmin` (or any `*.server.ts` module) from a Client Component fails the production build with a clear error.
- ESLint flags the same violation in the editor before commit.
- Existing functionality is unchanged; no regressions in API routes or server components.
