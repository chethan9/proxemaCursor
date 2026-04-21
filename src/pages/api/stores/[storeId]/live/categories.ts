import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { wooLiveFetch } from "@/lib/woo-live-fetch";

async function warmWrite(storeId: string, items: Record<string, unknown>[]) {
  if (!items.length) return;
  try {
    const rows = items.map((t) => ({
      store_id: storeId,
      woo_id: t.id as number,
      name: (t.name as string) ?? null,
      slug: (t.slug as string) ?? null,
      parent_id: (t.parent as number) ?? null,
      description: (t.description as string) ?? null,
      display: (t.display as string) ?? null,
      image: t.image ?? null,
      menu_order: (t.menu_order as number) ?? null,
      count: (t.count as number) ?? null,
      raw_data: t,
      synced_at: new Date().toISOString(),
    }));
    await supabaseAdmin.from("categories").upsert(rows, { onConflict: "store_id,woo_id" });
  } catch (e) {
    console.error("[live/categories] warm-write failed:", e);
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
    const result = await wooLiveFetch<Record<string, unknown>>(storeId, "products/categories", {
      page,
      per_page: perPage,
      search: req.query.search as string | undefined,
      orderby: "name",
      order: "asc",
    });
    warmWrite(storeId, result.data).catch(() => { /* already logged */ });
    return res.status(200).json({ data: result.data, count: result.total });
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : "Fetch failed" });
  }
}