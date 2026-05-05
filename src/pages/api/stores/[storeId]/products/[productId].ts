import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { Json } from "@/integrations/supabase/database.types";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";
import { WooApiError } from "@/lib/sync-error";
import { logActivity } from "@/lib/activity-log";
import { buildFieldDiffs, capFieldDiffs } from "@/lib/audit/diff-engine";
import { reconcileAttributeTerms } from "@/lib/woo-attribute-reconcile";
import { refreshTaxonomyCounts, extractTaxonomyIds } from "@/lib/refresh-taxonomy-counts";
import { waitUntil } from "@vercel/functions";

function toJson<T>(obj: T): Json {
  return JSON.parse(JSON.stringify(obj)) as Json;
}

function toNumeric(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

type ValidationIssue = { field: string; message: string };

function trimStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function pricePositive(s: unknown): boolean {
  const t = trimStr(s);
  if (!t) return false;
  const n = parseFloat(t);
  return !Number.isNaN(n) && n > 0;
}

async function checkSkuConflictUpdate(storeId: string, sku: string, excludeProductId: string): Promise<string | null> {
  const t = trimStr(sku);
  if (!t) return null;
  const { data: prods } = await supabaseAdmin
    .from("products")
    .select("id,name,sku")
    .eq("store_id", storeId)
    .eq("sku", t)
    .neq("id", excludeProductId)
    .limit(1);
  if (prods && prods.length > 0) return `SKU already used by product "${prods[0].name || t}"`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: vars } = await (supabaseAdmin as any)
    .from("product_variations")
    .select("id,sku,product_id")
    .eq("store_id", storeId)
    .eq("sku", t)
    .neq("product_id", excludeProductId)
    .limit(1);
  if (vars && vars.length > 0) return `SKU already used by a product variation`;
  return null;
}

function couplePayloadStock(payload: Record<string, unknown>): void {
  const qty = payload.stock_quantity;
  if (qty != null) {
    payload.manage_stock = true;
    const n = Number(qty);
    payload.stock_quantity = Number.isFinite(n) ? Math.max(0, n) : 0;
    if ((payload.stock_quantity as number) === 0) payload.stock_status = "outofstock";
    else if (payload.stock_status !== "onbackorder") payload.stock_status = "instock";
  }
  if (payload.manage_stock === false) {
    delete payload.stock_quantity;
    if (payload.stock_status !== "onbackorder") payload.stock_status = "instock";
  }
  if (typeof payload.stock_quantity === "number" && (payload.stock_quantity as number) < 0) {
    payload.stock_quantity = 0;
  }
}

