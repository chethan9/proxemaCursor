---
title: Woo client hygiene — branded User-Agent and WAF detection helper
status: done
priority: high
type: chore
tags: [integration, reliability, observability]
created_by: agent
created_at: 2026-04-21
position: 132
---

## Notes
Cloudflare flagged a customer site with a Managed Challenge on `/wp-json/wc/v3/products` requests. Two improvements come out of that:

1. Our outbound Woo requests have no identifying User-Agent, so site admins can't allowlist us by UA and bot-protection engines can't distinguish us from scrapers.
2. We need a shared helper that classifies a failed Woo response by detecting common WAF/firewall signatures — the diagnostic wizard (task 133) depends on it.

Touch points: `src/lib/woo-client.ts`, `src/lib/woo-live-fetch.ts`, `src/pages/api/stores/[storeId]/sync.ts`, `src/pages/api/stores/[storeId]/register-webhooks.ts`, `src/pages/api/stores/[storeId]/prefetch.ts`, `src/pages/api/stores/[storeId]/live/*`, `src/pages/api/stores/[storeId]/products/*`, `src/pages/api/stores/[storeId]/orders/*`, `src/pages/api/stores/[storeId]/categories/*`, `src/pages/api/stores/[storeId]/tags/*`, `src/pages/api/stores/[storeId]/customers/*`, `src/lib/sync-error.ts`.

## Checklist
- [x] Add a branded User-Agent (e.g. `Proxima-Sync/1.0 (+${NEXT_PUBLIC_APP_URL})`) to every outbound WooCommerce HTTP call — in the shared `wooRequest` helper, the live-fetch helper, and any per-route ad-hoc `fetch(...)` to `/wp-json/*`. Search the codebase for `wp-json` fetches to ensure none are missed.
- [x] Include User-Agent on the OAuth return-URL probe as well (the post-OAuth sanity check) so that path is not blocked either.
- [x] Build `detectBlockingService(status: number, body: string, headers: Headers)` helper in `src/lib/sync-error.ts` returning `{ service: 'cloudflare' | 'sucuri' | 'wordfence' | 'aws-waf' | 'modsecurity' | 'unknown', hint: string, fixUrl?: string } | null`. Signatures to match:
  - Cloudflare: "Just a moment..." title, `cf-ray` header, `cf-mitigated` header, `cType: 'managed'` in body
  - Sucuri: "Access Denied - Sucuri" string, `x-sucuri-id` header
  - WordFence: "Your access to this site has been limited" / "wordfence" in body
  - AWS WAF: "Request blocked" + `x-amzn-requestid` header
  - ModSecurity: "Not Acceptable!" / "406 Not Acceptable" + `mod_security` in body
- [x] Wire `detectBlockingService()` into `WooApiError.context` when a non-OK response comes back in the sync pipeline and the live-fetch pipeline — store the detection result on the error context so downstream diagnosis can read it.
- [x] Refactor `wooRequest` + `wooLiveFetchWithCreds` to share a common inner fetch so User-Agent + detection are applied once, not duplicated.
- [x] Log the detected blocking service into `sync_runs.error_log` JSON so the sync history view shows WAF-type failures distinctly from generic 403s.

## Acceptance
- Every request leaving the app to a customer's WooCommerce site carries the branded User-Agent — confirmable by inspecting a customer's server access log after a sync.
- A failed sync against a Cloudflare-protected site records `blocking_service: "cloudflare"` on the sync run's error context, not just a generic 403.
- `detectBlockingService()` is unit-callable from anywhere and returns consistent results for known WAF response signatures.