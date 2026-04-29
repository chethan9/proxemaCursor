# Plan: Faster first-time WooCommerce → Supabase import

Goal: shorten **time-to-usable data** after a store connects, without breaking WooCommerce REST semantics or Supabase limits.

**Related code:** `src/pages/api/stores/[storeId]/sync.ts`, `src/lib/sync-engine.ts`, `src/pages/api/stores/[storeId]/sync-start.ts`, `src/pages/api/woocommerce/callback.ts`, `src/pages/api/cron/sync-scheduler.ts`, `src/pages/api/stores/[storeId]/prefetch.ts`.

---

## Current behavior (baseline)

- Initial full sync runs aspects in **parallel** with **chunked paging** (`WOO_SYNC_MAX_PAGES_PER_CHUNK` / `getWooSyncMaxPagesPerChunk()` × `PER_PAGE` per aspect per invocation).
- Incomplete aspects **resume** via cron (`sync-scheduler`) when heartbeat is stale.
- Each batch: **SELECT existing `woo_id`s** then **upsert** (`persistAndCheckpoint`) — accurate created/updated counts at the cost of extra DB round trips.

---

## Phase 1 — Quick wins (low risk)

| # | Change | Rationale | Risk |
|---|--------|-----------|------|
| 1.1 | **Optional:** skip or defer the pre-upsert `select("woo_id")` on **initial** runs only; derive counts from `upsert` result or accept approximate metrics | Cuts ~1 DB round trip per batch during the heaviest period | Slightly less accurate `records_created` / `records_updated` in UI unless we use `returning` |
| 1.2 | **Tune** `WOO_SYNC_MAX_PAGES_PER_CHUNK` (default 12, max 20) **only when** `maxDuration` headroom exists; validate on Vercel logs | Fewer resume cycles for large catalogs | Longer single invocation; risk of timeout on slow Woo |
| 1.3 | **Prioritize aspects for UX:** run **categories, tags, brands** before or with strict concurrency limits on **products/orders** so filters and lists feel populated sooner | Perceived speed; taxonomy is smaller | Requires ordering or phased `Promise.all` / sequential stages |
| 1.4 | **Prefetch path:** expand or parallelize `prefetch.ts` so connect wizard lands with **categories + first page of products** already warm (already partially there) | Faster first paint on `/sites/:id/products` | Extra Woo load at connect time |

**Exit criteria:** measurable drop in median **seconds until N products** (or until categories non-empty) on test stores; no increase in 429/5xx from Woo; sync runs still complete or resume cleanly.

---

## Phase 2 — Throughput (medium effort)

| # | Change | Rationale | Risk |
|---|--------|-----------|------|
| 2.1 | **Chain one extra chunk** in-process when time budget allows (e.g. after first chunk, if `Date.now() - start < threshold`, invoke another `runAspectChunk` without waiting for cron) | Reduces dependency on cron latency between chunks | Must guard total duration vs `maxDuration` |
| 2.2 | **Adaptive concurrency** for `fetchPagesChunked`: retry failed pages at halved parallelism before aborting | Protects weak hosts; stable hosts rarely hit this path | More branching/tests |
| 2.3 | **Supabase:** batch upsert tuning — larger batches where row size allows; confirm indexes on `(store_id, woo_id)` | Faster writes | Payload limits; memory |

**Exit criteria:** large test store (10k+ products) completes **fewer** cron resume cycles; **p95** Woo error rate unchanged.

---

## Phase 3 — Structural (higher effort, optional)

| # | Change | Rationale | Risk |
|---|--------|-----------|------|
| 3.1 | **Unify** scheduled sync: migrate legacy loop in `sync-scheduler.ts` to call the same pipeline as `sync.ts` (or extract shared module) | One behavior, easier tuning | Regression testing across cron |
| 3.2 | **Initial-load bulk path:** Postgres-side bulk ingest (e.g. staging table + merge) for **first full** sync only | Maximum insert throughput | Migration + operational complexity |
| 3.3 | **Observability:** structured logs/metrics per aspect (pages/sec, upsert latency, Woo status codes) | Data-driven tuning | Log volume |

---

## Testing checklist (each phase)

1. Small store (&lt;100 products): full sync &lt; existing baseline time.
2. Large store or fixture: no stuck `sync_runs`; resume works after simulated timeout.
3. Incremental sync after first run: **`modified_after`** path unchanged (no duplicate storms).
4. Webhooks still upsert correctly during/after initial sync.

---

## Deployment note

Production deploy is via `npm run deploy:prod` (`vercel deploy --prod --yes`). Schema changes for Phase 3 must follow **`docs/DEPLOYMENT.md`** (migrate DB before relying on new code).

---

## Phase 1 implementation status (in repo)

| Item | Status |
|------|--------|
| 1.1 Skip pre-upsert `SELECT` when `isInitial && !modifiedAfter` (onboarding full sync); counters approximate (`processed` + `updated` per batch) | Done — `persistAndCheckpoint` in `sync.ts` |
| 1.2 Default max pages per chunk **12** via `getWooSyncMaxPagesPerChunk()` (`WOO_SYNC_MAX_PAGES_PER_CHUNK`) | Done |
| 1.3 Taxonomy wave (categories, tags, brands) then heavy wave (products, orders, customers, coupons) | Done — two `Promise.all` waves in `sync.ts` |
| 1.4 Connect `prefetch.ts`: tags + brands pulled & upserted with existing product/order/category warmup | Done |

**Phase 2 (partial):** In-process **second chunk** for any aspect still `hasMore` after the first two waves, when `elapsed < 240s` from sync request start — see `INLINE_CHAIN_ELAPSED_CAP_MS` and `fetchRunningAspectRun` in `sync.ts`.

**Next:** optional larger upsert batches; optional dynamic tuning from Woo 429 rate.

**Phase 2.2 (partial):** `fetchPagesChunked` retries failed page fetches at reduced parallelism (`sync-engine.ts`).
