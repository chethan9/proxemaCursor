import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STUCK_THRESHOLD_MINUTES = 10;
const BULK_STUCK_THRESHOLD_MINUTES = 30;

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

    let failedSyncCount = 0;
    if (stuckRuns && stuckRuns.length > 0) {
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
      failedSyncCount = stuckRuns.length;
    }

    // Bulk jobs stuck > 30 minutes
    const bulkThreshold = new Date(Date.now() - BULK_STUCK_THRESHOLD_MINUTES * 60 * 1000).toISOString();
    const { data: stuckBulk } = await supabase
      .from("bulk_jobs")
      .select("id")
      .eq("status", "running")
      .lt("started_at", bulkThreshold);

    let failedBulkCount = 0;
    if (stuckBulk && stuckBulk.length > 0) {
      const ids = stuckBulk.map((r) => r.id);
      await supabase
        .from("bulk_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: `Auto-failed: bulk job stalled for ${BULK_STUCK_THRESHOLD_MINUTES}+ minutes`,
        })
        .in("id", ids);
      failedBulkCount = stuckBulk.length;
    }

    return res.status(200).json({
      success: true,
      stuck_sync_count: failedSyncCount,
      stuck_bulk_count: failedBulkCount,
      message: `Auto-failed ${failedSyncCount} sync(s) and ${failedBulkCount} bulk job(s)`,
    });
  } catch (error) {
    console.error("[auto-fail-stuck] Error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}