---
title: Dynamic webhook URL via NEXT_PUBLIC_APP_URL env var
status: todo
priority: urgent
type: feature
tags: [deployment, webhooks]
created_by: agent
created_at: 2026-04-18
position: 47
---

## Notes
Webhook delivery URLs currently hardcoded/derived from request host, so they bake in the dev softgen.dev URL. When we deploy to production (tryapp.cc) or change domains later, all registered WooCommerce webhooks point to the dead URL.

Fix: single source of truth via `NEXT_PUBLIC_APP_URL` env var.
- Local dev: `NEXT_PUBLIC_APP_URL=https://<softgen-preview>.softgen.dev` in .env.local
- Production Vercel: `NEXT_PUBLIC_APP_URL=https://tryapp.cc` in Vercel env vars
- Fallback logic: if env missing, fall back to request host (dev safety net)

Files to audit and update:
- src/pages/api/stores/[storeId]/register-webhooks.ts — where webhook delivery_url is built
- src/services/webhookService.ts — any URL construction
- src/components/project/WebhookPanel.tsx — "Repair Webhooks" action

Add helper: `src/lib/app-url.ts` — `getWebhookDeliveryUrl(storeId)` returns full URL from env. Used everywhere.

Add a "Repair All Webhook URLs" global admin action: iterate every webhook across all stores, PUT updated delivery_url to WooCommerce API. One button rescues the whole fleet if domain ever changes. Put it in settings/admin area + per-site button (exists).

## Checklist
- [ ] Create src/lib/app-url.ts with getAppUrl() and getWebhookDeliveryUrl(storeId) helpers
- [ ] Update .env.local.example to document NEXT_PUBLIC_APP_URL
- [ ] Audit src/pages/api/stores/[storeId]/register-webhooks.ts — use helper for delivery URL
- [ ] Audit src/services/webhookService.ts — use helper
- [ ] Enhance "Repair Webhooks" in WebhookPanel: instead of delete+recreate, PUT existing webhook with new delivery URL (preserves webhook ID + history)
- [ ] Add "Repair All Webhook URLs" action in src/pages/webhooks/index.tsx header — iterates all active webhooks, updates URLs
- [ ] Add API endpoint src/pages/api/webhooks/repair-all.ts (admin only, uses service role)
- [ ] check_for_errors