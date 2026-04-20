import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";

type WooVariation = {
  id: number;
  sku: string;
  regular_price: string;
  sale_price: string;
  stock_quantity: number | null;
  stock_status: string;
  manage_stock: boolean;
  weight: string;
  dimensions: { length: string; width: string; height: string };
  description: string;
  image: { id: number; src: string; alt: string } | null;
  attributes: { id?: number; name: string; option: string }[];
  status?: string;
  virtual?: boolean;
  downloadable?: boolean;
  tax_class?: string;
  meta_data?: { id?: number; key: string; value: unknown }[];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const { storeId, productId } = req.query;
  if (typeof storeId !== "string" || typeof productId !== "string") {
    return res.status(400).json({ error: "storeId/productId required" });
  }

  const { data: local } = await supabaseAdmin
    .from("products")
    .select("woo_id")
    .eq("id", productId)
    .eq("store_id", storeId)
    .single();

  if (!local?.woo_id) return res.status(404).json({ error: "Product not found" });

  try {
    const creds = await getStoreCreds(storeId);
    if (!creds) return res.status(400).json({ error: "Store creds missing" });

    const all: WooVariation[] = [];
    let page = 1;
    while (page < 20) {
      const batch = await wooRequest<WooVariation[]>(
        creds,
        "GET",
        `products/${local.woo_id}/variations?per_page=100&page=${page}`
      );
      all.push(...batch);
      if (batch.length < 100) break;
      page++;
    }

    const mapped = all.map((v) => {
      const attributes = (v.attributes || []).map((a) => ({ name: a.name, option: a.option }));
      const key = attributes.map((a) => `${a.name}=${a.option}`).join("|");
      const galleryMeta = (v.meta_data || []).find((m) => m.key === "_wc_additional_variation_images");
      const galleryIds = Array.isArray(galleryMeta?.value) ? (galleryMeta!.value as number[]) : [];
      return {
        id: v.id,
        key,
        attributes,
        regular_price: v.regular_price || "",
        sale_price: v.sale_price || "",
        sku: v.sku || "",
        stock_quantity: v.stock_quantity,
        stock_status: v.stock_status || "instock",
        manage_stock: !!v.manage_stock,
        weight: v.weight || "",
        dimensions: v.dimensions || { length: "", width: "", height: "" },
        description: v.description || "",
        image: v.image ? { id: v.image.id, src: v.image.src, alt: v.image.alt } : null,
        gallery: galleryIds.map((id) => ({ id, src: "" })),
        enabled: v.status !== "private",
        virtual: !!v.virtual,
        downloadable: !!v.downloadable,
        tax_class: v.tax_class || "",
      };
    });

    return res.status(200).json(mapped);
  } catch (e) {
    console.error("[variations-get]", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Fetch failed" });
  }
}