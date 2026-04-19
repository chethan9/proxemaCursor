import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const storeId = Array.isArray(req.query.storeId) ? req.query.storeId[0] : req.query.storeId;
  if (!storeId) return res.status(400).json({ error: "Missing storeId" });

  try {
    const creds = await getStoreCreds(storeId);
    const payload = req.body || {};
    const created = await wooRequest<Record<string, unknown>>(creds, "POST", "products", undefined, payload);
    const wooId = created.id as number;

    const { data: inserted } = await supabaseAdmin
      .from("products")
      .insert({
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
      })
      .select("*")
      .single();

    return res.status(200).json(inserted || created);
  } catch (e) {
    console.error("[product-create]", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Create failed" });
  }
}