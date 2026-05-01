import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";
import { WooApiError } from "@/lib/sync-error";
import type { Json } from "@/integrations/supabase/database.types";
import { logActivity } from "@/lib/activity-log";
import { quotaErrorPayload } from "@/lib/quota";
import { canAddProductServer } from "@/lib/quota.server";
import { reconcileAttributeTerms } from "@/lib/woo-attribute-reconcile";
import { refreshTaxonomyCounts, extractTaxonomyIds } from "@/lib/refresh-taxonomy-counts";
import { waitUntil } from "@vercel/functions";

type WooVariationInput = {
  id?: number;
  regular_price?: string;
  sale_price?: string;
  sku?: string;
  stock_quantity?: number | null;
  stock_status?: string;
  manage_stock?: boolean;
  weight?: string;
  dimensions?: { length: string; width: string; height: string };
  description?: string;
  image?: { id?: number; src?: string; alt?: string } | null;
  attributes: { name: string; option: string }[];
};

type ValidationIssue = { field: string; message: string };

function trim(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
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

function priceIsPositive(s: unknown): boolean {
  const n = toNumeric(s);
  return n !== null && n > 0;
}

async function checkSkuConflict(storeId: string, sku: string): Promise<string | null> {
  const t = trim(sku);
  if (!t) return null;
  const { data: prods } = await supabaseAdmin
    .from("products")
    .select("id,name,sku")
    .eq("store_id", storeId)
    .eq("sku", t)
    .limit(1);
  if (prods && prods.length > 0) return `SKU already used by product "${prods[0].name || t}"`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: vars } = await (supabaseAdmin as any)
    .from("product_variations")
    .select("id,sku")
    .eq("store_id", storeId)
    .eq("sku", t)
    .limit(1);
  if (vars && vars.length > 0) return `SKU already used by a product variation`;
  return null;
}

