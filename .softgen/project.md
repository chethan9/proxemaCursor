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