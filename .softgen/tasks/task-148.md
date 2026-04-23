---
title: Activity log foundation (unified audit trail)
status: done
priority: urgent
type: feature
tags: [audit, security, schema, platform]
created_by: agent
created_at: 2026-04-22T22:10:00Z
position: 148
---

## Notes
Foundational for the entire major release. Every subsequent task writes into this log. Ships first so billing actions are audit-traceable from day one.

**Model:** hybrid. Postgres triggers on low-volume config tables (zero-escape guarantee, catches direct SQL); application-layer helper for high-volume semantic actions (bulk updates, logins, sync runs).

**Do NOT** put triggers on `products` / `orders` / `customers` — webhook sync would flood the log. Those get app-layer logging at the service level, with a single entry per user intent (e.g. "bulk_price_update: 47 products") rather than 47 row diffs.

The existing `branding_audit_log` stays for now — it's already writing; migrate its reads into the unified viewer in task-159 rather than dropping data.

**Actor resolution:** actor comes from `auth.uid()` in triggers and `getServerSession` / request context in app-layer calls. When actor is a cron or system process, stamp `actor_type = 'system'` with `actor_id = null`.

## Checklist
- [x] `activity_log` table with columns: actor_user_id, actor_email, actor_type (user/admin/system/api), action (string), entity_type, entity_id, diff (jsonb before/after), metadata (jsonb for free-form context like IP / user-agent / request path), created_at, indexed on (entity_type, entity_id) and (created_at DESC)
- [x] RLS: super-admin reads everything; regular users read only rows where actor_user_id = auth.uid() OR entity_type = 'client' and entity_id = their client
- [x] `log_change_generic()` SECURITY DEFINER trigger function — parameterized by table name, diffs only changed columns, writes to activity_log
- [x] Attach triggers to config tables: plans, subscriptions, roles ✓, profiles ✓ (role changes only), coupons, app_settings (augment existing branding trigger), payment_methods, invoices — remaining tables get triggers in their own task migrations (149/151/153/156)
- [x] App-layer helper `logActivity({ action, entity, before, after, metadata })` importable from `@/lib/activity-log` for use in API routes
- [x] Helper captures request IP + user-agent from NextApiRequest headers automatically
- [x] Wire helper into existing product, order, customer, site service mutations (create/update/delete only — not reads)
- [x] Wire helper into auth events (login, logout, password reset, role change, user invite)

## Acceptance
- Changing a plan name in admin panel creates one activity_log row with before/after diff
- Deleting a product via UI creates one activity_log row with the deleted snapshot
- Viewing the raw activity_log as a non-admin shows only your own actions
- A direct `UPDATE plans SET price = 999 WHERE id = ...` executed in Supabase SQL editor still appears in the log (trigger caught it)