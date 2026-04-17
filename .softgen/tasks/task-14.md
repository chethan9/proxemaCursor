---
title: Deleted Records Archive with entity type filter
status: done
priority: high
type: feature
tags: [archive, deleted, history]
created_by: agent
created_at: 2026-04-17
position: 14
---

## Notes
Archive deleted records from WooCommerce webhooks. Stores last known snapshot for audit trail.

## Checklist
- [x] Create deleted_records table with snapshot, entity_type, source
- [x] Update webhook processor to archive before deleting from mirrored tables
- [x] Add Deleted Records tab to site detail page with entity type chip filters
- [x] Show deleted records in a table with name, type, deleted date, source, expandable snapshot