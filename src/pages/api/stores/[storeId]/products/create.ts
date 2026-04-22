import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";

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
        await wooRequest(creds, "POST", `products/${wooId}/variations/batch`, { create: createPayload });
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

    return res.status(200).json(inserted || { ...insertRow, id: `woo-${wooId}` });
  } catch (e) {
    console.error("[product-create]", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Create failed" });
  }
}