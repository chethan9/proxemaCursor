---
title: Deleted Records Archive with entity type filter
status: in_progress
priority: high
type: feature
tags: [data, archive, soft-delete]
created_by: agent
created_at: 2026-04-17
position: 14
---

## Notes
Track deleted entities (products, orders, customers, categories, coupons) when webhooks receive delete events or sync detects missing items. Show in a dedicated "Deleted" tab on the site detail page with chip filters by entity type.

## Checklist
- [ ] Create `deleted_records` table: id, store_id, entity_type, entity_id, woo_id, entity_name, deleted_at, snapshot (full last-known data), source (webhook/sync)
- [ ] Update webhook processor to insert into deleted_records on delete topics
- [ ] Update sync engine to detect deleted items (items in DB but missing from WooCommerce response)
- [ ] Add "Deleted" tab to site detail page with choice chips for entity type filtering
- [ ] Show deleted records in a table with name, type, deleted date, source, expandable snapshot