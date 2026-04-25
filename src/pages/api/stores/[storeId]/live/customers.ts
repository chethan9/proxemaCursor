import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { wooLiveFetch } from "@/lib/woo-live-fetch";
import type { TablesInsert } from "@/integrations/supabase/helpers";

async function warmWriteCustomers(storeId: string, items: Record<string, unknown>[]) {
  if (!items.length) return;
  try {
    const rows: TablesInsert<"customers">[] = items.map((c) => ({
      store_id: storeId,
      woo_id: c.id as number,
      email: (c.email as string) ?? null,
      first_name: (c.first_name as string) ?? null,
      last_name: (c.last_name as string) ?? null,
      username: (c.username as string) ?? null,
      role: (c.role as string) ?? null,
      billing: (c.billing ?? null) as TablesInsert<"customers">["billing"],
      shipping: (c.shipping ?? null) as TablesInsert<"customers">["shipping"],
      avatar_url: (c.avatar_url as string) ?? null,
      orders_count: (c.orders_count as number) ?? 0,
      total_spent: (c.total_spent as string) ? Number(c.total_spent) : 0,
      date_created: (c.date_created as string) ?? null,
      date_modified: (c.date_modified as string) ?? null,
      raw_data: c as TablesInsert<"customers">["raw_data"],
      synced_at: new Date().toISOString(),
    }));
    await supabaseAdmin.from("customers").upsert(rows, { onConflict: "store_id,woo_id" });
  } catch (e) {
    console.error("[live/customers] warm-write failed:", e);
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
    const result = await wooLiveFetch<Record<string, unknown>>(storeId, "customers", {
      page,
      per_page: perPage,
      search: req.query.search as string | undefined,
      orderby: (req.query.orderby as string) || "registered_date",
      order: (req.query.order as "asc" | "desc") || "desc",
    });
    warmWriteCustomers(storeId, result.data).catch(() => { /* already logged */ });
    return res.status(200).json({ data: result.data, count: result.total });
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : "Fetch failed" });
  }
}