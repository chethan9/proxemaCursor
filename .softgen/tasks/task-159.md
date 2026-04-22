---
title: Activity log UI (admin viewer + per-entity history)
status: todo
priority: high
type: feature
tags: [audit, ui, admin, transparency]
created_by: agent
created_at: 2026-04-22T22:21:00Z
position: 159
---

## Notes
Makes the accountability layer visible. Admins see everything; users see their own actions. The point is disputes — "who changed this product's price?" answered in two clicks.

**Two surfaces:**
1. Admin activity dashboard `/admin/activity` — global feed with filters
2. Inline history panel — drawer on any entity detail page (product, order, customer, site, subscription, plan, coupon) showing that entity's changes

Also absorb the existing `branding_audit_log` data: UI reads from unified `activity_log` (which already catches branding via task-148 trigger) but preserves old branding entries via a one-time migration COPY into activity_log.

## Checklist
- [ ] `/admin/activity` page (super-admin only): reverse-chronological feed of activity_log
- [ ] Filters: actor (autocomplete), action type, entity type, entity id (direct link), date range, IP
- [ ] Row layout: timestamp, actor (avatar + email + role badge), action ("updated product price"), entity ("Anti Aging Cream"), click to expand diff
- [ ] Expanded row shows before/after side-by-side for the diffed fields only
- [ ] Per-entity history drawer component `<EntityHistoryDrawer entityType="product" entityId={id} />` — reusable
- [ ] Wire drawer into: product detail page, order detail page, customer detail page, site settings, subscription detail (admin), plan editor, coupon editor
- [ ] "My Activity" page for regular users at `/settings/my-activity` — filtered to actor_user_id = me
- [ ] Export filtered activity log as CSV (admin only) for compliance / legal review
- [ ] One-time migration: COPY existing branding_audit_log rows into activity_log with entity_type='app_settings', action='updated_branding'
- [ ] Real-time updates via Supabase realtime subscription so admins see activity as it happens

## Acceptance
- Admin sees a live feed; filtering by actor=arvind@... shows only his actions across all entities
- Opening a product that was edited twice shows two history entries with clear diffs ("price: 120 → 95", "status: draft → publish")
- User disputes "someone changed my product" — admin filters by that product's entity_id and sees the exact actor + timestamp + IP
- Exported CSV opens cleanly in Excel with all columns readable