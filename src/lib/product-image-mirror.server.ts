/**
 * Orchestrates mirroring Woo product image URLs to Cloudflare Images and denormalized URLs on products.
 */

import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { ResolvedCloudflareConfig } from "@/lib/cloudflare-images-config.server";
import { CLOUDFLARE_SETTINGS_SINGLETON_ID, getResolvedCloudflareConfig } from "@/lib/cloudflare-images-config.server";
import { buildDeliveryUrls, deleteCloudflareImage, uploadImageFromUrl } from "@/lib/cloudflare-images.server";
import {
  normalizeProductImageSrc,
  productImageStorageKey,
  type ProductImageMirrorUrlsMap,
  type ProductMirrorUrlsEntry,
} from "@/lib/product-image-urls";

const rawMirrorConcurrency = Number(process.env.CF_MIRROR_IMAGE_CONCURRENCY || 6);
const MIRROR_CONCURRENCY = Number.isFinite(rawMirrorConcurrency) ? Math.min(12, Math.max(1, rawMirrorConcurrency)) : 6;
const rawBackfillProductConcurrency = Number(process.env.CF_BACKFILL_PRODUCT_CONCURRENCY || 4);
const BACKFILL_PRODUCT_CONCURRENCY = Number.isFinite(rawBackfillProductConcurrency)
  ? Math.min(12, Math.max(1, rawBackfillProductConcurrency))
  : 4;

function logCfMirrorMetric(cfg: ResolvedCloudflareConfig | null, payload: Record<string, unknown>) {
  const on = cfg?.metricsEnabled || process.env.CLOUDFLARE_IMAGE_MIRROR_METRICS === "true";
  if (!on) return;
  console.log(JSON.stringify({ source: "cf_product_images", ts: new Date().toISOString(), ...payload }));
}

export async function isProductImageMirroringEnabled(): Promise<boolean> {
  const c = await getResolvedCloudflareConfig();
  return c != null;
}

async function mergeMirrorJson(productId: string, storageKey: string, urls: ProductMirrorUrlsEntry): Promise<void> {
  const { data: row } = await supabaseAdmin.from("products").select("image_mirror_urls").eq("id", productId).maybeSingle();
  const cur = (row?.image_mirror_urls as ProductImageMirrorUrlsMap | undefined) || {};
  const next = { ...cur, [storageKey]: urls };
  await supabaseAdmin.from("products").update({ image_mirror_urls: next as never }).eq("id", productId);
}

async function mergeMirrorJsonForAllProductsWithKey(
  storeId: string,
  storageKey: string,
  urls: ProductMirrorUrlsEntry
): Promise<void> {
  const { data: refs } = await supabaseAdmin.from("product_image_mirrors").select("product_id").eq("store_id", storeId).eq("storage_key", storageKey);
  const ids = [...new Set((refs || []).map((r) => r.product_id))];
  await Promise.all(ids.map((pid) => mergeMirrorJson(pid, storageKey, urls)));
}

async function mapPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  let ix = 0;
  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, async () => {
    while (true) {
      const i = ix++;
      if (i >= items.length) break;
      await fn(items[i]);
    }
  });
  await Promise.all(workers);
}

