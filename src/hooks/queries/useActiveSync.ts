import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActiveSyncState {
  running: boolean;
  is_initial: boolean;
  progress_pct: number;
  current_aspect: string | null;
  processed: number;
  estimated: number;
  started_at: string | null;
  eta_seconds: number;
}

const ASPECT_ORDER = ["products", "orders", "customers", "categories", "tags", "coupons"];
const WEIGHT = 100 / ASPECT_ORDER.length;

export function useActiveSync(storeId: string | undefined) {
  return useQuery<ActiveSyncState>({
    queryKey: ["active-sync", storeId],
    enabled: !!storeId,
    refetchInterval: (q) => (q.state.data?.running ? 2000 : false),
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!storeId) throw new Error("no store");

      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: runs } = await supabase
        .from("sync_runs")
        .select("id, aspect, status, started_at, completed_at, records_processed, estimated_total, is_initial")
        .eq("store_id", storeId)
        .gte("started_at", tenMinAgo)
        .order("started_at", { ascending: false })
        .limit(50);

      const list = runs || [];
      const allRow = list.find((r) => r.aspect === "all");

      // Determine "running" from the all-row if present, else from any aspect running
      const allRunning = allRow?.status === "running";
      const anyAspectRunning = list.some((r) => r.aspect !== "all" && r.status === "running");
      const running = allRow ? allRunning : anyAspectRunning;

      if (!running) {
        return {
          running: false, is_initial: false, progress_pct: 100,
          current_aspect: null, processed: 0, estimated: 0,
          started_at: null, eta_seconds: 0,
        };
      }

      // Batch: aspect runs started at/after the all-row's start (or all recent if no all-row)
      const batchStart = allRow?.started_at || list[list.length - 1]?.started_at || new Date().toISOString();
      const batchStartMs = new Date(batchStart).getTime() - 2000; // 2s grace
      const batch = list.filter((r) => r.aspect !== "all" && new Date(r.started_at).getTime() >= batchStartMs);

      // Latest status per aspect
      const byAspect = new Map<string, typeof list[0]>();
      for (const r of batch) {
        if (!byAspect.has(r.aspect)) byAspect.set(r.aspect, r);
      }

      let pct = 0;
      let processed = 0;
      let currentAspect: string | null = null;

      for (const aspect of ASPECT_ORDER) {
        const row = byAspect.get(aspect);
        if (!row) continue;
        processed += row.records_processed || 0;
        if (row.status === "completed") {
          pct += WEIGHT;
        } else if (row.status === "running") {
          if (!currentAspect) currentAspect = aspect;
          const est = row.estimated_total || 0;
          const proc = row.records_processed || 0;
          if (est > 0 && proc > 0) {
            pct += WEIGHT * Math.min(1, proc / est);
          } else {
            pct += WEIGHT * 0.3;
          }
        } else if (row.status === "failed") {
          pct += WEIGHT;
        }
      }

      // Cap at 99 while all-row still running
      pct = Math.min(99, Math.max(0, Math.round(pct)));

      const estimated = allRow?.estimated_total || batch.reduce((s, r) => s + (r.estimated_total || 0), 0) || 1;
      const startedMs = new Date(batchStart).getTime();
      const elapsed = (Date.now() - startedMs) / 1000;

      let eta = -1;
      if (elapsed >= 5) {
        const overallDone = pct / 100;
        if (overallDone > 0.01) {
          const totalExpected = elapsed / overallDone;
          eta = Math.max(1, Math.ceil(totalExpected - elapsed));
        } else {
          eta = 60;
        }
      }

      return {
        running: true,
        is_initial: !!(allRow?.is_initial),
        progress_pct: pct,
        current_aspect: currentAspect,
        processed,
        estimated,
        started_at: batchStart,
        eta_seconds: eta,
      };
    },
  });
}