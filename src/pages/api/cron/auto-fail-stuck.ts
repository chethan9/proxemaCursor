import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STUCK_THRESHOLD_MINUTES = 10;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const threshold = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000).toISOString();

    const { data: stuckRuns, error: findErr } = await supabase
      .from("sync_runs")
      .select("id, store_id, aspect, started_at")
      .eq("status", "running")
      .lt("started_at", threshold);

    if (findErr) throw findErr;

    if (!stuckRuns || stuckRuns.length === 0) {
      return res.status(200).json({ success: true, stuck_count: 0, message: "No stuck runs found" });
    }

    const ids = stuckRuns.map((r) => r.id);
    const { error: updateErr } = await supabase
      .from("sync_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: `Auto-failed: no progress for ${STUCK_THRESHOLD_MINUTES}+ minutes`,
      })
      .in("id", ids);

    if (updateErr) throw updateErr;

    return res.status(200).json({
      success: true,
      stuck_count: stuckRuns.length,
      failed_ids: ids,
      message: `Marked ${stuckRuns.length} stuck sync(s) as failed`,
    });
  } catch (error) {
    console.error("[auto-fail-stuck] Error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}