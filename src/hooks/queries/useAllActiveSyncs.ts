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
  running: boolean;
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
      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: runningAll } = await supabase
        .from("sync_runs")
        .select("id, store_id, started_at, is_initial")
        .eq("aspect", "all")
        .eq("status", "running")
        .gte("started_at", since);

      if (!runningAll || runningAll.length === 0) return [];

      const storeIds = Array.from(new Set(runningAll.map((r) => r.store_id)));
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
      for (const all of runningAll) {
        const store = storeMap.get(all.store_id);
        if (!store) continue;

        const batch = (childRuns || []).filter(
          (r) => r.store_id === all.store_id && r.started_at >= all.started_at
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

        results.push({
          store_id: all.store_id,
          store_name: store.name,
          store_url: store.url,
          store_logo_url: store.logo_url,
          progress: Math.round(progress),
          currentAspect,
          started_at: all.started_at,
          is_initial: !!all.is_initial,
          running: true,
        });
      }
      return results;
    },
  });
}