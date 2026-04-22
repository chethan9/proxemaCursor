# WooSync - Multi-Tenant WooCommerce Integration Platform

## Vision
Operations console + public API for agencies managing multiple WooCommerce stores. Acts as a caching/sync layer that keeps a Postgres mirror of WooCommerce data fresh (via initial sync + webhooks + timed cron), then exposes that data via a secure REST API to downstream apps (Flutter mobile app, etc) — eliminating slow direct WooCommerce API calls.

**Users:** Agency teams managing multiple client stores, mobile/web app developers consuming the API

## Design
- `--background: 0 0% 100%` (white)
- `--foreground: 222 47% 11%` (slate-900)
- `--primary: 221 83% 53%` (blue-600)
- `--secondary: 210 40% 96%` (slate-100)
- `--accent: 210 40% 96%` (slate-100)
- `--muted: 210 40% 96%` (slate-100)
- `--sidebar: 222 47% 11%` (dark slate)
- `--sidebar-foreground: 210 40% 98%` (white)
- `--success: 142 76% 36%` (emerald)
- `--warning: 38 92% 50%` (amber)
- `--destructive: 0 84% 60%` (rose)

**Fonts:** Inter (sans), JetBrains Mono (mono)
**Style:** Professional ops console, data-dense, clear hierarchy, status-driven

## Features
- Client → Site hierarchy (each client owns multiple sites, strict data isolation)
- Site onboarding via OAuth or direct consumer key/secret
- Multi-aspect sync engine: products, orders, customers, categories, tags, coupons
- Three sync modes: (1) initial full sync, (2) real-time via WooCommerce webhooks, (3) timed cron refresh (configurable interval per site)
- Webhook testing + ping + event log
- Sync dry-run / test feature
- Per-site health score (sync freshness, success rate, webhook status, connectivity)
- Dashboard with fleet-wide monitoring
- Excel-like data explorer with search, filters, CSV export, side panel detail view
- Public REST API v1 with per-client bearer tokens + rate limiting for Flutter/external app access
- Complete sync + webhook + cron logs with history

### SaaS monetization layer (major release)
- Tiered plans with quota enforcement (max sites, products per site, users, monthly API calls) + feature flags
- Subscription lifecycle: trialing → active → past_due → locked → canceled, with grace period
- **Multi-gateway, region-routed**: MyFatoorah for Middle East (KW/SA/AE/BH/OM/QA/JO — for KNET + local card support), Razorpay for the rest of the world. Pluggable architecture so Tap/Stripe/etc can drop in later.
- **Localized pricing per country**: plans store a `prices` map (`{USD: 29, KWD: 9, INR: 2400, AED: 110}`), not FX conversion. Each region sees its native currency.
- **Country/currency detection** at signup via Cloudflare header → IP geo fallback → timezone heuristic. User can override in profile.
- Tokenized card capture, recurring charges via saved token, webhook-driven status updates (both gateways)
- Our cron is source-of-truth for renewals (not gateway) — retries, grace periods, coupons under our control
- Auto-lock on non-payment with UI banner + API 402 response
- Coupon system (percent / fixed / free-months) with usage caps and plan scoping
- User-facing billing page: current plan, usage meter, payment method, invoice history, printable invoices — in the user's currency
- Admin panel: plans CRUD (per-currency prices), subscriptions overview, manual refunds/comps/plan overrides, coupons CRUD
- Public pricing page with auto-detected currency + manual country/currency switcher

### Accountability layer
- Unified `activity_log` (actor, entity, action, before/after diff, IP, user-agent) covering config tables via Postgres triggers AND semantic actions via app-layer logging
- Admin viewer with filters (who, when, entity type, action) + per-entity history panel
- User-facing "my activity" page for transparency
- Every billing-impacting action logged (plan change, refund, coupon apply, subscription override) so disputes have evidence