import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";
import type { Json } from "@/integrations/supabase/database.types";
import { logActivity } from "@/lib/activity-log";
import { quotaErrorPayload } from "@/lib/quota";
import { canAddProductServer } from "@/lib/quota.server";

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

function priceIsPositive(s: unknown): boolean {
  const t = trim(s);
  if (!t) return false;
  const n = parseFloat(t);
  return !Number.isNaN(n) && n > 0;
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
): Promise<{ ok: true } | { ok: false; errors: ValidationIssue[] }> {
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
    // Strip parent price — rule: variable parent must not carry price
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
    const skuSeen = new Set<string>();
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
      const vsku = trim(v.sku);
      if (vsku) {
        const k = vsku.toLowerCase();
        if (skuSeen.has(k)) errors.push({ field: `variation[${idx}].sku`, message: `Variation ${idx + 1}: duplicate SKU within product` });
        else skuSeen.add(k);
      }
    });
  } else {
    errors.push({ field: "type", message: `Unsupported product type: ${type}` });
  }

  // Image validation
  if (Array.isArray(payload.images)) {
    for (const img of payload.images as Record<string, unknown>[]) {
      if (!img.id && !trim(img.src)) {
        errors.push({ field: "images", message: "Image requires a media ID or valid src URL" });
        break;
      }
    }
  }

  // Server-side SKU uniqueness (parent)
  if (payload.sku) {
    const conflict = await checkSkuConflict(storeId, payload.sku as string);
    if (conflict) errors.push({ field: "sku", message: conflict });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
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
    if (!validation.ok) {
      return res.status(400).json({ error: "Validation failed", errors: validation.errors });
    }

    const created = await wooRequest<Record<string, unknown>>(creds, "POST", "products", parentPayload);
    const wooId = created.id as number;

    if (variations.length > 0 && created.type === "variable") {
      const createPayload = variations.map((v) => {
        const img = v.image && (v.image.id || v.image.src) ? { image: v.image.id ? { id: v.image.id } : { src: v.image.src!, alt: v.image.alt || "" } } : {};
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
        };
      });
      try {
        type WooVarBatch = { create?: Array<Record<string, unknown>> };
        const batchRes = await wooRequest<WooVarBatch>(
          creds,
          "POST",
          `products/${wooId}/variations/batch`,
          { create: createPayload }
        );
        const createdVars = Array.isArray(batchRes?.create) ? batchRes.create : [];
        if (createdVars.length > 0) {
          const now = new Date().toISOString();
          const { data: parentRow } = await supabaseAdmin
            .from("products")
            .select("id")
            .eq("store_id", storeId)
            .eq("woo_id", wooId)
            .maybeSingle();
          if (parentRow?.id) {
            const varRows = createdVars.map((v) => {
              const rp = v.regular_price as string | undefined;
              const sp = v.sale_price as string | undefined;
              const pr = v.price as string | undefined;
              const dims = (v.dimensions as { length?: string; width?: string; height?: string } | undefined) || {};
              return {
                store_id: storeId,
                product_id: parentRow.id,
                woo_parent_id: wooId,
                woo_id: v.id as number,
                sku: (v.sku as string) || null,
                regular_price: rp ? parseFloat(rp) : null,
                sale_price: sp ? parseFloat(sp) : null,
                price: pr ? parseFloat(pr) : null,
                stock_quantity: (v.stock_quantity as number | null) ?? null,
                stock_status: (v.stock_status as string) || null,
                manage_stock: !!v.manage_stock,
                status: (v.status as string) || "publish",
                virtual: !!v.virtual,
                downloadable: !!v.downloadable,
                tax_class: (v.tax_class as string) || null,
                weight: (v.weight as string) || null,
                dimensions: JSON.parse(JSON.stringify(dims)) as Json,
                description: (v.description as string) || null,
                attributes: JSON.parse(JSON.stringify(v.attributes || [])) as Json,
                image: v.image ? (JSON.parse(JSON.stringify(v.image)) as Json) : null,
                gallery: [] as unknown as Json,
                menu_order: (v.menu_order as number) || 0,
                raw_data: JSON.parse(JSON.stringify(v)) as Json,
                synced_at: now,
              };
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabaseAdmin as any)
              .from("product_variations")
              .upsert(varRows, { onConflict: "store_id,woo_id" });
          }
        }
      } catch (ve) {
        console.error("[variations-batch]", ve);
      }
    }

    const insertRow = {
      store_id: storeId,
      woo_id: wooId,
      name: (created.name as string) ?? null,
      slug: (created.slug as string) ?? null,
      sku: (created.sku as string) ?? null,
      price: created.price ? parseFloat(created.price as string) : null,
      regular_price: created.regular_price ? parseFloat(created.regular_price as string) : null,
      sale_price: created.sale_price ? parseFloat(created.sale_price as string) : null,
      manage_stock: (created.manage_stock as boolean | null) ?? null,
      stock_quantity: (created.stock_quantity as number) ?? null,
      stock_status: (created.stock_status as string) ?? null,
      status: (created.status as string) ?? null,
      type: (created.type as string) ?? null,
      description: (created.description as string) ?? null,
      short_description: (created.short_description as string) ?? null,
      categories: created.categories ?? [],
      images: created.images ?? [],
      attributes: created.attributes ?? [],
      raw_data: created,
      synced_at: new Date().toISOString(),
    };
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("products")
      .upsert(insertRow as never, { onConflict: "store_id,woo_id" })
      .select("*")
      .single();

    if (insertErr) {
      console.error("[product-create][db-upsert]", insertErr);
    }

    void logActivity({
      action: "product.create",
      entityType: "product",
      entityId: inserted?.id ?? `woo-${wooId}`,
      after: (inserted ?? insertRow) as Record<string, unknown>,
      metadata: { woo_id: wooId, store_id: storeId },
      req,
    });

    return res.status(200).json(inserted || { ...insertRow, id: `woo-${wooId}` });
  } catch (e) {
    console.error("[product-create]", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Create failed" });
  }
}