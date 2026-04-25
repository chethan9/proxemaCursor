import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const HEARTBEAT_DEAD_MINUTES = 90;
const BULK_STUCK_THRESHOLD_MINUTES = 90;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const threshold = new Date(Date.now() - HEARTBEAT_DEAD_MINUTES * 60 * 1000).toISOString();

    // Truly dead runs: heartbeat older than threshold OR no heartbeat AND started_at older than threshold
    const { data: heartbeatDead } = await supabase
      .from("sync_runs")
      .select("id, store_id, aspect, last_heartbeat_at, started_at")
      .eq("status", "running")
      .not("last_heartbeat_at", "is", null)
      .lt("last_heartbeat_at", threshold);

    const { data: legacyDead } = await supabase
      .from("sync_runs")
      .select("id, store_id, aspect, last_heartbeat_at, started_at")
      .eq("status", "running")
      .is("last_heartbeat_at", null)
      .lt("started_at", threshold);

    const stuckRuns = [...(heartbeatDead || []), ...(legacyDead || [])];

    let failedSyncCount = 0;
    if (stuckRuns.length > 0) {
      const ids = stuckRuns.map((r) => r.id);
      const { error: updateErr } = await supabase
        .from("sync_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: `Auto-failed: heartbeat dead for ${HEARTBEAT_DEAD_MINUTES}+ minutes`,
        })
        .in("id", ids);
      if (updateErr) throw updateErr;
      failedSyncCount = stuckRuns.length;
    }

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

    // Recover orphan "all" parent runs: child aspects all settled but parent still running
    const { data: allRunning } = await supabase
      .from("sync_runs")
      .select("id, store_id, started_at")
      .eq("status", "running")
      .eq("aspect", "all");

    let recoveredAllCount = 0;
    const recoveredStoreIds = new Set<string>();
    for (const parent of (allRunning || [])) {
      const { data: stillRunningChildren } = await supabase
        .from("sync_runs")
        .select("id")
        .eq("store_id", parent.store_id)
        .eq("status", "running")
        .neq("aspect", "all")
        .gte("started_at", parent.started_at)
        .limit(1);

      if (!stillRunningChildren || stillRunningChildren.length === 0) {
        await supabase
          .from("sync_runs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            error_message: "Auto-recovered: child aspects all settled",
          })
          .eq("id", parent.id);
        recoveredStoreIds.add(parent.store_id);
        recoveredAllCount++;
      }
    }

    // Unlock stores stuck in "syncing" with no remaining running runs
    for (const sid of recoveredStoreIds) {
      const { data: anyRunning } = await supabase
        .from("sync_runs")
        .select("id")
        .eq("store_id", sid)
        .eq("status", "running")
        .limit(1);
      if (!anyRunning || anyRunning.length === 0) {
        await supabase
          .from("stores")
          .update({ status: "connected", last_sync_at: new Date().toISOString() })
          .eq("id", sid)
          .eq("status", "syncing");
      }
    }

    return res.status(200).json({
      success: true,
      stuck_sync_count: failedSyncCount,
      stuck_bulk_count: failedBulkCount,
      recovered_all_runs: recoveredAllCount,
      message: `Auto-failed ${failedSyncCount} sync(s), ${failedBulkCount} bulk job(s); recovered ${recoveredAllCount} orphan parent run(s)`,
    });
  } catch (error) {
    console.error("[auto-fail-stuck] Error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}