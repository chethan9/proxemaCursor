/**
 * Orchestrates mirroring Woo product image URLs to Cloudflare Images and denormalized URLs on products.
 */

import { supabaseAdmin } from "@/integrations/supabase/admin";
import {
  buildDeliveryUrls,
  deleteCloudflareImage,
  isCloudflareImagesConfigured,
  uploadImageFromUrl,
} from "@/lib/cloudflare-images.server";
import {
  normalizeProductImageSrc,
  productImageStorageKey,
  type ProductImageMirrorUrlsMap,
  type ProductMirrorUrlsEntry,
} from "@/lib/product-image-urls";

const MIRROR_CONCURRENCY = 3;

function logCfMirrorMetric(payload: Record<string, unknown>) {
  if (process.env.CLOUDFLARE_IMAGE_MIRROR_METRICS !== "true") return;
  console.log(JSON.stringify({ source: "cf_product_images", ts: new Date().toISOString(), ...payload }));
}

export function isProductImageMirroringEnabled(): boolean {
  return isCloudflareImagesConfigured();
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
  if (!isProductImageMirroringEnabled()) return;
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
    const urls = buildDeliveryUrls(cfId);
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
    logCfMirrorMetric({
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
    logCfMirrorMetric({
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
  const urls = buildDeliveryUrls(cfId);
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
  logCfMirrorMetric({
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
  if (!isProductImageMirroringEnabled()) return;
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
  if (!isProductImageMirroringEnabled()) return;
  for (const row of rows) {
    await mirrorImagesForProductRow(storeId, row.id, row.images, sourceKind);
  }
}

/** After removing mirror rows for a product, delete CF assets no longer referenced. */
export async function deleteMirrorsForProduct(productId: string): Promise<void> {
  if (!isCloudflareImagesConfigured()) return;
  const { data: rows } = await supabaseAdmin.from("product_image_mirrors").select("cf_image_id").eq("product_id", productId);
  const cfIds = [...new Set((rows || []).map((r) => r.cf_image_id).filter(Boolean) as string[])];
  await supabaseAdmin.from("product_image_mirrors").delete().eq("product_id", productId);
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
  if (!isCloudflareImagesConfigured()) return;
  const { data: rows } = await supabaseAdmin
    .from("product_image_mirrors")
    .select("cf_image_id")
    .eq("store_id", storeId)
    .not("cf_image_id", "is", null);
  const cfIds = [...new Set((rows || []).map((r) => r.cf_image_id).filter(Boolean) as string[])];
  await supabaseAdmin.from("product_image_mirrors").delete().eq("store_id", storeId);
  for (const id of cfIds) {
    await deleteCloudflareImage(id);
  }
}

export async function repairPendingMirrorsBatch(limit: number): Promise<{
  attempted: number;
  ok: number;
  failed: number;
}> {
  if (!isProductImageMirroringEnabled()) return { attempted: 0, ok: 0, failed: 0 };
  const { data: pending } = await supabaseAdmin
    .from("product_image_mirrors")
    .select("store_id, product_id, src_normalized, storage_key")
    .in("status", ["pending", "failed"])
    .limit(limit);

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
