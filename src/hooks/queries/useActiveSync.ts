import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const CORE_ASPECTS = ["products", "orders", "customers", "categories"];
const SECONDARY_ASPECTS = ["variations", "tags", "coupons"];

const CORE_WEIGHTS: Record<string, number> = {
  products: 45, orders: 35, customers: 10, categories: 10,
};
const SECONDARY_WEIGHTS: Record<string, number> = {
  variations: 80, tags: 10, coupons: 10,
};

export interface ActiveSyncResult {
  running: boolean;
  progress: number;
  currentAspect: string | null;
  elapsed_seconds: number;
  estimated_total: number;
  processed: number;
  started_at?: string;
  is_initial: boolean;
  phase: "core" | "secondary" | "all" | null;
  coreRunning: boolean;
  secondaryRunning: boolean;
  coreProgress: number;
  secondaryProgress: number;
}

function computeWeightedProgress(
  runs: { aspect: string; status: string; records_processed: number | null }[],
  aspects: string[],
  weights: Record<string, number>
): { progress: number; currentAspect: string | null } {
  let progress = 0;
  let currentAspect: string | null = null;
  const byAspect = new Map<string, string>();
  for (const r of runs) if (!byAspect.has(r.aspect)) byAspect.set(r.aspect, r.status);
  for (const asp of aspects) {
    const w = weights[asp] || 0;
    const st = byAspect.get(asp);
    if (!st) continue;
    if (st === "completed" || st === "failed") progress += w;
    else if (st === "running") { progress += w * 0.4; currentAspect = asp; }
  }
  if (progress >= 100) progress = 99;
  return { progress: Math.round(progress), currentAspect };
}

export function useActiveSync(storeId: string | null) {
  return useQuery<ActiveSyncResult>({
    queryKey: ["active-sync", storeId],
    enabled: !!storeId,
    refetchInterval: 2000,
    queryFn: async () => {
      const empty: ActiveSyncResult = {
        running: false, progress: 0, currentAspect: null, elapsed_seconds: 0,
        estimated_total: 0, processed: 0, is_initial: false, phase: null,
        coreRunning: false, secondaryRunning: false, coreProgress: 0, secondaryProgress: 0,
      };
      if (!storeId) return empty;

      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: runs } = await supabase
        .from("sync_runs")
        .select("id, aspect, status, records_processed, started_at, completed_at, is_initial")
        .eq("store_id", storeId)
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(60);

      if (!runs || runs.length === 0) return empty;

      const corePlaceholder = runs.find((r) => (r.aspect === "core" || r.aspect === "all") && r.status === "running")
        || runs.find((r) => r.aspect === "core" || r.aspect === "all");
      const secondaryPlaceholder = runs.find((r) => r.aspect === "secondary" && r.status === "running")
        || runs.find((r) => r.aspect === "secondary");

      const coreRunning = !!corePlaceholder && corePlaceholder.status === "running";
      const secondaryRunning = !!secondaryPlaceholder && secondaryPlaceholder.status === "running";

      let coreProgress = 0, secondaryProgress = 0;
      let currentAspect: string | null = null;

      if (corePlaceholder) {
        const batchRuns = runs.filter((r) => r.started_at >= corePlaceholder.started_at && CORE_ASPECTS.includes(r.aspect));
        const w = computeWeightedProgress(batchRuns, CORE_ASPECTS, CORE_WEIGHTS);
        coreProgress = corePlaceholder.status === "completed" ? 100 : corePlaceholder.status === "failed" ? 100 : w.progress;
        if (coreRunning) currentAspect = w.currentAspect;
      }
      if (secondaryPlaceholder) {
        const batchRuns = runs.filter((r) => r.started_at >= secondaryPlaceholder.started_at && SECONDARY_ASPECTS.includes(r.aspect));
        const w = computeWeightedProgress(batchRuns, SECONDARY_ASPECTS, SECONDARY_WEIGHTS);
        secondaryProgress = secondaryPlaceholder.status === "completed" ? 100 : secondaryPlaceholder.status === "failed" ? 100 : w.progress;
        if (secondaryRunning && !currentAspect) currentAspect = w.currentAspect;
      }

      const activePlaceholder = coreRunning ? corePlaceholder : secondaryRunning ? secondaryPlaceholder : null;
      if (!activePlaceholder) return empty;

      const progress = coreRunning ? coreProgress : secondaryProgress;
      const startMs = new Date(activePlaceholder.started_at).getTime();
      const elapsed = Math.max(0, Math.floor((Date.now() - startMs) / 1000));

      const totalProcessed = runs
        .filter((r) => r.started_at >= activePlaceholder.started_at && ![...CORE_ASPECTS, ...SECONDARY_ASPECTS].includes(r.aspect) === false)
        .reduce((s, r) => s + (r.records_processed || 0), 0);

      return {
        running: true,
        progress,
        currentAspect,
        elapsed_seconds: elapsed,
        estimated_total: 0,
        processed: totalProcessed,
        started_at: activePlaceholder.started_at,
        is_initial: !!activePlaceholder.is_initial,
        phase: activePlaceholder.aspect as "core" | "secondary" | "all",
        coreRunning,
        secondaryRunning,
        coreProgress,
        secondaryProgress,
      };
    },
  });
}