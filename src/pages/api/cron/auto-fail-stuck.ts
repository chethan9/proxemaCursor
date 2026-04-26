import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const HEARTBEAT_DEAD_MINUTES_ASPECT = 90;
const HEARTBEAT_DEAD_MINUTES_PARENT = 180;
const CHILD_ALIVE_WINDOW_MINUTES = 30;
const BULK_STUCK_THRESHOLD_MINUTES = 90;

const CRITICAL_ASPECTS = ["products", "orders", "customers", "categories", "tags", "coupons"];

async function unlockStoreInitialSync(supabase: ReturnType<typeof createClient>, storeId: string) {
  await supabase
    .from("stores")
    .update({ initial_sync_completed_at: new Date().toISOString() })
    .eq("id", storeId)
    .is("initial_sync_completed_at", null);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const aspectThreshold = new Date(Date.now() - HEARTBEAT_DEAD_MINUTES_ASPECT * 60 * 1000).toISOString();
    const parentThreshold = new Date(Date.now() - HEARTBEAT_DEAD_MINUTES_PARENT * 60 * 1000).toISOString();
    const childAliveWindow = new Date(Date.now() - CHILD_ALIVE_WINDOW_MINUTES * 60 * 1000).toISOString();

    // Per-aspect runs: dead at 90min
    const { data: aspectHeartbeatDead } = await supabase
      .from("sync_runs")
      .select("id, store_id, aspect, last_heartbeat_at, started_at")
      .eq("status", "running")
      .neq("aspect", "all")
      .not("last_heartbeat_at", "is", null)
      .lt("last_heartbeat_at", aspectThreshold);

    const { data: aspectLegacyDead } = await supabase
      .from("sync_runs")
      .select("id, store_id, aspect, last_heartbeat_at, started_at")
      .eq("status", "running")
      .neq("aspect", "all")
      .is("last_heartbeat_at", null)
      .lt("started_at", aspectThreshold);

    const aspectStuck = [...(aspectHeartbeatDead || []), ...(aspectLegacyDead || [])];

    // Parent "all" runs: dead at 180min, AND only if no child heartbeated in last 30min
    const { data: parentCandidates } = await supabase
      .from("sync_runs")
      .select("id, store_id, aspect, last_heartbeat_at, started_at")
      .eq("status", "running")
      .eq("aspect", "all")
      .or(`last_heartbeat_at.lt.${parentThreshold},and(last_heartbeat_at.is.null,started_at.lt.${parentThreshold})`);

    const parentStuck: typeof aspectStuck = [];
    const parentRescued: { id: string; store_id: string }[] = [];

    for (const parent of (parentCandidates || [])) {
      // Check if any child run is still alive (heartbeated recently)
      const { data: aliveChildren } = await supabase
        .from("sync_runs")
        .select("id")
        .eq("store_id", parent.store_id)
        .eq("status", "running")
        .neq("aspect", "all")
        .gte("started_at", parent.started_at)
        .gte("last_heartbeat_at", childAliveWindow)
        .limit(1);

      if (aliveChildren && aliveChildren.length > 0) continue;

      // Check for partial-success rescue: did all critical aspects complete?
      const { data: completedChildren } = await supabase
        .from("sync_runs")
        .select("aspect")
        .eq("store_id", parent.store_id)
        .eq("status", "completed")
        .gte("started_at", parent.started_at)
        .in("aspect", CRITICAL_ASPECTS);

      const completedAspects = new Set((completedChildren || []).map((c) => c.aspect));
      const allCriticalDone = CRITICAL_ASPECTS.every((a) => completedAspects.has(a));

      if (allCriticalDone) {
        await supabase
          .from("sync_runs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            error_message: null,
            info_message: "Recovered after parent heartbeat timeout — all critical aspects completed",
          })
          .eq("id", parent.id);
        parentRescued.push({ id: parent.id, store_id: parent.store_id });
      } else {
        parentStuck.push(parent as typeof aspectStuck[number]);
      }
    }

    // Fail aspect-level stuck runs
    let failedAspectCount = 0;
    if (aspectStuck.length > 0) {
      const ids = aspectStuck.map((r) => r.id);
      await supabase
        .from("sync_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: `Auto-failed: heartbeat dead for ${HEARTBEAT_DEAD_MINUTES_ASPECT}+ minutes`,
        })
        .in("id", ids);
      failedAspectCount = aspectStuck.length;
    }

    // Fail parent runs that don't qualify for rescue
    let failedParentCount = 0;
    if (parentStuck.length > 0) {
      const ids = parentStuck.map((r) => r.id);
      await supabase
        .from("sync_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: `Auto-failed: heartbeat dead for ${HEARTBEAT_DEAD_MINUTES_PARENT}+ minutes`,
        })
        .in("id", ids);
      failedParentCount = parentStuck.length;
    }

    // Recover orphan parents whose children all settled
    const { data: allRunning } = await supabase
      .from("sync_runs")
      .select("id, store_id, started_at")
      .eq("status", "running")
      .eq("aspect", "all");

    let recoveredAllCount = 0;
    const settledStoreIds = new Set<string>();
    for (const parent of (allRunning || [])) {
      const { data: stillRunning } = await supabase
        .from("sync_runs")
        .select("id")
        .eq("store_id", parent.store_id)
        .eq("status", "running")
        .neq("aspect", "all")
        .gte("started_at", parent.started_at)
        .limit(1);

      if (!stillRunning || stillRunning.length === 0) {
        await supabase
          .from("sync_runs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            info_message: "Auto-recovered: child aspects all settled",
          })
          .eq("id", parent.id);
        settledStoreIds.add(parent.store_id);
        recoveredAllCount++;
      }
    }

    // Unlock initial-sync flag for any rescued/recovered store
    const storesToUnlock = new Set<string>([...parentRescued.map((r) => r.store_id), ...settledStoreIds]);
    for (const sid of storesToUnlock) {
      const { data: anyRunning } = await supabase
        .from("sync_runs")
        .select("id")
        .eq("store_id", sid)
        .eq("status", "running")
        .limit(1);

      await unlockStoreInitialSync(supabase, sid);

      if (!anyRunning || anyRunning.length === 0) {
        await supabase
          .from("stores")
          .update({ status: "connected", last_sync_at: new Date().toISOString() })
          .eq("id", sid);
      }
    }

    // Bulk jobs cleanup (unchanged)
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
      stuck_aspect_count: failedAspectCount,
      stuck_parent_count: failedParentCount,
      rescued_parent_count: parentRescued.length,
      recovered_all_runs: recoveredAllCount,
      stuck_bulk_count: failedBulkCount,
      message: `Auto-failed ${failedAspectCount} aspect run(s), ${failedParentCount} parent run(s); rescued ${parentRescued.length} parent(s) via partial success; recovered ${recoveredAllCount} orphan parent(s); failed ${failedBulkCount} bulk job(s)`,
    });
  } catch (error) {
    console.error("[auto-fail-stuck] Error:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}