function normalizeStockFields(payload: Record<string, unknown>): void {
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

async function validateCreatePayload(
  storeId: string,
  payload: Record<string, unknown>,
  variations: WooVariationInput[]
): Promise<{ errors: ValidationIssue[] }> {
  const errors: ValidationIssue[] = [];
  const type = trim(payload.type) || "simple";
  payload.type = type;

  payload.name = trim(payload.name);
  if (!payload.name) errors.push({ field: "name", message: "Product name is required" });

  payload.sku = trim(payload.sku);

  const publishing = (payload.status as string) === "publish" || !payload.status;

  if (type === "simple") {
    if (publishing && !priceIsPositive(payload.regular_price)) {
      errors.push({ field: "regular_price", message: "Regular price is required and must be greater than 0" });
    }
    normalizeStockFields(payload);
  } else if (type === "variable") {
    delete payload.regular_price;
    delete payload.sale_price;
    delete payload.price;
    delete payload.stock_quantity;
    const parentAttrs = Array.isArray(payload.attributes) ? payload.attributes as Record<string, unknown>[] : [];
    const variationAttrs = parentAttrs.filter((a) => a.variation === true && Array.isArray(a.options) && (a.options as unknown[]).length > 0);
    if (variationAttrs.length === 0) {
      errors.push({ field: "attributes", message: "Variable product needs at least one attribute marked for variations" });
    }
    if (variations.length === 0) {
      errors.push({ field: "variations", message: "Variable product needs at least one variation" });
    }
    const parentNames = new Set(variationAttrs.map((a) => trim(a.name).toLowerCase()));
    const comboSeen = new Map<string, number>();
    variations.forEach((v, idx) => {
      if (!priceIsPositive(v.regular_price)) {
        errors.push({ field: `variation[${idx}].regular_price`, message: `Variation ${idx + 1}: price required (> 0)` });
      }
      if (!v.attributes || v.attributes.length === 0) {
        errors.push({ field: `variation[${idx}].attributes`, message: `Variation ${idx + 1}: must have at least one attribute` });
      } else {
        v.attributes = v.attributes.map((va) => ({ name: trim(va.name), option: trim(va.option) }));
        for (const va of v.attributes) {
          if (!parentNames.has(va.name.toLowerCase())) {
            errors.push({ field: `variation[${idx}].attributes`, message: `Variation ${idx + 1}: attribute "${va.name}" not defined on parent` });
          }
        }
        const key = [...v.attributes].sort((a, b) => a.name.localeCompare(b.name)).map((a) => `${a.name.toLowerCase()}:${a.option.toLowerCase()}`).join("|");
        if (comboSeen.has(key)) {
          errors.push({ field: `variation[${idx}]`, message: `Variation ${idx + 1}: duplicate attribute combination with variation ${comboSeen.get(key)! + 1}` });
        } else {
          comboSeen.set(key, idx);
        }
      }
      if (v.manage_stock && v.stock_quantity != null && v.stock_quantity < 0) {
        errors.push({ field: `variation[${idx}].stock_quantity`, message: `Variation ${idx + 1}: stock cannot be negative` });
      }
    });
  } else {
    errors.push({ field: "type", message: `Unsupported product type: ${type}` });
  }

  if (Array.isArray(payload.images)) {
    for (const img of payload.images as Record<string, unknown>[]) {
      if (!img.id && !trim(img.src)) {
        errors.push({ field: "images", message: "Image requires a media ID or valid src URL" });
        break;
      }
    }
  }

  if (payload.sku) {
    const conflict = await checkSkuConflict(storeId, payload.sku as string);
    if (conflict) errors.push({ field: "sku", message: conflict });
  }

  return { errors };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const storeId = Array.isArray(req.query.storeId) ? req.query.storeId[0] : req.query.storeId;
  if (!storeId) return res.status(400).json({ error: "Missing storeId" });

  try {
    const creds = await getStoreCreds(storeId);
    if (!creds) return res.status(400).json({ error: "Store credentials missing" });

    const { data: storeRow } = await supabaseAdmin.from("stores").select("client_id").eq("id", storeId).maybeSingle();
    if (storeRow?.client_id) {
      const quota = await canAddProductServer(storeRow.client_id, storeId);
      if (!quota.ok) {
        return res.status(402).json(quotaErrorPayload("product", quota));
      }
    }

    const body = req.body || {};
    const variations: WooVariationInput[] = Array.isArray(body.variations) ? body.variations : [];
    const parentPayload = { ...body };
    delete parentPayload.variations;


    const validation = await validateCreatePayload(storeId, parentPayload, variations);
    if (validation.errors.length > 0) {
      return res.status(400).json({ error: "Validation failed", errors: validation.errors });
    }

    if (Array.isArray(parentPayload.attributes) && variations.length > 0) {
      try {
        const reconciled = await reconcileAttributeTerms(
          creds,
          parentPayload.attributes as Array<{ id?: number; name: string; options?: string[]; variation?: boolean }>,
          variations as unknown as Array<{ attributes?: { id?: number; name: string; option: string }[] }>
        );
        parentPayload.attributes = reconciled.parentAttributes as unknown as Json;
        for (let i = 0; i < variations.length; i++) {
          variations[i] = { ...variations[i], attributes: reconciled.variations[i].attributes as { name: string; option: string }[] };
        }
      } catch (e) {
        console.error("[product-create][attr-reconcile]", e);
      }
    }

    const created = await wooRequest<Record<string, unknown>>(creds, "POST", "products", parentPayload);
    const wooId = created.id as number;

    if (variations.length > 0 && created.type === "variable") {
      const userGalleryByCreateIdx: Array<Array<{ id: number; src: string; alt?: string }>> = [];
      const createPayload = variations.map((v) => {
        const img = v.image && (v.image.id || v.image.src) ? { image: v.image.id ? { id: v.image.id } : { src: v.image.src!, alt: v.image.alt || "" } } : {};
        const userGallery = Array.isArray((v as unknown as { gallery?: unknown[] }).gallery)
          ? ((v as unknown as { gallery?: Array<{ id?: number; src?: string; alt?: string }> }).gallery || [])
              .filter((g) => typeof g?.id === "number" && g.id > 0)
              .map((g) => ({ id: g.id as number, src: g.src || "", alt: g.alt || "" }))
          : [];
        const galleryMetaForWoo = userGallery.length > 0
          ? { meta_data: [{ key: "_wc_additional_variation_images", value: userGallery.map((g) => g.id) }] }
          : { meta_data: [{ key: "_wc_additional_variation_images", value: [] }] };
        userGalleryByCreateIdx.push(userGallery);
        return {
          regular_price: v.regular_price || "",
          sale_price: v.sale_price || "",
          sku: v.sku || "",
          manage_stock: !!v.manage_stock,
          stock_quantity: v.manage_stock ? v.stock_quantity : undefined,
          stock_status: v.stock_status || "instock",
          weight: v.weight || "",
          dimensions: v.dimensions || { length: "", width: "", height: "" },
          description: v.description || "",
          attributes: v.attributes,
          ...img,
          ...galleryMetaForWoo,
        };
      });
      try {
        type WooVarBatch = { create?: Array<Record<string, unknown>> };
        console.log("[woo-variations-create] payload:", JSON.stringify({
          wooId,
          parentAttributes: parentPayload.attributes,
          variationCount: createPayload.length,
          createPayload,
        }, null, 2));
        const batchRes = await wooRequest<WooVarBatch>(
          creds,
          "POST",
          `products/${wooId}/variations/batch`,
          { create: createPayload }
        );
        console.log("[woo-variations-response]", JSON.stringify({
          wooId,
          createdCount: Array.isArray(batchRes?.create) ? batchRes.create.length : 0,
          firstAttributes: Array.isArray(batchRes?.create) && batchRes.create[0]
            ? (batchRes.create[0] as Record<string, unknown>).attributes
            : null,
        }, null, 2));
        const createdVars = Array.isArray(batchRes?.create) ? batchRes.create : [];
        if (createdVars.length > 0) {
          const now = new Date().toISOString();
          // Insert parent first so variations have a parent_id to reference
          const parentInsertRow = buildProductInsertRow(storeId, created);
          const { data: parentInserted, error: parentErr } = await supabaseAdmin
            .from("products")
            .upsert(parentInsertRow as never, { onConflict: "store_id,woo_id" })
            .select("id")
            .single();
          if (parentErr) throw new Error(`DB upsert (parent) failed: ${parentErr.message} [code=${parentErr.code}] [details=${parentErr.details}]`);
          const parentId = parentInserted!.id;

          const varRows = createdVars.map((v, idx) => {
            const galleryMeta = Array.isArray((v as Record<string, unknown>).meta_data)
              ? ((v as Record<string, unknown>).meta_data as { key: string; value: unknown }[]).find((m) => m.key === "_wc_additional_variation_images")
              : undefined;
            const galleryIds = Array.isArray(galleryMeta?.value) ? (galleryMeta!.value as number[]) : [];
            const userGallery = userGalleryByCreateIdx[idx] || [];
            const userById = new Map(userGallery.map((g) => [g.id, g]));
            const finalGallery = galleryIds.map((id) => {
              const u = userById.get(id);
              return u ? { id: u.id, src: u.src || "", alt: u.alt || "" } : { id, src: "" };
            });
            return {
            store_id: storeId,
            product_id: parentId,
            woo_parent_id: wooId,
            woo_id: v.id as number,
            sku: (v.sku as string) || null,
            regular_price: toNumeric(v.regular_price),
            sale_price: toNumeric(v.sale_price),
            price: toNumeric(v.price),
            stock_quantity: (v.stock_quantity as number | null) ?? null,
            stock_status: (v.stock_status as string) || null,
            manage_stock: !!v.manage_stock,
            status: (v.status as string) || "publish",
            virtual: !!v.virtual,
            downloadable: !!v.downloadable,
            tax_class: (v.tax_class as string) || null,
            weight: (v.weight as string) || null,
            dimensions: JSON.parse(JSON.stringify((v.dimensions as object) || {})) as Json,
            description: (v.description as string) || null,
            attributes: JSON.parse(JSON.stringify(v.attributes || [])) as Json,
            image: v.image ? (JSON.parse(JSON.stringify(v.image)) as Json) : null,
            gallery: JSON.parse(JSON.stringify(finalGallery)) as Json,
            menu_order: (v.menu_order as number) || 0,
            raw_data: JSON.parse(JSON.stringify(v)) as Json,
            synced_at: now,
          };
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: varErr } = await (supabaseAdmin as any)
            .from("product_variations")
            .upsert(varRows, { onConflict: "store_id,woo_id" });
          if (varErr) {
            console.error("[product-create][variations-upsert]", varErr);
          }

          const { data: finalRow } = await supabaseAdmin
            .from("products")
            .select("*")
            .eq("id", parentId)
            .single();

          void logActivity({
            action: "product.create",
            entityType: "product",
            entityId: parentId,
            after: (finalRow ?? parentInsertRow) as Record<string, unknown>,
            metadata: { module: "sites", woo_id: wooId, store_id: storeId, type: "variable" },
            req,
          });

          const outRow = finalRow ?? parentInsertRow;
          waitUntil(
            (async () => {
              try {
                const { mirrorImagesForProductRow } = await import("@/lib/product-image-mirror.server");
                await mirrorImagesForProductRow(storeId, parentId, outRow.images, "save");
              } catch (e) {
                console.warn("[product-create] image mirror:", e);
              }
            })()
          );

          return res.status(200).json(outRow);
        }
      } catch (ve) {
        console.error("[product-create][variations-batch]", ve);
        const message = ve instanceof Error ? ve.message : "Variation batch failed";
        return res.status(500).json({ error: "Failed to create variations", message });
      }
    }

    const insertRow = buildProductInsertRow(storeId, created);
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("products")
      .upsert(insertRow as never, { onConflict: "store_id,woo_id" })
      .select("*")
      .single();

    if (insertErr) {
      console.error("[product-create][db-upsert]", insertErr);
      return res.status(500).json({
        error: "Product created in WooCommerce but failed to save locally",
        message: insertErr.message,
        code: insertErr.code,
        details: insertErr.details,
        woo_id: wooId,
      });
    }

    void logActivity({
      action: "product.create",
      entityType: "product",
      entityId: inserted.id,
      after: inserted as Record<string, unknown>,
      metadata: { module: "sites", woo_id: wooId, store_id: storeId },
      req,
    });

    void Promise.all([
      refreshTaxonomyCounts(creds, storeId, "categories", extractTaxonomyIds(created.categories)),
      refreshTaxonomyCounts(creds, storeId, "tags", extractTaxonomyIds(created.tags)),
      refreshTaxonomyCounts(creds, storeId, "brands", extractTaxonomyIds((created as Record<string, unknown>).brands)),
    ]);

    waitUntil(
      (async () => {
        try {
          const { mirrorImagesForProductRow } = await import("@/lib/product-image-mirror.server");
          await mirrorImagesForProductRow(storeId, inserted.id, inserted.images, "save");
        } catch (e) {
          console.warn("[product-create] image mirror:", e);
        }
      })()
    );

    return res.status(200).json(inserted);
  } catch (e) {
    console.error("[product-create]", e);
    const message = e instanceof Error ? e.message : "Create failed";
    const ctx = e instanceof WooApiError ? e.context : undefined;
    return res.status(ctx?.status && ctx.status >= 400 && ctx.status < 500 ? ctx.status : 500).json({
      error: "Failed to create product",
      message,
      woo_status: ctx?.status,
      woo_body: ctx?.body,
      blocking_service: ctx?.blocking_service,
      blocking_hint: ctx?.blocking_hint,
    });
  }
}

function buildProductInsertRow(storeId: string, created: Record<string, unknown>) {
  return {
    store_id: storeId,
    woo_id: created.id as number,
    name: (created.name as string) ?? null,
    slug: (created.slug as string) ?? null,
    sku: (created.sku as string) ?? null,
    price: toNumeric(created.price),
    regular_price: toNumeric(created.regular_price),
    sale_price: toNumeric(created.sale_price),
    manage_stock: (created.manage_stock as boolean | null) ?? null,
    stock_quantity: (created.stock_quantity as number) ?? null,
    stock_status: (created.stock_status as string) ?? null,
    status: (created.status as string) ?? null,
    type: (created.type as string) ?? null,
    description: (created.description as string) ?? null,
    short_description: (created.short_description as string) ?? null,
    tax_status: (created.tax_status as string) ?? null,
    tax_class: (created.tax_class as string) ?? null,
    sold_individually: (created.sold_individually as boolean | null) ?? null,
    virtual: (created.virtual as boolean | null) ?? null,
    downloadable: (created.downloadable as boolean | null) ?? null,
    categories: (created.categories ?? []) as Json,
    tags: (created.tags ?? []) as Json,
    brands: (created.brands ?? []) as Json,
    images: (created.images ?? []) as Json,
    attributes: (created.attributes ?? []) as Json,
    raw_data: created as Json,
    synced_at: new Date().toISOString(),
  };
}