async function validateUpdatePayload(
  storeId: string,
  productId: string,
  payload: Record<string, unknown>,
  variations: Array<Record<string, unknown>> | undefined,
  /** When the client omits `type` (partial PATCH-style bodies), use the stored product type so variable products are not validated as simple. */
  existingProduct?: { type?: string | null; status?: string | null } | null
): Promise<{ errors: ValidationIssue[] }> {
  const errors: ValidationIssue[] = [];
  const type = trimStr(payload.type) || trimStr(existingProduct?.type) || "simple";
  payload.type = type;
  if (payload.name !== undefined) payload.name = trimStr(payload.name);
  if (payload.sku !== undefined) payload.sku = trimStr(payload.sku);
  const existingStatus = trimStr(existingProduct?.status);
  const nextStatus =
    payload.status !== undefined && payload.status !== null && String(payload.status).length > 0
      ? trimStr(payload.status as string)
      : existingStatus;
  const publishing = nextStatus === "publish";

  if (publishing && payload.name !== undefined && !trimStr(payload.name)) {
    errors.push({ field: "name", message: "Product name is required to publish" });
  }

  if (type === "simple") {
    if (publishing && payload.regular_price !== undefined && !pricePositive(payload.regular_price)) {
      errors.push({ field: "regular_price", message: "Regular price must be greater than 0" });
    }
    if (publishing) {
      const reg = toNumeric(payload.regular_price);
      const sale = toNumeric(payload.sale_price);
      if (reg !== null && reg > 0 && sale !== null && sale > 0 && sale >= reg) {
        errors.push({ field: "sale_price", message: "Sale price must be less than regular price" });
      }
    }
    couplePayloadStock(payload);
  } else if (type === "variable") {
    delete payload.regular_price;
    delete payload.sale_price;
    delete payload.price;
    delete payload.stock_quantity;
    if (Array.isArray(variations)) {
      const parentAttrs = Array.isArray(payload.attributes) ? (payload.attributes as Record<string, unknown>[]) : [];
      const variationAttrs = parentAttrs.filter((a) => a.variation === true && Array.isArray(a.options));
      const parentNames = new Set(variationAttrs.map((a) => trimStr(a.name).toLowerCase()));
      const comboSeen = new Map<string, number>();
      variations.forEach((v, idx) => {
        const enabled = v.enabled !== false;
        if (publishing) {
          if (enabled && v.regular_price !== undefined && !pricePositive(v.regular_price)) {
            errors.push({ field: `variation[${idx}].regular_price`, message: `Variation ${idx + 1}: price required (> 0)` });
          }
          const vAttrs = Array.isArray(v.attributes) ? (v.attributes as Record<string, string>[]) : [];
          if (enabled && vAttrs.length === 0) {
            errors.push({ field: `variation[${idx}].attributes`, message: `Variation ${idx + 1}: must have at least one attribute` });
          }
          for (const va of vAttrs) {
            const name = trimStr(va.name);
            if (parentNames.size && !parentNames.has(name.toLowerCase())) {
              errors.push({ field: `variation[${idx}].attributes`, message: `Variation ${idx + 1}: attribute "${name}" not defined on parent` });
            }
          }
          const vAttrsForDup = Array.isArray(v.attributes) ? (v.attributes as Record<string, string>[]) : [];
          if (vAttrsForDup.length) {
            const key = [...vAttrsForDup].sort((a, b) => a.name.localeCompare(b.name)).map((a) => `${trimStr(a.name).toLowerCase()}:${trimStr(a.option).toLowerCase()}`).join("|");
            if (comboSeen.has(key)) {
              errors.push({ field: `variation[${idx}]`, message: `Variation ${idx + 1}: duplicate combination with variation ${comboSeen.get(key)! + 1}` });
            } else {
              comboSeen.set(key, idx);
            }
          }
        }
        if (v.manage_stock && typeof v.stock_quantity === "number" && (v.stock_quantity as number) < 0) {
          errors.push({ field: `variation[${idx}].stock_quantity`, message: `Variation ${idx + 1}: stock cannot be negative` });
        }
        if (publishing && enabled) {
          const reg = toNumeric(v.regular_price);
          const sale = toNumeric(v.sale_price);
          if (reg !== null && reg > 0 && sale !== null && sale > 0 && sale >= reg) {
            errors.push({
              field: `variation[${idx}].sale_price`,
              message: `Variation ${idx + 1}: sale price must be less than regular price`,
            });
          }
        }
      });
    }
  }

  if (publishing && Array.isArray(payload.images)) {
    for (const img of payload.images as Record<string, unknown>[]) {
      if (!img.id && !trimStr(img.src)) {
        errors.push({ field: "images", message: "Image requires a media ID or valid src URL" });
        break;
      }
    }
  }

  if (payload.sku) {
    const conflict = await checkSkuConflictUpdate(storeId, payload.sku as string, productId);
    if (conflict) errors.push({ field: "sku", message: conflict });
  }

  return { errors };
}

interface WooProduct {
  id: number;
  name: string;
  slug: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_quantity: number | null;
  stock_status: string;
  status: string;
  type: string;
  description: string;
  short_description: string;
  categories: unknown[];
  tags: unknown[];
  images: unknown[];
  attributes: unknown[];
  date_created: string;
  date_modified: string;
}

function diffFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: { field: string; old: unknown; new: unknown }[] = [];
  keys.forEach((k) => {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      changes.push({ field: k, old: before[k], new: after[k] });
    }
  });
  return changes;
}

