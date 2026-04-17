---
title: Fix webhook event reception + add webhook test feature
status: done
priority: high
type: feature
tags: [webhooks, testing]
created_by: agent
created_at: 2026-04-17
position: 9
---

## Notes
12 webhooks registered in WordPress but webhook_events table has 0 rows - WordPress isn't successfully delivering events to our endpoint. Possible causes:
1. Delivery URL uses localhost which WordPress can't reach (needs public tunnel/Vercel URL)
2. `buildWebhookDeliveryUrl` in webhookService.ts uses `window.location.origin` on client, but server-side it falls back to env var which may be unset
3. Webhook signature validation in `/api/webhooks/incoming/[storeId]` may reject valid requests

Also need test feature: send a synthetic test event through our endpoint to verify processing logic works, and a "ping" to WordPress to verify webhook is receiving.

## Checklist
- [ ] Set `NEXT_PUBLIC_APP_URL` env var requirement in README + add check in webhookService.buildWebhookDeliveryUrl that warns if using localhost
- [ ] Open src/pages/api/webhooks/incoming/[storeId].ts - log all incoming requests (headers + body) to debug what WordPress sends vs what we expect
- [ ] Verify HMAC signature validation logic - WordPress signs with `x-wc-webhook-signature` header using base64 HMAC-SHA256 of body with webhook secret
- [ ] Create POST `/api/stores/[storeId]/webhooks/[webhookId]/test` endpoint: sends a synthetic payload to our own incoming webhook URL and returns the result
- [ ] Create POST `/api/stores/[storeId]/webhooks/[webhookId]/ping` endpoint: calls WooCommerce `/webhooks/{id}/deliveries` to fetch recent delivery attempts from WordPress side
- [ ] Add "Test" button in webhooks table (site detail page) that calls test endpoint and shows result in a toast/dialog
- [ ] Add "Last Delivery" column to webhooks table showing success/failure of most recent WordPress delivery
- [ ] Insert webhook test results into `webhook_test_results` table for history
