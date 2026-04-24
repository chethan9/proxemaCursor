---
title: Auto-trial on client creation
status: done
priority: urgent
type: feature
tags: [billing, onboarding, subscriptions]
created_by: agent
created_at: 2026-04-23T20:05:00Z
position: 175
---

## Notes

Creating a client in `src/services/clientService.ts` only inserts a row in `clients` — no subscription is created, so the client is immediately gated by `src/lib/subscription-guard.ts` and every site redirects to `/pricing`. This makes testing painful and is wrong UX: new clients should get a trial window automatically.

Mark one plan as the default trial plan (add `is_default_trial` flag to `plans` table, settable from the existing `PlanDialog`). On client create, auto-insert a `trialing` subscription using that plan, with `current_period_end = now() + interval 'plan.trial_days days'`.

If no plan has `is_default_trial=true`, fall back to the cheapest active non-custom plan by USD price. If still none, skip auto-trial and surface a soft warning in the client detail header (super_admin only) linking to `/settings/plans`.

## Checklist

- [x] Add `is_default_trial` boolean column to `plans` table (default false, unique partial index so only one plan can be marked default)
- [x] Extend `PlanDialog` in `src/components/plans/PlanDialog.tsx` with an "Default trial plan" switch in the Basics card; toggling on auto-unmarks any other plan
- [x] Update `createClient` in `src/services/clientService.ts`: after inserting the client, look up the default trial plan (or fallback), create a `trialing` subscription row with correct period dates and grace period, log to `activity_log`
- [x] If no plan exists at all, still allow client creation but show a banner on the client detail page (`src/pages/clients/[id].tsx`) telling super_admin to create a plan first — deep link to `/settings/plans`
- [x] Client detail page shows a compact subscription card (plan name, status pill, days remaining in trial, "Manage" link to new `/settings/subscriptions` page)

## Acceptance

- Super admin marks one plan as default trial in Plans settings
- Creating a new client immediately starts a trial — visiting any of the client's sites no longer redirects to `/pricing`
- Client detail page shows the active trial with days remaining