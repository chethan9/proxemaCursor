---
title: Manual connection webhook registration fix
status: todo
priority: urgent
type: bug
tags: [sync, webhooks, onboarding]
created_by: agent
created_at: 2026-04-20
position: 0
---

## Notes

**Bug:** Manual-key connected stores never get webhooks registered. The OAuth flow relies on `src/pages/api/woocommerce/callback.ts:51` firing `register-webhooks` after WooCommerce POSTs credentials back. Manual flow bypasses the callback entirely — user enters keys → store created with status `connected` → redirected to `/sites/connect/{id}?manual=1` → wizard fakes the "Registering webhooks" step without any API call.

**Evidence:** `src/pages/sites/connect/[id].tsx:122-134` (`runEstimateAndLiftoff`) marks webhooks step done with no fetch. Webhooks count on the Todoo site UI screenshot shows 0 total/0 active after manual connection.

**Fix approach:** Make the wizard the single source of truth for webhook registration — works identically for OAuth and manual paths.

1. In `runEstimateAndLiftoff` (connect wizard), before marking `webhooks` step done, actually `POST /api/stores/{storeId}/register-webhooks` and await the response. The endpoint is already idempotent (kept/adopted/created) so safe to always call.
2. Remove the fire-and-forget `register-webhooks` call from `woocommerce/callback.ts:51` — wizard now owns it, one code path.
3. Show real status for this step:
   - Spinner while registering
   - If success: mark done with count summary from response (e.g. "8/8 OK")
   - If failure: mark step as error + show inline warning "Webhooks couldn't register — real-time sync disabled. You can retry from site settings" with a Retry button
4. Error is non-blocking — user can still liftoff without webhooks (sync still works, just not real-time updates)

## Checklist

- [ ] Update `src/pages/sites/connect/[id].tsx` `runEstimateAndLiftoff` to `await fetch("/api/stores/{id}/register-webhooks", { method: "POST" })` before marking webhooks step done
- [ ] Show spinner during the call, done/error icon after
- [ ] On error, render inline warning under the webhooks step with "Retry" button and "Skip & continue" button
- [ ] Remove the fire-and-forget webhook registration from `src/pages/api/woocommerce/callback.ts` (wizard owns it now)
- [ ] Verify the manual flow: create store with keys → redirected to wizard → webhooks step actually calls API → proceeds to estimate and liftoff
- [ ] Verify the OAuth flow still works end-to-end since callback no longer registers

## Acceptance

- After completing manual-keys connection, the new site's Webhooks tab shows 6/6 registered active webhooks (matching WEBHOOK_TOPICS)
- After completing OAuth connection, same result — no double registration
- If WooCommerce rejects webhook registration (e.g. read-only keys), wizard shows a clear inline error and lets user continue with sync