import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActiveSyncSummary {
  store_id: string;
  store_name: string;
  store_url: string;
  store_logo_url: string | null;
  progress: number;
  currentAspect: string | null;
  started_at: string;
  is_initial: boolean;
}

const ASPECT_WEIGHTS: Record<string, number> = {
  orders: 45, products: 25, customers: 20, categories: 4, tags: 3, coupons: 3,
};
const ASPECTS = ["products", "orders", "customers", "categories", "tags", "coupons"];

export function useAllActiveSyncs() {
  return useQuery({
    queryKey: ["active-syncs-all"],
    refetchInterval: 2500,
    queryFn: async (): Promise<ActiveSyncSummary[]> => {
      // Widen window to 2h — initial syncs of large stores legitimately run >15min.
      const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      // Primary: parent "all" runs currently running.
      const { data: runningAll } = await supabase
        .from("sync_runs")
        .select("id, store_id, started_at, is_initial")
        .eq("aspect", "all")
        .eq("status", "running")
        .gte("started_at", since);

      // Fallback: any running aspect run (some syncs spawn children without a parent "all").
      const { data: runningAny } = await supabase
        .from("sync_runs")
        .select("store_id, started_at, is_initial")
        .eq("status", "running")
        .neq("aspect", "all")
        .gte("started_at", since);

      const storeRunMap = new Map<string, { started_at: string; is_initial: boolean }>();
      for (const r of runningAll || []) {
        storeRunMap.set(r.store_id, { started_at: r.started_at, is_initial: !!r.is_initial });
      }
      for (const r of runningAny || []) {
        if (!storeRunMap.has(r.store_id)) {
          storeRunMap.set(r.store_id, { started_at: r.started_at, is_initial: !!r.is_initial });
        }
      }

      if (storeRunMap.size === 0) return [];

      const storeIds = Array.from(storeRunMap.keys());
      const { data: stores } = await supabase
        .from("stores")
        .select("id, name, url, logo_url")
        .in("id", storeIds);
      const storeMap = new Map((stores || []).map((s) => [s.id, s]));

      const { data: childRuns } = await supabase
        .from("sync_runs")
        .select("store_id, aspect, status, started_at")
        .in("store_id", storeIds)
        .neq("aspect", "all")
        .gte("started_at", since)
        .order("started_at", { ascending: false });

      const results: ActiveSyncSummary[] = [];
      for (const [storeId, runInfo] of storeRunMap) {
        const store = storeMap.get(storeId);
        if (!store) continue;

        const batch = (childRuns || []).filter(
          (r) => r.store_id === storeId && r.started_at >= runInfo.started_at
        );
        const byAspect = new Map<string, string>();
        for (const r of batch) if (!byAspect.has(r.aspect)) byAspect.set(r.aspect, r.status);

        let progress = 0;
        let currentAspect: string | null = null;
        for (const asp of ASPECTS) {
          const w = ASPECT_WEIGHTS[asp] || 0;
          const st = byAspect.get(asp);
          if (!st) continue;
          if (st === "completed" || st === "failed") progress += w;
          else if (st === "running") { progress += w * 0.4; currentAspect = asp; }
        }
        if (progress >= 100) progress = 99;
        if (progress === 0 && byAspect.size === 0) progress = 5;

        results.push({
          store_id: storeId,
          store_name: store.name,
          store_url: store.url,
          store_logo_url: store.logo_url,
          progress: Math.round(progress),
          currentAspect,
          started_at: runInfo.started_at,
          is_initial: runInfo.is_initial,
        });
      }
      return results;
    },
  });
}