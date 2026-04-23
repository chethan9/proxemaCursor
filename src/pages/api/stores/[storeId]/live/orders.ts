import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { wooLiveFetch } from "@/lib/woo-live-fetch";
import type { TablesInsert } from "@/integrations/supabase/helpers";

async function warmWriteOrders(storeId: string, items: Record<string, unknown>[]) {
  if (!items.length) return;
  try {
    const rows: TablesInsert<"orders">[] = items.map((o) => ({
      store_id: storeId,
      woo_id: o.id as number,
      order_number: (o.number as string) ?? null,
      status: (o.status as string) ?? null,
      currency: (o.currency as string) ?? null,
      total: (o.total as string) ? Number(o.total) : null,
      total_tax: (o.total_tax as string) ? Number(o.total_tax) : null,
      shipping_total: (o.shipping_total as string) ? Number(o.shipping_total) : null,
      discount_total: (o.discount_total as string) ? Number(o.discount_total) : null,
      payment_method: (o.payment_method as string) ?? null,
      payment_method_title: (o.payment_method_title as string) ?? null,
      transaction_id: (o.transaction_id as string) ?? null,
      customer_id: (o.customer_id as number) ?? null,
      billing: (o.billing ?? null) as TablesInsert<"orders">["billing"],
      shipping: (o.shipping ?? null) as TablesInsert<"orders">["shipping"],
      line_items: (o.line_items ?? null) as TablesInsert<"orders">["line_items"],
      shipping_lines: (o.shipping_lines ?? null) as TablesInsert<"orders">["shipping_lines"],
      fee_lines: (o.fee_lines ?? null) as TablesInsert<"orders">["fee_lines"],
      coupon_lines: (o.coupon_lines ?? null) as TablesInsert<"orders">["coupon_lines"],
      customer_note: (o.customer_note as string) ?? null,
      date_created: (o.date_created as string) ?? null,
      date_modified: (o.date_modified as string) ?? null,
      date_paid: (o.date_paid as string) ?? null,
      date_completed: (o.date_completed as string) ?? null,
      raw_data: o as TablesInsert<"orders">["raw_data"],
      synced_at: new Date().toISOString(),
    }));
    await supabaseAdmin.from("orders").upsert(rows, { onConflict: "store_id,woo_id" });
  } catch (e) {
    console.error("[live/orders] warm-write failed:", e);
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
    const result = await wooLiveFetch<Record<string, unknown>>(storeId, "orders", {
      page,
      per_page: perPage,
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      orderby: (req.query.orderby as string) || "date",
      order: (req.query.order as "asc" | "desc") || "desc",
      after: req.query.after as string | undefined,
      before: req.query.before as string | undefined,
    });
    warmWriteOrders(storeId, result.data).catch(() => { /* already logged */ });
    return res.status(200).json({ data: result.data, count: result.total });
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : "Fetch failed" });
  }
}