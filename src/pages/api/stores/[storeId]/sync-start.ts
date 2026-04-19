import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getAppBaseUrl } from "@/lib/app-url";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { storeId } = req.query;
  if (!storeId || typeof storeId !== "string") return res.status(400).json({ error: "Store ID required" });

  const { estimated_total = 0, is_initial = false } = req.body || {};

  // Create placeholder sync_run so UI can poll immediately
  const { data: run } = await supabaseAdmin
    .from("sync_runs")
    .insert({
      store_id: storeId,
      aspect: "all",
      status: "running",
      started_at: new Date().toISOString(),
      is_initial,
      estimated_total,
      processed_total: 0,
    } as never)
    .select()
    .single();

  // Fire-and-forget: trigger actual sync without awaiting
  const base = getAppBaseUrl();
  fetch(`${base}/api/stores/${storeId}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }).catch((e) => console.error("[sync-start] bg trigger:", e));

  return res.status(200).json({ sync_run_id: run?.id, queued: true });
}