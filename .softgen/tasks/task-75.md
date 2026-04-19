---
title: Sync progress accuracy - checkpoint model, all-row completion, green UI
status: done
priority: high
type: bug
tags: [sync, progress, ux]
created_by: agent
created_at: 2026-04-19T22:30:00Z
position: 75
---

## Notes

The sync progress banner is broken: stays at 0% forever, then jumps to 100%, and the "All" sync_run stays Running forever, preventing the completion toast from firing. Three root causes:

**Context files:**
- `src/pages/api/stores/[storeId]/sync-start.ts` — creates `aspect='all'` placeholder run with `status='running'` and `estimated_total=totalCount`
- `src/pages/api/stores/[storeId]/sync.ts` — runs aspects sequentially, creates/completes individual aspect runs, but never touches the "all" row
- `src/hooks/queries/useActiveSync.ts` — computes progress from running rows, picks "all" as primary, resulting in broken math
- `src/components/SyncProgressBanner.tsx` — already has completion-toast logic but never triggers because "all" row never completes

**Root causes:**

1. **"All" run never completes** — `sync-start.ts` inserts it with `status: running`, `sync.ts` creates separate aspect runs and never updates the "all" row. After all aspects complete, the "all" row is still running → banner stays mounted → no toast.

2. **Broken progress math** — `useActiveSync` picks the most recent running row as "primary" (which is "all"), uses its `estimated_total` (e.g., 3047), but sums `records_processed` across running rows. The "all" row's `records_processed` stays at 0. Individual aspect runs have tiny estimates (e.g., 10 for tags). Result: percentage is meaningless.

3. **Per-aspect percentages don't reflect overall work** — users see "0%" for 2 minutes while 3 aspects complete, then "100%" at the end. Progress should be checkpoint-based: 6 aspects, each worth ~16.67%.

**Fix plan:**

### A. Complete the "all" row properly (backend)
In `src/pages/api/stores/[storeId]/sync.ts`:
- Before the sync loop starts, find the existing `aspect='all'` running row for this store (created by sync-start.ts) and track its id.
- After the aspects loop completes successfully: update the "all" row to `status='completed'`, `completed_at=now`, `records_processed=totalProcessed`, `records_created=totalCreated`, `records_updated=totalUpdated`.
- In the catch block: update "all" to `status='failed'`, `error_message`, `completed_at=now`.
- Also: if sync-start wasn't called (direct /sync call), no "all" row exists — skip gracefully (don't fail).

### B. Checkpoint-based progress math (frontend hook)
Rewrite `src/hooks/queries/useActiveSync.ts`:
- Fetch ALL sync_runs for this store in the last 10 minutes (not just running ones): need completed ones too to count checkpoints.
- Filter to runs tied to the current active sync batch: runs where `started_at >= (earliest running run's started_at - 5s)` OR part of the current "all" group.
- Find the "all" row (running or completed in this batch) — it's the anchor. If no "all" row exists, fall back to summing aspects.
- Aspect weights: 6 aspects × 16.67% each. Map: products, orders, customers, categories, tags, coupons.
- For each aspect in the current batch:
  - `completed` → contributes full weight (16.67%)
  - `running` → contributes weight × (records_processed / max(estimated_total, records_processed, 1)) — if estimate unknown, contribute 50% of weight
  - not-yet-started → 0
- `progress_pct` = sum of contributions, capped at 99% while "all" is still running, jumps to 100% when "all" completes.
- `current_aspect` = the aspect currently `running` (not "all").
- `running` = true only if "all" row is `running` (or if no "all" row exists, true if any aspect is running).
- ETA: elapsed = now - earliest started_at; if elapsed < 5s return "Starting…" (eta_seconds = -1 or special value); else rate = processed/elapsed, remaining = total_estimated - processed, eta = remaining/rate.

### C. Progress bar UI polish (SyncProgressBanner)
In `src/components/SyncProgressBanner.tsx`:
- Swap the default Progress component for a custom gradient bar: use `bg-emerald-500` fill with a subtle animated shine (CSS `bg-[linear-gradient(...)]` animation).
- Percentage badge: move to right side, use `tabular-nums font-medium text-emerald-700` on emerald-tinted pill.
- Container: change from primary-blue tint to emerald-tint (`from-emerald-500/5 via-emerald-500/10 to-emerald-500/5`) so it reads as "successfully progressing" not "alert".
- Add small aspect icon next to current aspect label (Package for products, ShoppingCart for orders, Users for customers, Tag for tags/categories, Percent for coupons).
- ETA copy: when `eta_seconds === -1` show "Starting sync…"; otherwise "~Xs remaining" / "~Xm remaining".

### D. Toast dismissal verification
`SyncProgressBanner` already has `useRef`-based prev-running tracking. Once (A) is fixed, the "all" row will properly transition `running → completed`, the hook will return `running: false`, the banner unmounts, and the one-shot toast fires. Verify after A+B: no duplicate toasts, banner unmounts cleanly.

## Checklist

- [ ] In `sync.ts` handler: look up the existing `aspect='all'` running row for this store at the start; track its id; at end of success path mark it `completed` with aggregated totals; on error mark it `failed` with error_message — gracefully skip if no "all" row exists
- [ ] Rewrite progress math in `useActiveSync.ts` as weighted checkpoint model: 6 aspects × ~16.67% each, completed aspects contribute full weight, running aspect contributes partial based on records, pending contribute 0; progress capped at 99% while "all" row running
- [ ] In `useActiveSync.ts`: derive `running` state from the "all" row's status (not from the mere presence of running aspect rows) so the hook reports `running: false` as soon as "all" completes
- [ ] In `useActiveSync.ts`: add "Starting…" ETA for first 5 seconds (avoid the "~1s" glitch); after that compute ETA from rate (processed/elapsed) vs remaining estimate
- [ ] Progress bar color in `SyncProgressBanner.tsx`: switch container + bar from primary-blue to emerald tint for a "success in progress" feel; percentage shown as a tabular-num emerald pill on the right
- [ ] Add a small aspect icon (Package/ShoppingCart/Users/Tag/Percent) next to the current aspect label inside the banner so users see which batch is being synced
- [ ] ETA copy: show "Starting sync…" for first few seconds, then "~Xs remaining" / "~Xm remaining" based on real rate
- [ ] Verify completion toast fires exactly once when the "all" row transitions to completed; banner unmounts cleanly; no duplicate toasts on refetch

## Acceptance

- During a fresh sync, the progress bar climbs smoothly through ~6 visible checkpoints (products → orders → customers → categories → tags → coupons), not stuck at 0% or jumping straight to 100%
- The "All" sync_run row transitions from Running to Completed at the end of the batch (visible in sync history table)
- When sync finishes, the progress banner disappears and a single "✨ Sync complete" toast appears
- Progress bar is visually green/emerald and matches the app's modern theme; percentage and ETA are readable and accurate