export async function mirrorOneImageForProduct(
  storeId: string,
  productId: string,
  rawSrc: string,
  sourceKind: "sync" | "save" | "repair"
): Promise<void> {
  const cfg = await getResolvedCloudflareConfig();
  if (!cfg) return;
  if (!rawSrc || !/^https?:\/\//i.test(rawSrc)) return;

  const normalized = normalizeProductImageSrc(rawSrc);
  const storageKey = productImageStorageKey(normalized);

  const { data: crossReady } = await supabaseAdmin
    .from("product_image_mirrors")
    .select("cf_image_id")
    .eq("store_id", storeId)
    .eq("storage_key", storageKey)
    .eq("status", "ready")
    .not("cf_image_id", "is", null)
    .limit(1)
    .maybeSingle();

  let cfId: string | null = crossReady?.cf_image_id ?? null;

  const { data: existingRow } = await supabaseAdmin
    .from("product_image_mirrors")
    .select("id, cf_image_id, status")
    .eq("store_id", storeId)
    .eq("product_id", productId)
    .eq("storage_key", storageKey)
    .maybeSingle();

  if (!existingRow) {
    const { error: insErr } = await supabaseAdmin.from("product_image_mirrors").insert({
      store_id: storeId,
      product_id: productId,
      src_normalized: normalized,
      storage_key: storageKey,
      status: cfId ? "ready" : "pending",
      cf_image_id: cfId,
      source_kind: sourceKind,
      last_checked_at: new Date().toISOString(),
    });
    if (insErr?.code === "23505") {
      /* concurrent insert — continue */
    } else if (insErr) {
      console.warn("[product-image-mirror] insert failed", insErr.message);
      return;
    }
  }

  if (cfId) {
    const urls = buildDeliveryUrls(cfId, cfg);
    await mergeMirrorJsonForAllProductsWithKey(storeId, storageKey, urls);
    await supabaseAdmin
      .from("product_image_mirrors")
      .update({
        status: "ready",
        cf_image_id: cfId,
        error: null,
        last_checked_at: new Date().toISOString(),
      })
      .eq("store_id", storeId)
      .eq("storage_key", storageKey);
    logCfMirrorMetric(cfg, {
      outcome: "ready",
      store_id: storeId,
      product_id: productId,
      storage_key: storageKey,
      source_kind: sourceKind,
      reused: true,
    });
    return;
  }

  const up = await uploadImageFromUrl(normalized);
  if (up.ok === false) {
    const errMsg = up.error.slice(0, 500);
    await supabaseAdmin
      .from("product_image_mirrors")
      .update({
        status: "failed",
        error: errMsg,
        last_checked_at: new Date().toISOString(),
      })
      .eq("store_id", storeId)
      .eq("product_id", productId)
      .eq("storage_key", storageKey);
    logCfMirrorMetric(cfg, {
      outcome: "failed",
      store_id: storeId,
      product_id: productId,
      storage_key: storageKey,
      source_kind: sourceKind,
      error: errMsg.slice(0, 200),
    });
    return;
  }

  cfId = up.id;
  const urls = buildDeliveryUrls(cfId, cfg);
  await mergeMirrorJsonForAllProductsWithKey(storeId, storageKey, urls);

  await supabaseAdmin
    .from("product_image_mirrors")
    .update({
      status: "ready",
      cf_image_id: cfId,
      error: null,
      last_checked_at: new Date().toISOString(),
    })
    .eq("store_id", storeId)
    .eq("storage_key", storageKey);
  logCfMirrorMetric(cfg, {
    outcome: "ready",
    store_id: storeId,
    product_id: productId,
    storage_key: storageKey,
    source_kind: sourceKind,
    reused: false,
  });
}

export async function mirrorImagesForProductRow(
  storeId: string,
  productId: string,
  imagesJson: unknown,
  sourceKind: "sync" | "save" | "repair"
): Promise<void> {
  if (!(await isProductImageMirroringEnabled())) return;
  if (!Array.isArray(imagesJson)) return;
  const urls = imagesJson as { src?: string }[];
  const uniqueSrcs = [...new Set(urls.map((x) => x?.src).filter(Boolean) as string[])];
  await mapPool(uniqueSrcs, MIRROR_CONCURRENCY, async (src) => {
    await mirrorOneImageForProduct(storeId, productId, src, sourceKind);
  });
}

export async function mirrorImagesForProductRows(
  storeId: string,
  rows: { id: string; images: unknown }[],
  sourceKind: "sync" | "save" | "repair"
): Promise<void> {
  if (!(await isProductImageMirroringEnabled())) return;
  for (const row of rows) {
    await mirrorImagesForProductRow(storeId, row.id, row.images, sourceKind);
  }
}

/** After removing mirror rows for a product, delete CF assets no longer referenced. */
export async function deleteMirrorsForProduct(productId: string): Promise<void> {
  const { data: rows } = await supabaseAdmin.from("product_image_mirrors").select("cf_image_id").eq("product_id", productId);
  const cfIds = [...new Set((rows || []).map((r) => r.cf_image_id).filter(Boolean) as string[])];
  await supabaseAdmin.from("product_image_mirrors").delete().eq("product_id", productId);
  const cfg = await getResolvedCloudflareConfig();
  if (!cfg) return;
  for (const cfId of cfIds) {
    const { count } = await supabaseAdmin
      .from("product_image_mirrors")
      .select("id", { count: "exact", head: true })
      .eq("cf_image_id", cfId);
    if ((count ?? 0) === 0) {
      await deleteCloudflareImage(cfId);
    }
  }
}

/** Call before deleting a store row — removes CF images tracked for this store. */
export async function deleteMirrorsForStore(storeId: string): Promise<void> {
  const { data: rows } = await supabaseAdmin
    .from("product_image_mirrors")
    .select("cf_image_id")
    .eq("store_id", storeId)
    .not("cf_image_id", "is", null);
  const cfIds = [...new Set((rows || []).map((r) => r.cf_image_id).filter(Boolean) as string[])];
  await supabaseAdmin.from("product_image_mirrors").delete().eq("store_id", storeId);
  const cfg = await getResolvedCloudflareConfig();
  if (!cfg) return;
  for (const id of cfIds) {
    await deleteCloudflareImage(id);
  }
}

export async function repairPendingMirrorsBatch(limit: number): Promise<{
  attempted: number;
  ok: number;
  failed: number;
}> {
  if (!(await isProductImageMirroringEnabled())) return { attempted: 0, ok: 0, failed: 0 };
  const cfg = await getResolvedCloudflareConfig();
  const effectiveLimit = Math.min(limit, cfg?.repairBatchSize ?? limit);
  const { data: pending } = await supabaseAdmin
    .from("product_image_mirrors")
    .select("store_id, product_id, src_normalized, storage_key")
    .in("status", ["pending", "failed"])
    .limit(effectiveLimit);

  let ok = 0;
  let failed = 0;
  for (const row of pending || []) {
    try {
      await mirrorOneImageForProduct(row.store_id, row.product_id, row.src_normalized, "repair");
      const { data: check } = await supabaseAdmin
        .from("product_image_mirrors")
        .select("status")
        .eq("store_id", row.store_id)
        .eq("product_id", row.product_id)
        .eq("storage_key", row.storage_key)
        .maybeSingle();
      if (check?.status === "ready") ok++;
      else failed++;
    } catch {
      failed++;
    }
  }
  return { attempted: (pending || []).length, ok, failed };
}

export type MirrorBackfillBatchResult = {
  ok: boolean;
  integrationEnabled: boolean;
  scanned: number;
  touched: number;
  skipped: number;
  errors: number;
  nextAfterId: string | null;
  hasMore: boolean;
};

const BACKFILL_MAX_PRODUCTS = 100;

/**
 * Walks products in id order and mirrors any HTTPS gallery URLs that are not already `ready` in product_image_mirrors.
 * Idempotent with mirrorImagesForProductRow. Use small batches + cursor to stay within serverless timeouts.
 */
export async function runMirrorBackfillBatch(opts: {
  storeId?: string | null;
  afterId?: string | null;
  productLimit: number;
}): Promise<MirrorBackfillBatchResult> {
  const enabled = await isProductImageMirroringEnabled();
  if (!enabled) {
    return {
      ok: true,
      integrationEnabled: false,
      scanned: 0,
      touched: 0,
      skipped: 0,
      errors: 0,
      nextAfterId: null,
      hasMore: false,
    };
  }

  const limit = Math.min(BACKFILL_MAX_PRODUCTS, Math.max(1, opts.productLimit));

  let q = supabaseAdmin
    .from("products")
    .select("id, store_id, images")
    .not("images", "is", null)
    .order("id", { ascending: true })
    .limit(limit);

  if (opts.storeId) q = q.eq("store_id", opts.storeId);
  if (opts.afterId) q = q.gt("id", opts.afterId);

  const { data: fetched, error } = await q;
  if (error) {
    console.warn("[product-image-mirror] backfill query", error.message);
    return {
      ok: false,
      integrationEnabled: true,
      scanned: 0,
      touched: 0,
      skipped: 0,
      errors: 1,
      nextAfterId: null,
      hasMore: false,
    };
  }

  const batch = fetched || [];
  const windowLastId = batch.length ? batch[batch.length - 1].id : null;
  const hasMore = batch.length === limit;

  const rows = batch.filter((r) => Array.isArray(r.images) && r.images.length > 0);
  if (rows.length === 0) {
    return {
      ok: true,
      integrationEnabled: true,
      scanned: 0,
      touched: 0,
      skipped: 0,
      errors: 0,
      nextAfterId: windowLastId,
      hasMore,
    };
  }

  const pids = rows.map((r) => r.id);
  const { data: mirrors } = await supabaseAdmin
    .from("product_image_mirrors")
    .select("product_id, storage_key, status")
    .in("product_id", pids);

  const readyByProduct = new Map<string, Set<string>>();
  for (const m of mirrors || []) {
    if (m.status !== "ready") continue;
    const set = readyByProduct.get(m.product_id) ?? new Set();
    set.add(m.storage_key);
    readyByProduct.set(m.product_id, set);
  }

  const rowsToMirror: typeof rows = [];
  let skipped = 0;
  for (const p of rows) {
    const imgs = p.images as { src?: string }[];
    const neededKeys = new Set<string>();
    for (const im of imgs) {
      const src = im?.src;
      if (src && /^https?:\/\//i.test(src)) {
        neededKeys.add(productImageStorageKey(normalizeProductImageSrc(src)));
      }
    }
    if (neededKeys.size === 0) {
      skipped++;
      continue;
    }
    const ready = readyByProduct.get(p.id) ?? new Set();
    let missing = false;
    for (const k of neededKeys) {
      if (!ready.has(k)) {
        missing = true;
        break;
      }
    }
    if (!missing) {
      skipped++;
      continue;
    }
    rowsToMirror.push(p);
  }

  let touched = 0;
  let errors = 0;
  await mapPool(rowsToMirror, BACKFILL_PRODUCT_CONCURRENCY, async (p) => {
    try {
      await mirrorImagesForProductRow(p.store_id, p.id, p.images, "repair");
      touched++;
    } catch (e) {
      console.warn("[product-image-mirror] backfill product", p.id, e);
      errors++;
    }
  });

  return {
    ok: true,
    integrationEnabled: true,
    scanned: rows.length,
    touched,
    skipped,
    errors,
    nextAfterId: windowLastId,
    hasMore,
  };
}

export type MirrorBackfillTimeboxedResult = {
  completed: boolean;
  integrationEnabled: boolean;
  rounds: number;
  totalTouched: number;
  totalScanned: number;
  totalSkipped: number;
  totalErrors: number;
  nextAfterId: string | null;
  elapsedMs: number;
};

/**
 * Runs many backfill batches in one invocation until the catalog is done or `maxMs` elapses.
 * Use for on-demand "sync all images" and post–product-sync catch-up (never persist global backfill cursor).
 */
export async function runMirrorBackfillStoreTimeboxed(
  storeId: string,
  maxMs: number,
  opts?: { afterId?: string | null; productLimit?: number },
): Promise<MirrorBackfillTimeboxedResult> {
  const productLimit = opts?.productLimit ?? 100;
  const capMs = Math.max(5_000, maxMs);
  const start = Date.now();
  let afterId: string | null = opts?.afterId ?? null;
  let rounds = 0;
  let totalTouched = 0;
  let totalScanned = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let lastIntegration = true;

  while (Date.now() - start < capMs) {
    const b = await runMirrorBackfillBatch({ storeId, afterId, productLimit });
    lastIntegration = b.integrationEnabled;
    rounds++;
    totalTouched += b.touched;
    totalScanned += b.scanned;
    totalSkipped += b.skipped;
    totalErrors += b.errors;

    if (!b.integrationEnabled) {
      return {
        completed: false,
        integrationEnabled: false,
        rounds,
        totalTouched,
        totalScanned,
        totalSkipped,
        totalErrors,
        nextAfterId: afterId,
        elapsedMs: Date.now() - start,
      };
    }
    if (!b.ok) {
      return {
        completed: false,
        integrationEnabled: b.integrationEnabled,
        rounds,
        totalTouched,
        totalScanned,
        totalSkipped,
        totalErrors,
        nextAfterId: afterId,
        elapsedMs: Date.now() - start,
      };
    }
    if (!b.hasMore) {
      return {
        completed: true,
        integrationEnabled: true,
        rounds,
        totalTouched,
        totalScanned,
        totalSkipped,
        totalErrors,
        nextAfterId: null,
        elapsedMs: Date.now() - start,
      };
    }
    afterId = b.nextAfterId;
  }

  return {
    completed: false,
    integrationEnabled: lastIntegration,
    rounds,
    totalTouched,
    totalScanned,
    totalSkipped,
    totalErrors,
    nextAfterId: afterId,
    elapsedMs: Date.now() - start,
  };
}

export type MirrorProductImagesPipelineResult = {
  repair: { attempted: number; ok: number; failed: number };
  backfill: MirrorBackfillBatchResult;
  repairLimit: number;
  productLimit: number;
};

/**
 * One server invocation: drain pending/failed mirror rows, then advance the catalog backfill cursor.
 * Intended for Vercel Cron (no open browser) so mirroring is not dependent on the admin UI or products tab.
 */
export async function runMirrorProductImagesPipeline(opts?: {
  repairLimit?: number;
  productLimit?: number;
  persistBackfillCursor?: boolean;
}): Promise<MirrorProductImagesPipelineResult> {
  const rawRepair = process.env.CF_MIRROR_REPAIR_BATCH;
  const parsedRepair = rawRepair ? Number(rawRepair) : 50;
  const defaultRepair = Number.isFinite(parsedRepair) ? Math.min(250, Math.max(10, parsedRepair)) : 50;
  const repairLimit = opts?.repairLimit ?? defaultRepair;

  const rawBf = process.env.CF_BACKFILL_PRODUCT_BATCH;
  const parsedBf = rawBf ? Number(rawBf) : 30;
  const defaultBf = Number.isFinite(parsedBf) ? Math.min(BACKFILL_MAX_PRODUCTS, Math.max(1, parsedBf)) : 30;
  const productLimit = opts?.productLimit ?? defaultBf;

  const persist = opts?.persistBackfillCursor !== false;

  const repair = await repairPendingMirrorsBatch(repairLimit);

  const { data: row } = await supabaseAdmin
    .from("cloudflare_images_settings")
    .select("mirror_backfill_after_product_id")
    .eq("id", CLOUDFLARE_SETTINGS_SINGLETON_ID)
    .maybeSingle();

  const afterId = row?.mirror_backfill_after_product_id ?? null;

  const backfill = await runMirrorBackfillBatch({
    afterId,
    productLimit,
  });

  if (persist && backfill.ok && backfill.integrationEnabled) {
    await supabaseAdmin
      .from("cloudflare_images_settings")
      .update({
        mirror_backfill_after_product_id: backfill.hasMore ? backfill.nextAfterId : null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", CLOUDFLARE_SETTINGS_SINGLETON_ID);
  }

  return { repair, backfill, repairLimit, productLimit };
}
