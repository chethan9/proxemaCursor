# Proxima Cursor — Codebase Index

**Repository:** https://github.com/chethan9/proxemaCursor

Living map of the project. Update when structure changes meaningfully (new top-level folders, new API surface, new DB tables, new major features). Last updated: 2026-04-20.

## Stack

- **Framework:** Next.js 15.5 (Pages Router) + React 18.3 + TypeScript 5
- **UI:** Tailwind 3.4 + shadcn/ui (Radix primitives)
- **Data:** Supabase (Postgres + Auth + RLS) via `@supabase/supabase-js`
- **State/cache:** TanStack Query 5 with persisted cache (`@tanstack/react-query-persist-client`)
- **Charts:** recharts 3
- **Drag-drop:** @dnd-kit
- **Deploy:** Vercel (`vercel.json`) + PM2 for local dev (`ecosystem.config.js`)

## Top-level layout

```
src/
  pages/              Next.js routes (UI pages + API routes)
  components/         UI components (feature-scoped subfolders)
  services/           All Supabase client-side data access
  hooks/queries/      React Query hooks wrapping services
  lib/                Pure utilities, auth helpers, query config
  contexts/           Theme, Auth, Branding providers
  integrations/       Supabase client + generated DB types
  styles/             globals.css (design tokens, Tailwind layers)
supabase/migrations/  Timestamped SQL migrations (35 files, idempotent runner)
scripts/              migrate.mjs — applies pending migrations
docs/                 DEPLOYMENT.md, PAGE_CONVENTIONS.md, CODEBASE_INDEX.md, JOURNAL.md
.softgen/tasks/       Task board (agent + user managed)
```

## Page routes (UI)

| Route | File | Purpose |
|---|---|---|
| `/` | `pages/index.tsx` | Fleet-wide dashboard: stats, charts, health, recent activity |
| `/clients` | `pages/clients/index.tsx` | Client list |
| `/clients/[id]` | `pages/clients/[id].tsx` | Single client detail (sites, API keys, activity) |
| `/projects` | `pages/projects/index.tsx` | Project/site fleet overview |
| `/projects/[id]` | `pages/projects/[id].tsx` | Project detail — sites, sync, webhooks, logs |
| `/sites/[id]/home` | `pages/sites/[id]/home.tsx` | Per-site home |
| `/sites/[id]/products` | ...products.tsx | Data explorer — products |
| `/sites/[id]/orders` | ...orders.tsx | Data explorer — orders |
| `/sites/[id]/categories` | ...categories.tsx | Taxonomy — categories |
| `/sites/[id]/tags` | ...tags.tsx | Taxonomy — tags |
| `/sites/[id]/settings` | ...settings.tsx | Per-site settings (sync config, delete) |
| `/sites/[id]/bulk-jobs` | ...bulk-jobs.tsx | Bulk job queue for this site |
| `/sites/connect/[id]` | `pages/sites/connect/[id].tsx` | OAuth/manual onboarding flow |
| `/sync-runs` | `pages/sync-runs/index.tsx` | Global sync run log |
| `/webhooks` | `pages/webhooks/index.tsx` | Webhook config & status |
| `/webhooks/activity` | `pages/webhooks/activity.tsx` | Webhook event stream |
| `/explore` | `pages/explore/index.tsx` | Cross-site data explorer entry |
| `/explore/[id]` | `pages/explore/[id].tsx` | Explorer for selected site |
| `/api-management` | `pages/api-management.tsx` | API keys + stats + reference |
| `/settings/*` | `pages/settings/*` | Profile, users, roles, theme, menu-editor, payment-methods |
| `/auth/*` | `pages/auth/*` | login, signup, forgot/reset password, confirm-email, bootstrap |

## Backend API routes

### Public v1 API (bearer-token, for Flutter/external)
- `GET /api/v1/products`
- `GET /api/v1/orders`
- `GET /api/v1/customers`
- `GET /api/v1/categories`
- `GET /api/v1/stores`

Auth via `Authorization: Bearer <api_key>` → validated through `lib/api-auth.ts` → scoped to client's stores.

### Internal (session auth)
- `POST /api/stores/create`
- `DELETE /api/stores/[storeId]/delete`
- `POST /api/stores/[storeId]/sync` — trigger sync (aspect order: products → orders → categories → tags → customers → coupons → variations)
- `POST /api/stores/[storeId]/sync-start` — trigger background sync, stamps `onboarding_completed_at`
- `POST /api/stores/[storeId]/prefetch` — **instant onboarding**: parallel fetch of top 50 products, 50 orders, all categories; runs during post-webhook redirect window; stamps onboarding complete + kicks off background sync
- `POST /api/stores/[storeId]/register-webhooks`
- `GET/PATCH /api/stores/[storeId]/products/[productId]`
- `GET /api/stores/[storeId]/products/[productId]/variations` — DB-first, Woo fallback + upsert
- `GET /api/stores/[storeId]/products/by-woo/[wooId]` — cache-on-read: missing product fetched live from Woo + upserted
- `GET/PATCH /api/stores/[storeId]/orders/[orderId]`
- `GET /api/stores/[storeId]/orders/by-woo/[wooId]` — cache-on-read: missing order fetched live + upserted
- `GET/PATCH /api/stores/[storeId]/categories/[categoryId]`
- `GET/PATCH /api/stores/[storeId]/tags/[tagId]`
- `POST /api/stores/[storeId]/retry-change/[changeId]`

