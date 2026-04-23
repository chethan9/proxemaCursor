---
title: Fix supabaseAdmin leaking into client bundle (billing services)
status: done
priority: urgent
type: bug
tags: [billing, supabase, bug]
created_by: agent
created_at: 2026-04-23
position: 1
---

## Notes

Runtime error on `/billing`:
`Missing Supabase admin env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` thrown from `src/integrations/supabase/admin.ts:8`.

**Root cause:** `admin.ts` requires the server-only `SUPABASE_SERVICE_ROLE_KEY`. It's being imported into the browser bundle through this chain:
`src/pages/billing/index.tsx` → `CurrentPlanCard.tsx` → `useSubscription.ts` → `subscriptionService.ts` → `admin.ts` → throws in browser (no service role key).

**Leaking files (all in `src/services/`):**
- `subscriptionService.ts` — imports `supabaseAdmin`, uses it in `createTrialSubscription` + `insertSubscriptionEvent`. Same file exports `getSubscriptionByClient` + `getSubscriptionEvents` which are called from the client hook `useSubscription`.
- `invoiceService.ts` — imports AND re-exports `supabaseAdmin` (`export { supabaseAdmin }`). Also exports `listInvoicesByClient` / `getInvoice` likely called from pages.
- `couponService.ts` — imports `supabaseAdmin`, uses it in `validateCoupon`. Also exports `listCoupons` (client-safe read).

**Fix strategy — split client-safe reads from server-only writes:**
Each leaking service becomes two files:
- `xxxService.ts` — client-safe: uses the anon `supabase` client only. RLS enforces scoping. Exports reads (list, get, getByClient) used by hooks and pages.
- `xxxService.server.ts` — server-only: uses `supabaseAdmin`. Exports mutations (create, insert events, validate with admin lookups). Imported ONLY by `src/pages/api/**` and `src/pages/api/cron/**` routes.

Add `import "server-only"` at the top of `src/integrations/supabase/admin.ts` so any future client import fails at build time with a clear message, not a runtime browser throw.

**Callers to rewire:**
- `useSubscription.ts` — keeps importing from `subscriptionService.ts` (reads only).
- `src/pages/api/billing/**` and `src/pages/api/cron/billing-renewals.ts` — import writes from `subscriptionService.server.ts`.
- `src/pages/api/billing/coupons/validate.ts` — import `validateCoupon` from `couponService.server.ts`.
- Billing UI (`CurrentPlanCard`, `UsageMeterCard`, `src/pages/billing/index.tsx`, `src/pages/billing/return.tsx`) — import reads from `invoiceService.ts` (no admin).
- `src/pages/api/billing/webhooks/**` + `src/pages/api/billing/verify.ts` — import invoice writes from `invoiceService.server.ts`.

**Verify before ticking done:** navigate to `/billing`, `/pricing`, `/settings/plans`, `/billing/return` with dev tools open. No missing-env-var throw. `grep -R "supabaseAdmin" src/services src/hooks src/components src/pages/index.tsx src/pages/billing src/pages/pricing` returns zero matches — admin only appears in `*.server.ts` service files and `src/pages/api/**`.

## Checklist

- [x] Split `subscriptionService.ts` into client-safe reads (`getSubscriptionByClient`, `getSubscriptionEvents`) and new `subscriptionService.server.ts` for writes (`createTrialSubscription`, `insertSubscriptionEvent`, plus any future renewal/state-change writes). Keep existing type exports (`Subscription`, `SubscriptionEvent`) in the client-safe file so callers don't churn.
- [x] Split `invoiceService.ts` into client-safe reads (`listInvoicesByClient`, `getInvoice`, `generateInvoiceNumber` if UI uses it) and new `invoiceService.server.ts` for anything that needs admin. Remove the `export { supabaseAdmin }` re-export entirely — it's the smoking gun.
- [x] Split `couponService.ts` into client-safe reads (`listCoupons`, `computeDiscount` — pure function, safe either side) and new `couponService.server.ts` with `validateCoupon` (does admin lookups against `billing_coupons` + `coupon_redemptions`). The `/api/billing/coupons/validate.ts` route calls the server version.
- [x] Update every API route + cron handler under `src/pages/api/billing/**` and `src/pages/api/cron/billing-renewals.ts` to import writes from the new `.server.ts` files. Client hooks, pages, and components import only from the client-safe files.
- [x] Add `import "server-only"` as the first line of `src/integrations/supabase/admin.ts`. Future regressions fail at build time with "You're importing a component that needs server-only" instead of a confusing runtime throw in the browser.
- [x] Sanity-grep after changes: `supabaseAdmin` only appears in `src/integrations/supabase/admin.ts`, `src/services/*.server.ts`, and `src/pages/api/**`. Zero matches in `src/hooks`, `src/components`, `src/contexts`, or any non-API page.

## Acceptance

- `/billing`, `/pricing`, `/settings/plans`, and `/billing/return` all load without the missing-env-var error; billing data renders
- Creating a subscription (trial start on signup, checkout flow) and validating a coupon still work end-to-end from the API routes
- Any future accidental client import of `supabaseAdmin` fails at build with the server-only error rather than throwing at page load
