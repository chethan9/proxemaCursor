/**
 * WooCommerce ↔ Supabase sync tuning.
 *
 * Large catalogs (e.g. 50k+ orders) complete via many chunked HTTP invocations + cron resume.
 * Defaults favor **weak shared hosting** (low parallel Woo load). Strong infra can raise limits via env.
 *
 * Env (all optional):
 * - `WOO_SYNC_PAGE_CONCURRENCY` — parallel WC REST page fetches per chunk (default **2**, max **8**).
 * - `WOO_SYNC_MAX_PAGES_PER_CHUNK` — WC pages per aspect per server invocation (default **12**, max **20**).
 * - `WOO_SYNC_HEAVY_ASPECT_CONCURRENCY` — parallel heavy aspects in an "all" sync (default **1**, max **4**).
 * - `WOO_SYNC_TAXONOMY_ASPECT_CONCURRENCY` — parallel taxonomy aspects in an "all" sync (default **2**, max **4**).
 * - `WOO_SYNC_PERSIST_BATCH_SIZE` — max rows per DB upsert write (default **1000**, max **1000**).
 */

function clampInt(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function getWooSyncPageConcurrency(): number {
  const raw = process.env.WOO_SYNC_PAGE_CONCURRENCY;
  const parsed = raw !== undefined ? parseInt(raw, 10) : NaN;
  return clampInt(parsed, 1, 8, 2);
}

/** Taxonomy endpoints are lighter — allow one extra parallel fetch vs heavy aspects when using defaults. */
export function getWooSyncTaxonomyPageConcurrency(): number {
  const base = getWooSyncPageConcurrency();
  return Math.min(4, base + 1);
}

export function getWooSyncMaxPagesPerChunk(): number {
  const raw = process.env.WOO_SYNC_MAX_PAGES_PER_CHUNK;
  const parsed = raw !== undefined ? parseInt(raw, 10) : NaN;
  return clampInt(parsed, 5, 20, 12);
}

export function getWooSyncHeavyAspectConcurrency(): number {
  const raw = process.env.WOO_SYNC_HEAVY_ASPECT_CONCURRENCY;
  const parsed = raw !== undefined ? parseInt(raw, 10) : NaN;
  return clampInt(parsed, 1, 4, 1);
}

export function getWooSyncTaxonomyAspectConcurrency(): number {
  const raw = process.env.WOO_SYNC_TAXONOMY_ASPECT_CONCURRENCY;
  const parsed = raw !== undefined ? parseInt(raw, 10) : NaN;
  return clampInt(parsed, 1, 4, 2);
}

export function getWooSyncPersistBatchSize(): number {
  const raw = process.env.WOO_SYNC_PERSIST_BATCH_SIZE;
  const parsed = raw !== undefined ? parseInt(raw, 10) : NaN;
  return clampInt(parsed, 100, 1000, 1000);
}