### Webhooks
- `POST /api/webhooks/incoming/[storeId]` — WooCommerce → us (391 lines — candidate for split)
- `POST /api/webhooks/test/[webhookId]` — manual ping
- `POST /api/webhooks/repair-all` — re-register all delivery URLs after domain change (service_role)

### Cron (Vercel Cron / external scheduler)
- `/api/cron/sync-scheduler` — runs per-site sync interval (438 lines — candidate for split)
- `/api/cron/auto-fail-stuck` — marks stuck `running` sync runs as failed
- `/api/cron/process-bulk-jobs` — worker for queued bulk edits (373 lines — candidate for split)

### OAuth
- `POST /api/woocommerce/callback` — completes WooCommerce OAuth key exchange

## Services (client-side Supabase access)

All under `src/services/`. Components must go through these, never Supabase directly (see `docs/PAGE_CONVENTIONS.md` §1).

| Service | Responsibility |
|---|---|
| `authService.ts` | Signup, login, session, password reset, OAuth redirect URL |
| `clientService.ts` | CRUD on `clients` |
| `storeService.ts` | CRUD + health calc on `stores` |
| `syncService.ts` | Reads `sync_runs`, triggers syncs via API routes (249 lines) |
| `webhookService.ts` | Webhook CRUD + event history (222 lines) |
| `apiKeyService.ts` | API key generation, listing, revoke |
| `userService.ts` | User management inside a client org |
| `productService.ts` | Paginated product reads + mutations + `getOrFetchProductByWooId` cache-on-read |
| `orderService.ts` | Paginated order reads + mutations + `getOrFetchOrderByWooId` cache-on-read |
| `taxonomyService.ts` | Categories + tags reads |
| `paymentMethodService.ts` | Payment method lookup (for orders) |
| `viewPreferencesService.ts` | Per-user table view prefs |
| `menuConfigService.ts` | Sidebar menu customization |
| `bulkJobService.ts` | Bulk job enqueue + status |

## React Query hooks

Under `src/hooks/queries/`. Each wraps a service with a query key from `lib/query-client.ts#queryKeys`:

`useClients`, `useStores`, `useSyncRuns`, `useWebhooks`, `useProducts`, `useOrders`, `useTaxonomy`, `useBulkJobs`, `usePaymentMethods`.

Supporting hooks:
- `useBackgroundPagination` — background-prefetches pages up to `maxRecords: 5000`
- `useInfiniteScroll`
- `useViewPreferences`
- `use-toast`, `use-mobile`

## Libraries (`src/lib/`)

| File | Role |
|---|---|
| `utils.ts` | `cn()` class merger |
| `woocommerce-auth.ts` | Build Woo API signatures / OAuth URL |
| `woo-client.ts` | Low-level fetch wrapper for WooCommerce REST |
| `api-auth.ts` | Validate v1 bearer tokens, scope to client |
| `api-token.ts` | Token hashing helpers (server-only pure util) |
| `health-score.ts` | Per-site health score calc (freshness + success rate + webhook) |
| `permissions.ts` | Role → permission mapping |
| `query-client.ts` | Query client factory + `queryKeys` map |
| `query-persistence.ts` | Persist/restore query cache in localStorage, cache-bust on user change |
| `menu-merge.ts` / `menu-registry.ts` | Sidebar menu composition |
| `exportCsv.ts` | CSV export util (UTF-8 BOM, escaping, timestamped filename) |
| `app-url.ts` | Resolves public app URL for webhook delivery |

## Integrations

- `src/integrations/supabase/client.ts` — public (anon) client, used in browser
- `src/integrations/supabase/admin.ts` — service_role client, **server-only** (never imported from pages/components)
- `src/integrations/supabase/database.types.ts` — auto-generated (do not edit), 1498 lines
- `src/integrations/supabase/types.ts` — re-export wrapper

## Database (key tables)

Inferred from migrations + services. Full schema in `database.types.ts`.

