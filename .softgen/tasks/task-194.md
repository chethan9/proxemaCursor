---
title: Admin payment gateway & API settings panel
status: todo
priority: high
type: feature
tags: [admin, settings, payments, api-keys]
created_by: agent
created_at: 2026-04-24T23:10:00Z
position: 194
---

## Notes

Currently gateway credentials live in env vars only (see `src/lib/payments/myfatoorah.ts`, `razorpay.ts`, and the new `tap.ts` from task-193), hardcoded region→gateway routing in `src/lib/payments/routing.ts`, and the public REST API keys page at `src/pages/api-management.tsx` sits outside admin settings. No admin UI to rotate keys, toggle gateways on/off, override routing per country, view webhook URLs, or test a connection.

This task adds a **single Admin → Payment & API Settings** area consolidating:
1. Gateway credentials management (MyFatoorah, Razorpay, Tap) — DB-backed, encrypted at rest, env remains fallback
2. Per-gateway enable/disable + test-mode vs live-mode toggle
3. Region override matrix — pick gateway per country, overrides hardcoded defaults
4. Webhook URL panel — show the exact URL to paste into each gateway dashboard + regenerate webhook secret
5. Test-connection button per gateway (pings balance/charges-list endpoint)
6. Public REST API keys section — relocate / embed existing `api-management.tsx` functionality here under the same admin umbrella

**Access control:** admin-only (role check via existing `AuthProvider`/permissions). Non-admins get 403.

**DB schema (new tables):**
- `payment_gateway_config`: `gateway` (text, PK), `enabled` (bool), `mode` (`test`|`live`), `credentials_encrypted` (jsonb encrypted), `webhook_secret_encrypted` (text encrypted), `updated_at`, `updated_by` (uuid)
- `payment_region_routing`: `country_code` (text, PK), `gateway` (text FK), `updated_at`, `updated_by`
- Encrypted columns use pgcrypto `pgp_sym_encrypt` with a key from `SUPABASE_VAULT_KEY` env var (or similar). Helper SQL functions `get_gateway_credentials(gateway)` returning decrypted jsonb, and `set_gateway_credentials(gateway, creds)` for writes — both `SECURITY DEFINER`, callable only by admin roles.

**Routing resolution order** (implement in a shared `resolveGatewayConfig(gateway)` helper):
1. DB row in `payment_gateway_config` if `enabled = true` and credentials present → use those
2. Otherwise env vars → use those (backward compat)
3. Neither → gateway reports `configured: false`, health endpoint returns error

**Region routing:** `getGatewayForCountry(country)` reads `payment_region_routing` (cached for 60s) and falls back to the hardcoded MENA→MyFatoorah / else→Razorpay default when no row exists.

**Webhook URL display:** shows `${APP_URL}/api/billing/webhooks/{gateway}` with a copy button. "Regenerate secret" creates a new value, stores encrypted, shows it once in a modal ("Save this now — it won't be shown again"), and invalidates the previous secret.

**Test connection:** admin clicks → server calls a low-cost read on the gateway API (MyFatoorah: `/v2/InitiatePayment` dry-run or balance; Razorpay: `GET /v1/payments?count=1`; Tap: `GET /v2/charges?limit=1`) and surfaces 200/401/etc with latency.

**Activity log:** every credential write, gateway enable/disable, region override change, and secret regeneration logs to `activity_log` with before/after (credentials masked — show only last 4 chars of secret keys).

## Checklist

- [ ] DB migration: create `payment_gateway_config` + `payment_region_routing` tables, RLS (admin-only via role check), pgcrypto helper functions
- [ ] Service `src/services/paymentGatewayConfigService.ts` (client) + `src/services/paymentGatewayConfigService.server.ts` (server): CRUD helpers that call the RPC functions, never expose decrypted secrets to client
- [ ] Update `src/lib/payments/myfatoorah.ts`, `razorpay.ts`, `tap.ts` to accept an optional `ConfigOverride` param and fall back to env vars when absent; build a shared `loadGatewayConfig(gateway)` in `src/lib/payments/config.ts`
- [ ] Update `src/lib/payments/routing.ts` `getGatewayForCountry` to consult `payment_region_routing` (cached 60s) with env-default fallback
- [ ] Admin page `src/pages/admin/payment-gateways.tsx`: three collapsible cards (MyFatoorah, Razorpay, Tap), each with Enabled toggle, Mode pills (Test/Live), Public Key input, Secret Key input (masked, "Show" toggle with confirm), Webhook Secret field with Regenerate button, Webhook URL read-only copy-to-clipboard, Test Connection button with result pill
- [ ] Region routing matrix UI below the gateway cards: table of countries (grouped by region) with dropdown per country picking from enabled gateways; shows "Default (MyFatoorah/Razorpay)" placeholder when no override; bulk "Reset region to default" action
- [ ] Section "Public API Keys" on the same page: embed the existing `api-management.tsx` components (`ApiKeyStats`, `ApiKeysTable`, `CreateKeyDialog`, `ApiCallLogs`) under a collapsible header — or move the page fully into admin and redirect `/api-management` to the new location
- [ ] Server endpoint `/api/admin/payment-gateways/[gateway]/test.ts`: admin-only, pings the live gateway API, returns `{ ok: boolean, latencyMs: number, error?: string }`
- [ ] Server endpoint `/api/admin/payment-gateways/[gateway]/regenerate-secret.ts`: generates new webhook secret, stores encrypted, returns plaintext ONCE in response (client shows it in a one-time modal)
- [ ] AppSidebar: add "Payment Gateways" link under Admin section (visible to admins only, uses `CreditCard` icon)
- [ ] Activity log integration: hook every mutation (credential update, enable/disable, mode change, region override, secret regenerate) into the existing `activityLogService` with secrets masked to last 4 chars
- [ ] Update existing `/api/billing/gateway/health` to include Tap and report config source (`db` vs `env`) for each gateway — useful for admins verifying DB overrides took effect

## Acceptance

- An admin can paste new MyFatoorah test keys into the UI, click Save, then Test Connection, and see a green "Connected — 240ms" result without touching env vars or redeploying.
- An admin flips Kuwait from MyFatoorah to Tap in the region matrix, and the next checkout from a Kuwait user renders the Tap card form instead of MyFatoorah's redirect — verified by checking the network tab goes to `/api/billing/tap/charge` instead of `/api/billing/checkout?gateway=myfatoorah`.
- Regenerating a webhook secret shows the new value exactly once in a modal, stores the encrypted form in DB, and the old value stops validating incoming webhooks immediately.