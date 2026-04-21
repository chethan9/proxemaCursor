import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { wooLiveFetch } from "@/lib/woo-live-fetch";

async function warmWriteProducts(storeId: string, items: Record<string, unknown>[]) {
  if (!items.length) return;
  try {
    const rows = items.map((p) => ({
      store_id: storeId,
      woo_id: p.id as number,
      name: (p.name as string) ?? null,
      slug: (p.slug as string) ?? null,
      sku: (p.sku as string) ?? null,
      price: (p.price as string) ?? null,
      regular_price: (p.regular_price as string) ?? null,
      sale_price: (p.sale_price as string) ?? null,
      stock_quantity: (p.stock_quantity as number) ?? null,
      stock_status: (p.stock_status as string) ?? null,
      status: (p.status as string) ?? null,
      type: (p.type as string) ?? null,
      description: (p.description as string) ?? null,
      short_description: (p.short_description as string) ?? null,
      categories: p.categories ?? null,
      images: p.images ?? null,
      attributes: p.attributes ?? null,
      raw_data: p,
      synced_at: new Date().toISOString(),
    }));
    await supabaseAdmin.from("products").upsert(rows, { onConflict: "store_id,woo_id" });
  } catch (e) {
    console.error("[live/products] warm-write failed:", e);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const { storeId } = req.query;
  if (typeof storeId !== "string") return res.status(400).json({ error: "Invalid storeId" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const { data: userRes } = await supabaseAdmin.auth.getUser(token);
  if (!userRes.user) return res.status(401).json({ error: "Unauthorized" });

  const { data: store } = await supabaseAdmin.from("stores").select("id").eq("id", storeId).maybeSingle();
  if (!store) return res.status(404).json({ error: "Store not found" });

  try {
    const page = parseInt((req.query.page as string) || "1", 10);
    const perPage = parseInt((req.query.per_page as string) || "50", 10);
    const result = await wooLiveFetch<Record<string, unknown>>(storeId, "products", {
      page,
      per_page: perPage,
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      orderby: (req.query.orderby as string) || "date",
      order: (req.query.order as "asc" | "desc") || "desc",
      category: req.query.category as string | undefined,
      stock_status: req.query.stock_status as string | undefined,
      min_price: req.query.min_price as string | undefined,
      max_price: req.query.max_price as string | undefined,
    });
    warmWriteProducts(storeId, result.data).catch(() => { /* already logged */ });
    return res.status(200).json({ data: result.data, count: result.total });
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : "Fetch failed" });
  }
}