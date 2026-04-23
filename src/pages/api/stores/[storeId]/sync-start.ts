import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getAppUrl } from "@/lib/app-url";
import { waitUntil } from "@vercel/functions";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { storeId } = req.query;
  if (!storeId || typeof storeId !== "string") return res.status(400).json({ error: "Store ID required" });

  const { is_initial = false } = req.body || {};

  // Dedup: if a sync is already running for this store within last 5 minutes, return that run.
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: existing } = await supabaseAdmin
    .from("sync_runs")
    .select("id")
    .eq("store_id", storeId)
    .eq("aspect", "all")
    .eq("status", "running")
    .gte("started_at", fiveMinAgo)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return res.status(200).json({ sync_run_id: existing.id, queued: false, deduped: true });
  }

  const { data: run } = await supabaseAdmin
    .from("sync_runs")
    .insert({
      store_id: storeId,
      aspect: "all",
      status: "running",
      started_at: new Date().toISOString(),
      is_initial,
      estimated_total: 0,
      processed_total: 0,
    } as never)
    .select()
    .single();

  if (is_initial) {
    await supabaseAdmin
      .from("stores")
      .update({ onboarding_completed_at: new Date().toISOString() } as never)
      .eq("id", storeId)
      .is("onboarding_completed_at", null);
  }

  const base = getAppUrl(req);
  const syncPromise = fetch(`${base}/api/stores/${storeId}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }).catch((e) => console.error("[sync-start] bg trigger:", e));
  waitUntil(syncPromise);

  return res.status(200).json({ sync_run_id: run?.id, queued: true });
}