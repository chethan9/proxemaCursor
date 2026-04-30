# Referral System

## Overview

A hybrid referral program with:
- **Signup bonus** credited on the referred client's first paid plan.
- **Percentage** of every paid charge from referred customers (with optional cap).
- **Optional recurring rewards** for repeat charges per referral.
- **Manual admin payout approval** with idempotent debit events.
- **Withdrawal eligibility gating** so non-paying referrers can earn but cannot
  withdraw until they purchase a paid plan themselves.

The whole system is gated behind a single feature flag stored in
`public.referral_settings.is_enabled`. Off by default.

## Data model

Tables (all created in `supabase/migrations/20260429140000_referral_system.sql`):

- `referral_settings` — singleton row (`id = 'singleton'`) holding rules:
  signup bonus, paid percentage (basis points), per-event cap, recurring
  percentage and cap, minimum payout, eligibility window, reversal window,
  payout currency, `require_referrer_paid` toggle, list of payout methods.
- `referral_profiles` — one row per enrolled client. Holds the referral code,
  current `status`, `has_paid_purchase` cache (toggled by webhook), and the
  user's saved payout method/details.
- `referral_attributions` — links a referrer to a referred client. Unique on
  `referred_client_id` (a client can only be attributed once). `signup_at` and
  `first_paid_at` track conversion lifecycle.
- `referral_events` — immutable ledger. Types include `signup_bonus`,
  `paid_conversion`, `recurring_bonus`, `reversal`, `manual_adjustment`,
  `payout_debit`, `payout_reversal`. Idempotent on `(source, source_ref)` via
  partial unique index.
- `referral_balances` — per-`(client, currency)` materialized counters.
  `available_minor` is a `GENERATED ALWAYS AS … STORED` column that is
  `lifetime_earned − reversed − withdrawn − pending_payout` floored at 0.
  Recomputed by `recompute_referral_balance()` triggered on event/payout
  changes.
- `referral_payout_requests` — request lifecycle: `pending → approved → paid`
  or `rejected/canceled`.

RLS policies:
- Each user reads only their own client's profile, attributions, events,
  balances, and payout requests.
- `referral_payout_requests` allows a user to insert (with `status='pending'`)
  and cancel their own pending request only.
- All admin lifecycle actions require `is_super_admin()`.

## Backend flows

### Attribution (signup time)
- Signup form captures `?ref=CODE` and stores in `localStorage.pending_referral_code`.
- After auth + profile load, `AuthProvider.loadProfileAndRole` POSTs the code
  to `/api/referrals/attribute` and clears the local key.
- `applyAttribution` resolves the code, refuses self-referral, and inserts a
  unique `referral_attributions` row.

### Reward creation (paid webhook)
Tap, Razorpay, and MyFatoorah webhooks call `recordPaidConversion()` whenever
`paymentStatus === 'paid'`. The function:
1. Calls `markReferrerPaid()` for the paying client (so they can withdraw).
2. Looks up an attribution for the paying client.
3. Honors `eligibility_window_days`.
4. Inserts a `signup_bonus` event (first conversion only) and a
   `paid_conversion` (or `recurring_bonus` thereafter) event with the
   configured percentage capped at `paid_percentage_max_minor`.
5. Marks the attribution `converted = true`, with `first_paid_at` and
   `first_paid_subscription_id`.

All inserts include a derived `source_ref` (`<webhook event id>:<event_type>`)
so duplicate webhook deliveries cannot double-credit.

### Reversal (refund/chargeback webhook)
On `paymentStatus === 'refunded'`, `recordReversal()` finds existing posted
events for that webhook event id and inserts matching negative `reversal`
events plus marks the originals `status = 'reversed'`.

### Withdrawal (user)
- POST `/api/referrals/payouts` validates eligibility (`is_enabled`,
  `status === 'active'`, `require_referrer_paid → has_paid_purchase`,
  `amount >= min_payout_minor`, `amount <= available_minor`).
