---
title: Split sync into core + secondary, weighted progress, partial celebration
status: done
priority: high
type: feature
tags: [sync, ux, onboarding]
created_by: agent
created_at: 2026-04-20T10:50:00Z
position: 102
---

## Notes

Current behavior (broken):
- Onboarding sync runs ALL aspects (products, orders, customers, categories, tags, coupons, variations) as one big job.
- Variations loop calls WooCommerce once per variable product — for 500 products this hangs for 10+ minutes.
- Progress bar gets "stuck at 98%" because aspect weights are uniform (each aspect = 1/7 of bar) but variations takes 80% of real time.
- Celebration only fires when EVERYTHING succeeds. If variations/tags/coupons fail or time out, user never sees the confetti and sync appears broken.

Target behavior (user-validated approach):
1. **Initial onboarding sync** = core aspects only: products, orders, customers, categories.
   - Finishes fast (typically <1 min for medium stores).
   - Celebration fires as soon as core completes — user can start working immediately.
2. **Background secondary sync** = variations, tags, coupons.
   - Auto-kicked off by the server the moment core sync finishes.
   - Shows as a separate, lower-priority progress indicator in the banner ("Backfilling variations…").
   - Failures here do NOT block celebration and do NOT mark the store as errored — surfaced as a non-blocking notification ("Variations couldn't sync — retry from sync engine").
3. **Weighted progress bar** for both phases:
   - Core phase weights (rough): products 45%, orders 35%, customers 10%, categories 10%.
   - Secondary phase weights: variations 80%, tags 10%, coupons 10%.
   - Progress computed as `sum(weight_of_completed) + weight_of_current * (records_processed / records_estimated)`.
   - No aspect jumps the bar backward.
4. **Partial celebration logic**:
   - If core aspects all succeed → celebrate immediately, mark `stores.initial_sync_completed_at`.
   - If any core aspect fails → sync_failure notification, no celebration.
   - Secondary phase emits its own quieter completion toast ("Variations ready ✨") or failure notification.
5. **Manual sync from sync engine** keeps current "sync all" option but also exposes "sync core" and "sync secondary" separately.

Key files:
- `src/pages/api/stores/[storeId]/sync.ts` — main sync endpoint, needs `phase` param: `"core" | "secondary" | "all" | <single aspect>`. Core phase triggers secondary phase in background after completion.
- `src/pages/api/stores/[storeId]/sync-start.ts` — creates the "all" placeholder run. Rename concept to "phase" placeholder: one row for core, one for secondary.
- `src/hooks/queries/useActiveSync.ts` + `useAllActiveSyncs.ts` — read BOTH phases, expose weighted progress. Current client reads `sync_runs` for progress; needs to know aspect weights to compute correct %.
- `src/components/SyncProgressBanner.tsx` — show two phases when both running; show secondary as a subdued bar beneath the main one, or as a second banner row.
- `src/lib/sync-messages.ts` — add secondary-phase copy ("Polishing variations…", "Tagging things up…").
- `src/pages/api/stores/[storeId]/sync-start.ts` — create two placeholder rows (aspect = "core" and/or "secondary") instead of one "all".
- DB: `sync_runs.aspect` already accepts any string; add two new aspect values `"core"` and `"secondary"` as phase placeholders. No schema change required.
- `src/pages/sites/connect/[id].tsx` — onboarding flow, call sync with `phase=core` then the server auto-fires secondary.

Estimation for weighted progress:
- Call `/wp-json/wc/v3/reports/totals` once at sync start to get counts per aspect, stash them in the `sync_runs` placeholder row as `records_estimated`. Fall back to 100 if unavailable.
- Variations estimation: multiply variable-product count × 5 as a rough placeholder until real count known.
- `sync_runs` already has `records_processed`. Add client-side weight map keyed by aspect.

Background trigger mechanism:
- At end of core phase handler, fire-and-forget `fetch(sameOriginUrl + "/api/stores/[id]/sync", { method: "POST", body: { phase: "secondary" } })`. Don't await. Server continues running in the same Next.js process.
- Guard: if secondary sync is already running for the store, skip.

Celebration rules (unchanged structure, new triggers):
- Celebrate on core completion (not full sync completion).
- Separate, quieter toast on secondary completion — no confetti, just a checkmark toast.
- Failure notifications fired per-phase independently.

## Checklist

- [ ] Add `phase` parameter to sync API: "core" (products/orders/customers/categories), "secondary" (variations/tags/coupons), "all" (both sequentially), or a single aspect name
- [ ] Core phase: runs the 4 core aspects, stamps `initial_sync_completed_at`, fires celebration notification on success, fires sync_failure notification on any core aspect failure
- [ ] Core phase auto-triggers secondary phase via fire-and-forget HTTP call on success (guard against duplicate secondary runs)
- [ ] Secondary phase: runs variations + tags + coupons, emits a quieter "secondary sync complete" toast notification (no confetti) on full success, emits per-phase failure notification if any secondary aspect fails
- [ ] Secondary phase failure does NOT set `stores.status = "error"` and does NOT affect `initial_sync_completed_at`
- [ ] Sync API creates one placeholder sync_run row per phase (aspect = "core" or "secondary") instead of single "all" row
- [ ] `sync-start` endpoint accepts phase and creates correct placeholder
- [ ] Active sync hook (`useActiveSync`) computes weighted progress using per-aspect weight map: core weights products:45 orders:35 customers:10 categories:10, secondary weights variations:80 tags:10 coupons:10
- [ ] Active sync hook returns phase label ("core" | "secondary") so banner can render correctly
- [ ] `useAllActiveSyncs` surfaces both phases per store (so banner can show both if overlapping)
- [ ] Sync progress banner renders phase label ("Setting up your store" for core, "Backfilling details" for secondary) and phase-appropriate message copy
- [ ] When both phases running for same store, banner shows two bars stacked: primary core bar on top, secondary subdued bar below
- [ ] Site-level products/orders/categories pages already poll every 5s during sync (task-101) — verify this still works with new phase aspects in active sync result
- [ ] Onboarding connect flow (`src/pages/sites/connect/[id].tsx`) calls sync with `phase=core` instead of full sync; secondary kicks off automatically
- [ ] Manual sync engine UI exposes three buttons: "Sync all", "Sync core only", "Sync secondary only" (plus existing per-aspect sync)
- [ ] Add secondary-phase copy strings to `sync-messages.ts` ("Polishing variations…", "Tagging things up…", "Adding coupon codes…")
- [ ] Stuck/timeout auto-fail logic applies independently to each phase row

## Acceptance

- Adding a fresh site: core sync completes and confetti celebration fires within ~1 minute; user lands on populated product/order pages immediately.
- After celebration, a subdued secondary-sync bar continues in the banner while variations/tags/coupons backfill in the background; user can navigate freely.
- If variations fail mid-backfill, a failure notification appears; the store stays green/connected; products page still works; user can retry secondary sync from the sync engine without re-running core.
- Progress bar moves smoothly from 0 → 100% in both phases without sticking at 98%; no aspect jumps the bar backward.