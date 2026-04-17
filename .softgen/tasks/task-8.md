---
title: Add tags sync + fix coupons sync in sync-scheduler
status: done
priority: high
type: feature
tags: [sync, tags, coupons]
created_by: agent
created_at: 2026-04-17
position: 8
---

## Notes
Extend `src/pages/api/cron/sync-scheduler.ts` and `src/pages/api/stores/[storeId]/sync.ts` to:
- Add `syncTags` function calling `/wp-json/wc/v3/products/tags` with pagination
- Debug and fix `syncCoupons` - it currently fetches but doesn't insert. Likely issue: WooCommerce returns `amount` as string, `usage_limit_per_user` can be null, `date_expires` can be null. Test with console.log of first coupon before insert.
- Ensure all 6 aspects sync: products, orders, customers, categories, tags, coupons

Update sync progress UI in site detail page to include tags as 6th aspect.

## Checklist
- [ ] Add `WooTag` interface and `syncTags()` function in sync-scheduler.ts (mirror syncCategories pattern)
- [ ] Add `syncTags()` to the syncFunctions map in the cron handler
- [ ] Mirror the same tags sync in src/pages/api/stores/[storeId]/sync.ts
- [ ] Debug coupons: wrap insert in try/catch, log error per-coupon, test with `console.log(JSON.stringify(coupon, null, 2))` before insert to see actual schema
- [ ] Update SYNC_ASPECTS array in src/pages/sites/[id]/index.tsx to include tags (icon: Tag from lucide)
- [ ] Update dataCounts query in loadSiteData to include tags count
- [ ] Update sync progress total from 5 to 6 aspects
- [ ] Add tags to Data tab as 4th clickable stat card with its own table view