function variationChanged(
  incoming: Record<string, unknown>,
  row: Record<string, unknown>
): boolean {
  const pairs: [unknown, unknown][] = [
    [incoming.regular_price || "", row.regular_price != null ? String(row.regular_price) : ""],
    [incoming.sale_price || "", row.sale_price != null ? String(row.sale_price) : ""],
    [incoming.sku || "", row.sku || ""],
    [!!incoming.manage_stock, !!row.manage_stock],
    [incoming.manage_stock ? incoming.stock_quantity : null, row.manage_stock ? row.stock_quantity : null],
    [incoming.stock_status || "instock", row.stock_status || "instock"],
    [incoming.weight || "", row.weight || ""],
    [JSON.stringify(incoming.dimensions || {}), JSON.stringify(row.dimensions || {})],
    [incoming.description || "", row.description || ""],
    [(incoming.image && (incoming.image as Record<string, unknown>).id) || null, (row.image && (row.image as Record<string, unknown>).id) || null],
  ];
  return pairs.some(([a, b]) => JSON.stringify(a) !== JSON.stringify(b));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "PUT" && req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { storeId, productId } = req.query;
  if (typeof storeId !== "string" || typeof productId !== "string") {
    return res.status(400).json({ error: "storeId and productId required" });
  }

  const { data: localProduct } = await supabaseAdmin
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("store_id", storeId)
    .single();

  if (!localProduct?.woo_id) {
    return res.status(404).json({ error: "Product not found" });
  }

  if (req.method === "GET") {
    return res.status(200).json(localProduct);
  }

  const beforeSnapshot = toJson(localProduct);

  if (req.method === "DELETE") {
    try {
      const store = await getStoreCreds(storeId);
      if (!store) throw new Error("Store not connected");
      const force = req.query.force !== "false";
      await wooRequest<WooProduct>(store, "DELETE", `products/${localProduct.woo_id}?force=${force}`);

      try {
        const { deleteMirrorsForProduct } = await import("@/lib/product-image-mirror.server");
        await deleteMirrorsForProduct(productId);
      } catch (e) {
        console.warn("[product delete] CF mirror cleanup:", e);
      }

      const { error: delErr } = await supabaseAdmin
        .from("products")
        .delete()
        .eq("id", productId)
        .eq("store_id", storeId);
      if (delErr) throw delErr;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      void (supabaseAdmin as any).from("entity_changes").insert({
        store_id: storeId,
        entity_type: "product",
        entity_id: productId,
        woo_id: localProduct.woo_id,
        entity_name: localProduct.name,
        change_type: "deleted",
        changed_fields: null,
        snapshot_before: beforeSnapshot,
        snapshot_after: null,
        source: "dashboard",
        status: "success",
      });

      void logActivity({
        action: "product.delete",
        entityType: "product",
        entityId: productId,
        before: localProduct as Record<string, unknown>,
        metadata: { module: "sites", woo_id: localProduct.woo_id, store_id: storeId },
        req,
      });

      return res.status(200).json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[product delete] error:", err);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any).from("entity_changes").insert({
        store_id: storeId,
        entity_type: "product",
        entity_id: productId,
        woo_id: localProduct.woo_id,
        entity_name: localProduct.name,
        change_type: "delete_failed",
        changed_fields: null,
        snapshot_before: beforeSnapshot,
        snapshot_after: null,
        source: "dashboard",
        status: "failed",
        error_message: message,
      });
      return res.status(500).json({ error: "Failed to delete product", message });
    }
  }

  const body = req.body || {};
  const {
    variations,
    deleted_variation_ids: deletedVariationIdsBody,
    ...rest
  } = body as Record<string, unknown> & {
    variations?: Array<Record<string, unknown>>;
    deleted_variation_ids?: unknown;
  };
  const wooPayload: Record<string, unknown> = { ...rest };

  const deletedVariationIds: number[] = Array.isArray(deletedVariationIdsBody)
    ? [...new Set(deletedVariationIdsBody.filter((id): id is number => typeof id === "number" && id > 0))]
    : [];

  try {
    const store = await getStoreCreds(storeId);
    if (!store) throw new Error("Store not connected");

    const validation = await validateUpdatePayload(storeId, productId, wooPayload, variations, localProduct);
    if (validation.errors.length > 0) {
      return res.status(400).json({ error: "Validation failed", errors: validation.errors });
    }

    if (Array.isArray(wooPayload.attributes) && Array.isArray(variations) && variations.length > 0) {
      try {
        const defaultAttrs = Array.isArray(wooPayload.default_attributes)
          ? (wooPayload.default_attributes as Array<{ id?: number; name: string; option: string }>)
          : undefined;
        const reconciled = await reconcileAttributeTerms(
          store,
          wooPayload.attributes as Array<{ id?: number; name: string; options?: string[]; variation?: boolean }>,
          variations as Array<{ attributes?: { id?: number; name: string; option: string }[] }>,
          defaultAttrs,
        );
        wooPayload.attributes = reconciled.parentAttributes as unknown as Json;
        if (reconciled.defaultAttributes !== undefined) {
          wooPayload.default_attributes = reconciled.defaultAttributes;
        }
        for (let i = 0; i < variations.length; i++) {
          variations[i] = { ...variations[i], attributes: reconciled.variations[i].attributes as unknown as Record<string, unknown>[] };
        }
      } catch (e) {
        console.error("[product-update][attr-reconcile]", e);
      }
    }

    const updated = await wooRequest<WooProduct>(
      store,
      "PUT",
      `products/${localProduct.woo_id}`,
      wooPayload
    );

    if (updated.type === "variable" && (Array.isArray(variations) || deletedVariationIds.length > 0)) {
      const variationRows = Array.isArray(variations) ? variations : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingRows } = await (supabaseAdmin as any)
        .from("product_variations")
        .select("*")
        .eq("store_id", storeId)
        .eq("product_id", productId);
      const byWooId = new Map<number, Record<string, unknown>>();
      (existingRows || []).forEach((r: Record<string, unknown>) => byWooId.set(r.woo_id as number, r));

      const toCreate: Record<string, unknown>[] = [];
      const toUpdate: Record<string, unknown>[] = [];
      // Map of woo_id (or temp index for create) -> user-submitted gallery (with src)
      const userGalleryByWooId = new Map<number, Array<{ id: number; src: string; alt?: string }>>();
      const userGalleryByCreateIdx: Array<Array<{ id: number; src: string; alt?: string }>> = [];

      for (const v of variationRows) {
        const img = v.image && ((v.image as Record<string, unknown>).id || (v.image as Record<string, unknown>).src)
          ? { image: (v.image as Record<string, unknown>).id ? { id: (v.image as Record<string, unknown>).id } : { src: (v.image as Record<string, unknown>).src, alt: (v.image as Record<string, unknown>).alt || "" } }
          : {};

        const userGallery = Array.isArray(v.gallery)
          ? (v.gallery as Array<{ id: number; src: string; alt?: string }>).filter((g) => g && typeof g.id === "number" && g.id > 0)
          : [];
        const galleryMetaForWoo = userGallery.length > 0
          ? { meta_data: [{ key: "_wc_additional_variation_images", value: userGallery.map((g) => g.id) }] }
          : { meta_data: [{ key: "_wc_additional_variation_images", value: [] }] };

        if (!v.id) {
          // Defensive: never create variations with empty attributes (would dupe as broken rows)
          const vAttrs = Array.isArray(v.attributes) ? (v.attributes as Record<string, unknown>[]) : [];
          if (vAttrs.length === 0) {
            console.warn("[variations-batch-update] skipping create with empty attributes");
            continue;
          }
          userGalleryByCreateIdx.push(userGallery);
          toCreate.push({
            regular_price: (v.regular_price as string) || "",
            sale_price: (v.sale_price as string) || "",
            sku: (v.sku as string) || "",
            manage_stock: !!v.manage_stock,
            stock_quantity: v.manage_stock ? v.stock_quantity : undefined,
            stock_status: (v.stock_status as string) || "instock",
            weight: (v.weight as string) || "",
            dimensions: v.dimensions || { length: "", width: "", height: "" },
            description: (v.description as string) || "",
            attributes: v.attributes || [],
            ...img,
            ...galleryMetaForWoo,
          });
          continue;
        }
        const existing = byWooId.get(v.id as number);
        userGalleryByWooId.set(v.id as number, userGallery);
        if (existing && !variationChanged(v, existing)) {
          // Still update gallery if user changed it
          const existingGallery = Array.isArray(existing.gallery) ? (existing.gallery as Array<{ id: number }>) : [];
          const sameGallery =
            existingGallery.length === userGallery.length &&
            existingGallery.every((g, i) => g.id === userGallery[i]?.id);
          if (sameGallery) continue;
        }
        toUpdate.push({
          id: v.id,
          regular_price: (v.regular_price as string) || "",
          sale_price: (v.sale_price as string) || "",
          sku: (v.sku as string) || "",
          manage_stock: !!v.manage_stock,
          stock_quantity: v.manage_stock ? v.stock_quantity : undefined,
          stock_status: (v.stock_status as string) || "instock",
          weight: (v.weight as string) || "",
          dimensions: v.dimensions || { length: "", width: "", height: "" },
          description: (v.description as string) || "",
          ...img,
          ...galleryMetaForWoo,
        });
      }

      const batch: Record<string, unknown> = {};
      if (deletedVariationIds.length) batch.delete = deletedVariationIds;
      if (toCreate.length) batch.create = toCreate;
      if (toUpdate.length) batch.update = toUpdate;

      if (toCreate.length || toUpdate.length || deletedVariationIds.length) {
        try {
          type BatchResp = {
            create?: Array<Record<string, unknown>>;
            update?: Array<Record<string, unknown>>;
            delete?: Array<{ id?: number }>;
          };
          const resp = await wooRequest<BatchResp>(store, "POST", `products/${localProduct.woo_id}/variations/batch`, batch);
          const now = new Date().toISOString();
          const toUpsert: Record<string, unknown>[] = [];
          const process = (arr: Array<Record<string, unknown>> | undefined, kind: "create" | "update") => {
            (arr || []).forEach((v, idx) => {
              const galleryMeta = Array.isArray(v.meta_data)
                ? (v.meta_data as { key: string; value: unknown }[]).find((m) => m.key === "_wc_additional_variation_images")
                : undefined;
              const galleryIds = Array.isArray(galleryMeta?.value) ? (galleryMeta!.value as number[]) : [];
              // Prefer user-submitted gallery (has src) when IDs match
              const userGallery = kind === "create"
                ? (userGalleryByCreateIdx[idx] || [])
                : (userGalleryByWooId.get(v.id as number) || []);
              const userById = new Map(userGallery.map((g) => [g.id, g]));
              const finalGallery = galleryIds.map((id) => {
                const u = userById.get(id);
                return u ? { id: u.id, src: u.src || "", alt: u.alt || "" } : { id, src: "" };
              });
              toUpsert.push({
                store_id: storeId,
                product_id: productId,
                woo_parent_id: localProduct.woo_id,
                woo_id: v.id as number,
                sku: (v.sku as string) || null,
                regular_price: toNumeric(v.regular_price),
                sale_price: toNumeric(v.sale_price),
                price: toNumeric(v.price),
                stock_quantity: (v.stock_quantity as number) ?? null,
                stock_status: (v.stock_status as string) || null,
                manage_stock: !!v.manage_stock,
                status: (v.status as string) || "publish",
                virtual: !!v.virtual,
                downloadable: !!v.downloadable,
                tax_class: (v.tax_class as string) || null,
                weight: (v.weight as string) || null,
                dimensions: toJson(v.dimensions || {}),
                description: (v.description as string) || null,
                attributes: toJson(v.attributes || []),
                image: v.image ? toJson(v.image) : null,
                gallery: toJson(finalGallery),
                menu_order: (v.menu_order as number) || 0,
                raw_data: toJson(v),
                synced_at: now,
              });
            });
          };
          process(resp.create, "create");
          process(resp.update, "update");
          if (toUpsert.length) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabaseAdmin as any)
              .from("product_variations")
              .upsert(toUpsert, { onConflict: "store_id,woo_id", ignoreDuplicates: false });
          }
          if (deletedVariationIds.length) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabaseAdmin as any)
              .from("product_variations")
              .delete()
              .eq("store_id", storeId)
              .eq("product_id", productId)
              .in("woo_id", deletedVariationIds);
          }
        } catch (ve) {
          console.error("[variations-batch-update]", ve);
        }
      }
    }

    const now = new Date().toISOString();
    const updatePayload = {
      name: updated.name,
      slug: updated.slug,
      sku: updated.sku || null,
      price: toNumeric(updated.price),
      regular_price: toNumeric(updated.regular_price),
      sale_price: toNumeric(updated.sale_price),
      manage_stock: (updated as unknown as { manage_stock?: boolean }).manage_stock ?? null,
      stock_quantity: updated.stock_quantity,
      stock_status: updated.stock_status,
      status: updated.status,
      type: updated.type,
      description: updated.description,
      short_description: updated.short_description,
      tax_status: (updated as unknown as { tax_status?: string }).tax_status ?? null,
      tax_class: (updated as unknown as { tax_class?: string }).tax_class ?? null,
      sold_individually: (updated as unknown as { sold_individually?: boolean }).sold_individually ?? null,
      virtual: (updated as unknown as { virtual?: boolean }).virtual ?? null,
      downloadable: (updated as unknown as { downloadable?: boolean }).downloadable ?? null,
      categories: toJson(updated.categories),
      tags: toJson(updated.tags || []),
      brands: toJson((updated as unknown as { brands?: unknown[] }).brands || []),
      images: toJson(updated.images),
      attributes: toJson(updated.attributes || []),
      raw_data: toJson(updated),
      synced_at: now,
    };

    const { data: saved, error: saveErr } = await supabaseAdmin
      .from("products")
      .update(updatePayload)
      .eq("id", productId)
      .select("*")
      .single();
    if (saveErr) throw saveErr;

    const afterSnapshot = toJson(saved);
    const changedFields = diffFields(
      localProduct as Record<string, unknown>,
      saved as Record<string, unknown>
    );

    // Fire-and-forget entity_changes log (don't block response)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabaseAdmin as any).from("entity_changes").insert({
      store_id: storeId,
      entity_type: "product",
      entity_id: productId,
      woo_id: localProduct.woo_id,
      entity_name: updated.name,
      change_type: "updated",
      changed_fields: changedFields as unknown as Json,
      snapshot_before: beforeSnapshot,
      snapshot_after: afterSnapshot,
      source: "dashboard",
      status: "success",
    });

    void logActivity({
      action: "product.update",
      entityType: "product",
      entityId: productId,
      before: localProduct as Record<string, unknown>,
      after: saved as Record<string, unknown>,
      fieldDiffs: capFieldDiffs(
        buildFieldDiffs(localProduct as Record<string, unknown>, saved as Record<string, unknown>)
      ),
      metadata: { module: "sites", woo_id: localProduct.woo_id, store_id: storeId },
      req,
    });

    {
      const beforeBrands = extractTaxonomyIds((localProduct as { brands?: unknown }).brands);
      const beforeCats = extractTaxonomyIds((localProduct as { categories?: unknown }).categories);
      const beforeTags = extractTaxonomyIds((localProduct as { tags?: unknown }).tags);
      const afterBrands = extractTaxonomyIds((updated as unknown as { brands?: unknown[] }).brands);
      const afterCats = extractTaxonomyIds(updated.categories);
      const afterTags = extractTaxonomyIds(updated.tags || []);
      const allBrands = Array.from(new Set([...beforeBrands, ...afterBrands]));
      const allCats = Array.from(new Set([...beforeCats, ...afterCats]));
      const allTags = Array.from(new Set([...beforeTags, ...afterTags]));
      void Promise.all([
        refreshTaxonomyCounts(store, storeId, "categories", allCats),
        refreshTaxonomyCounts(store, storeId, "tags", allTags),
        refreshTaxonomyCounts(store, storeId, "brands", allBrands),
      ]);
    }

    waitUntil(
      (async () => {
        try {
          const { mirrorImagesForProductRow } = await import("@/lib/product-image-mirror.server");
          await mirrorImagesForProductRow(storeId, productId, saved.images, "save");
        } catch (e) {
          console.warn("[product-update] image mirror:", e);
        }
      })()
    );

    return res.status(200).json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const wooContext = err instanceof WooApiError ? err.context : undefined;
    console.error("[product update] error:", err);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any).from("entity_changes").insert({
      store_id: storeId,
      entity_type: "product",
      entity_id: productId,
      woo_id: localProduct.woo_id,
      entity_name: localProduct.name,
      change_type: "update_failed",
      changed_fields: null,
      snapshot_before: beforeSnapshot,
      snapshot_after: null,
      source: "dashboard",
      status: "failed",
      error_message: message,
      retry_payload: toJson(wooPayload),
    });

    return res.status(wooContext?.status && wooContext.status >= 400 && wooContext.status < 500 ? wooContext.status : 500).json({
      error: "Failed to update product",
      message,
      woo_status: wooContext?.status,
      woo_body: wooContext?.body,
      blocking_service: wooContext?.blocking_service,
      blocking_hint: wooContext?.blocking_hint,
    });
  }
}