- `clients` — tenants (agencies)
- `stores` — WooCommerce sites (belong to client)
- `profiles` — auth users, linked to client_id
- `user_roles` — RBAC rows
- `sync_runs` — every sync execution (aspect, status, records_processed)
- `webhooks` — per-store webhook registrations
- `webhook_events` — incoming webhook log
- `products`, `orders`, `order_items`, `customers`, `categories`, `tags`, `coupons` — mirrored Woo data
- `api_keys` — public v1 tokens (hashed)
- `bulk_jobs` — queued bulk edit jobs
- `deleted_records` — soft-delete archive
- `view_preferences`, `menu_config`, `payment_methods`, `branding`

RLS is enabled on every table. Policies match the tenant model: user's `profile.client_id` scopes access.

## Onboarding flow (instant)

1. User adds site (OAuth or manual consumer key/secret)
2. `/sites/connect/[id]` shows 4-step card: Authorizing → Receiving credentials → WordPress media auth → Registering webhooks
3. After webhooks register: `POST /api/stores/[id]/prefetch` fires in background → confetti modal shown → auto-redirect to `/sites/[id]/products` after 2.2s
4. Prefetch endpoint fetches top 50 products + 50 orders + all categories in parallel, stamps `onboarding_completed_at`, triggers full background sync
5. Background sync runs aspects sequentially: products → orders → categories → tags → customers → coupons → variations (last = Phase 3)
6. `InitialSyncBanner` visible on site pages until `initial_sync_completed_at` stamped
7. Any missing product/order gets fetched on-demand via `by-woo/[wooId]` endpoints + cached
8. Variations lazy-load on product edit (not fetched upfront)

**Resume entry points** (task 99):
- Sites table: "Resume" button when `onboarding_completed_at IS NULL`
- AddSite dialog: duplicate URL detection surfaces resume prompt
- Global modal (`IncompleteOnboardingPrompt` in `_app.tsx`): prompts on any page if user has incomplete sites

## Design system

- Tokens in `src/styles/globals.css` (`:root` — HSL values)
- Exposed as Tailwind classes via `tailwind.config.ts`
- Dark mode: not enabled
- Custom status colors: `--success`, `--warning`, `--destructive`, plus sidebar-specific tokens
- Fonts: Inter (sans), JetBrains Mono (mono) — imported in `globals.css` (must stay at top)

## Known refactor candidates (>350 lines)

See `JOURNAL.md` — track if/when these get split.

| File | Lines | Suggested split |
|---|---|---|
| `components/explore/ProductsTab.tsx` | 1101 | FilterBar / Table / QuickEdit / BulkActions |
| `components/explore/OrdersTab.tsx` | 892 | Same shape as Products |
| `pages/projects/[id].tsx` | 627 | Sections → `components/project/*` (some already exist) |
| `pages/sync-runs/index.tsx` | 675 | FilterBar / Table / DetailPanel |
| `pages/webhooks/activity.tsx` | 564 | EventList / FilterBar / DetailPanel |
| `pages/index.tsx` | 501 | StatsGrid / AttentionPanel / Charts |
| `pages/clients/[id].tsx` | 495 | Tabs → per-tab components |
| `pages/api/cron/sync-scheduler.ts` | 438 | Fine for server — split only if tested |
| `components/EntityHistory.tsx` | 415 | Timeline / DiffViewer |
| `pages/api/webhooks/incoming/[storeId].ts` | 391 | Handler per-topic |
| `pages/api/stores/[storeId]/sync.ts` | 389 | Aspect runners separated |
| `pages/webhooks/index.tsx` | 375 | Acceptable, review next refactor pass |
| `pages/api/cron/process-bulk-jobs.ts` | 373 | Worker per job-type |
| `components/DataExplorer.tsx` | 365 | Minor — acceptable |

## Agent-managed areas

- `.softgen/tasks/` — per-feature task markdown files, YAML frontmatter
- `.softgen/project.md` — project brief (vision, design, features)
- `docs/JOURNAL.md` — append-only change log (agent writes here on every meaningful change)

## Reference Docs

- **[PAGE_CONVENTIONS.md](./PAGE_CONVENTIONS.md)** — Page structure, routing, layout
- **[UI_REFERENCE.md](./UI_REFERENCE.md)** — Explorer page UI spec (toolbar, table, expanded row, pill actions). **Use for any new data-listing page.**
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — Deployment workflow
- **[JOURNAL.md](./JOURNAL.md)** — Decision log

## Quick navigation by intent

- **Add a new data type to mirror** → migration → service → query hook → data-explorer tab → v1 API route → webhook handler topic
- **Add a new page** → follow `docs/PAGE_CONVENTIONS.md` checklist
- **Change schema** → `supabase/migrations/YYYYMMDDHHMMSS_*.sql` → run `npm run db:migrate` → regenerate types → update affected services
- **Rotate webhook delivery URL fleet-wide** → `POST /api/webhooks/repair-all`
- **Investigate failed sync** → `sync_runs` table → `/sync-runs` UI → corresponding `sync_errors`/logs