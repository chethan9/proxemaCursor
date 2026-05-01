import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";

const BATCH = 40;

/**
 * Periodically refreshes dashboard_summary for connected stores.
 * Protect with CRON_SECRET in production (see vercel.json).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production" && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { data: stores, error } = await supabaseAdmin
    .from("stores")
    .select("id")
    .eq("status", "connected")
    .limit(BATCH);

  if (error) {
    console.error("[cron/refresh-dashboard-summaries]", error);
    return res.status(500).json({ error: error.message });
  }

  const ids = (stores ?? []).map((s) => s.id);
  let ok = 0;
  let failed = 0;
  for (const id of ids) {
    const { error: rpcErr } = await supabaseAdmin.rpc("refresh_dashboard_summaries_for_store", {
      p_store_id: id,
    });
    if (rpcErr) {
      failed++;
      console.warn("[cron/refresh-dashboard-summaries] store", id, rpcErr.message);
    } else {
      ok++;
    }
  }

  return res.status(200).json({ ok: true, processed: ids.length, refreshed: ok, failed });
}
