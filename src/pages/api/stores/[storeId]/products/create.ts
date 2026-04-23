import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";
import type { Json } from "@/integrations/supabase/database.types";
import { logActivity } from "@/lib/activity-log";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const storeId = Array.isArray(req.query.storeId) ? req.query.storeId[0] : req.query.storeId;
  if (!storeId) return res.status(400).json({ error: "Missing storeId" });

  try {
    const creds = await getStoreCreds(storeId);
    if (!creds) return res.status(400).json({ error: "Store credentials missing" });
    const body = req.body || {};
    const variations: WooVariationInput[] = Array.isArray(body.variations) ? body.variations : [];
    const parentPayload = { ...body };
    delete parentPayload.variations;

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
      price: (created.price as string) ?? null,
      regular_price: (created.regular_price as string) ?? null,
      sale_price: (created.sale_price as string) ?? null,
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