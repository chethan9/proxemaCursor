import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const ASPECTS = ["products", "orders", "customers", "categories", "tags", "coupons"];
const WEIGHT = 100 / ASPECTS.length;

export function useActiveSync(storeId: string | null) {
  return useQuery({
    queryKey: ["active-sync", storeId],
    enabled: !!storeId,
    refetchInterval: 2000,
    queryFn: async () => {
      if (!storeId) return null;

      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: runs } = await supabase
        .from("sync_runs")
        .select("id, aspect, status, records_processed, started_at, completed_at, is_initial")
        .eq("store_id", storeId)
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(40);

      if (!runs || runs.length === 0) {
        return { running: false, progress: 0, currentAspect: null, elapsed_seconds: 0, estimated_total: 0, processed: 0, is_initial: false };
      }

      const allRow = runs.find((r) => r.aspect === "all");
      if (!allRow) {
        return { running: false, progress: 0, currentAspect: null, elapsed_seconds: 0, estimated_total: 0, processed: 0, is_initial: false };
      }

      const running = allRow.status === "running";
      const batchStart = allRow.started_at;
      const batchRuns = runs.filter((r) => r.aspect !== "all" && r.started_at >= batchStart);

      const statusByAspect = new Map<string, { status: string; processed: number }>();
      for (const r of batchRuns) {
        const prev = statusByAspect.get(r.aspect);
        if (!prev || r.started_at > (prev as { started_at?: string }).started_at!) {
          statusByAspect.set(r.aspect, { status: r.status, processed: r.records_processed || 0 });
        }
      }

      let progress = 0;
      let currentAspect: string | null = null;
      let totalProcessed = 0;
      for (const asp of ASPECTS) {
        const s = statusByAspect.get(asp);
        if (!s) continue;
        if (s.status === "completed") {
          progress += WEIGHT;
          totalProcessed += s.processed;
        } else if (s.status === "running") {
          progress += WEIGHT * 0.4;
          currentAspect = asp;
          totalProcessed += s.processed;
        } else if (s.status === "failed") {
          progress += WEIGHT;
        }
      }

      if (!running) progress = 100;
      else if (progress >= 100) progress = 99;

      const startMs = new Date(batchStart).getTime();
      const elapsed = Math.max(0, Math.floor((Date.now() - startMs) / 1000));

      return {
        running,
        progress: Math.round(progress),
        currentAspect,
        elapsed_seconds: elapsed,
        estimated_total: 0,
        processed: totalProcessed,
        started_at: batchStart,
        is_initial: !!allRow.is_initial,
      };
    },
  });
}