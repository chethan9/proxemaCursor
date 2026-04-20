import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getAppUrl } from "@/lib/app-url";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { storeId } = req.query;
  if (!storeId || typeof storeId !== "string") return res.status(400).json({ error: "Store ID required" });

  const { estimated_total = 0, is_initial = false, phase = "core" } = req.body || {};
  const phaseAspect = phase === "secondary" ? "secondary" : phase === "all" ? "all" : "core";

  const { data: run } = await supabaseAdmin
    .from("sync_runs")
    .insert({
      store_id: storeId,
      aspect: phaseAspect,
      status: "running",
      started_at: new Date().toISOString(),
      is_initial,
      estimated_total,
      processed_total: 0,
    } as never)
    .select()
    .single();

  const base = getAppUrl(req);
  fetch(`${base}/api/stores/${storeId}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phase: phaseAspect }),
  }).catch((e) => console.error("[sync-start] bg trigger:", e));

  return res.status(200).json({ sync_run_id: run?.id, queued: true, phase: phaseAspect });
}