- Insert creates a `pending` row; trigger increments `pending_payout_minor`
  on the balance row, which reduces `available_minor` immediately.
- Users may cancel a `pending` request from the dashboard. Approved/paid
  requests cannot be canceled by the user.

### Admin payout actions
`/api/admin/referrals/payouts/[id]/action` accepts `approve`, `reject`, and
`mark_paid`:
- `approve`: only valid from `pending`. Sets `status='approved'`. Pending
  payout amount stays held.
- `reject`: from `pending` or `approved`. Sets `status='rejected'`. Trigger
  releases the held pending amount.
- `mark_paid`: from `pending` or `approved`. Sets `status='paid'` and inserts
  a `payout_debit` ledger event with `amount = -abs(amount_minor)`. Balance
  trigger fires: `withdrawn_minor` increases, `pending_payout_minor` resets.

Every action emits an `activity_log` row tagged `referral.payout.<state>` for
audit and downstream reporting.

## Reconciliation

`/api/admin/referrals/reconcile` (GET = dry run, POST = apply) calls
`recompute_referral_balance()` for every `(client, currency)` row and reports
drift. The same routine runs nightly via the Vercel cron at
`/api/cron/referral-reconcile` (03:15 UTC, see `vercel.json`). Drift events
are logged to `cron_logs` (`job_type='referral_reconcile'`) and to
`activity_log` (`referral.reconcile.drift_detected`).

## UI surfaces

- `/referrals` — user dashboard with referral link, balance breakdown, recent
  events, withdrawal form, and payout history. Hidden when `is_enabled` is
  off (renders an explanatory card).
- `/admin/referrals` — super admin console with tabs per payout status, a
  detail drawer for approve/reject/mark-paid, and a Settings tab to edit the
  rules and run reconciliation.
- Sidebar registry: `referrals` (Billing group) for users, `admin-referrals`
  (Administration group, super admin only) in `src/lib/menu-registry.ts`.

## Rollout sequence (recommended)

1. Apply migration `20260429140000_referral_system.sql`. Verify schema on
   target DB. (Migrations are idempotent — safe to re-run.)
2. Deploy backend changes (webhook hooks, services, API routes). With
   `is_enabled=false` (default), no rewards will be created — webhooks
   short-circuit immediately on `getReferralSettings`.
3. Smoke test in admin `/admin/referrals` → Settings tab. Toggle the flag,
   adjust rules, save. Confirm the user dashboard at `/referrals` reflects
   the new state and the rules card shows the configured values.
4. Enroll a small set of test users by visiting `/referrals` and clicking
   "Join now". Confirm referral codes generate and the share link copies.
5. Issue a real (or sandbox) Tap/Razorpay charge for a referred client.
   Confirm:
   - `recordPaidConversion` posted `signup_bonus` and `paid_conversion`
     events.
   - `referral_balances.available_minor` updated.
   - `markReferrerPaid` flipped `has_paid_purchase` for the referrer if they
     paid.
6. Test a withdrawal:
   - Request from the user dashboard.
   - Approve from the admin console.
   - Mark paid with a reference. Confirm `withdrawn_minor` increases and
     `available_minor` drops.
7. Run `POST /api/admin/referrals/reconcile` once to confirm zero drift, then
   enable the nightly cron.
8. Flip `is_enabled` to `true` for the broader audience.

## Operational notes

- `referral_settings` is cached in-memory for 30s in
  `referralService.server.ts`. Admin saves call `clearReferralSettingsCache()`
  to invalidate immediately.
- All reward inserts use `(source, source_ref)` for idempotency; webhook
  retries are safe.
- The `payout_methods` JSON column on `referral_settings` is intended as a
  list of `{ value, label }` entries surfaced in the UI later. Today the user
  enters a free-form payout method string.
- To completely disable the program in an emergency, flip `is_enabled` to
  `false`. New attributions and rewards stop immediately. Existing balances
  and payout requests are preserved.
