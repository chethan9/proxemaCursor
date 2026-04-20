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
  phase: "core" | "secondary" | "all";
}

const CORE_WEIGHTS: Record<string, number> = { products: 45, orders: 35, customers: 10, categories: 10 };
const SECONDARY_WEIGHTS: Record<string, number> = { variations: 80, tags: 10, coupons: 10 };
const CORE_ASPECTS = ["products", "orders", "customers", "categories"];
const SECONDARY_ASPECTS = ["variations", "tags", "coupons"];

export function useAllActiveSyncs() {
  return useQuery({
    queryKey: ["active-syncs-all"],
    refetchInterval: 2500,
    queryFn: async (): Promise<ActiveSyncSummary[]> => {
      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: runningPlaceholders } = await supabase
        .from("sync_runs")
        .select("id, store_id, started_at, is_initial, aspect")
        .in("aspect", ["core", "secondary", "all"])
        .eq("status", "running")
        .gte("started_at", since);

      if (!runningPlaceholders || runningPlaceholders.length === 0) return [];

      const storeIds = Array.from(new Set(runningPlaceholders.map((r) => r.store_id)));
      const { data: stores } = await supabase
        .from("stores")
        .select("id, name, url, logo_url")
        .in("id", storeIds);
      const storeMap = new Map((stores || []).map((s) => [s.id, s]));

      const { data: childRuns } = await supabase
        .from("sync_runs")
        .select("store_id, aspect, status, started_at")
        .in("store_id", storeIds)
        .not("aspect", "in", "(core,secondary,all)")
        .gte("started_at", since)
        .order("started_at", { ascending: false });

      const results: ActiveSyncSummary[] = [];
      for (const ph of runningPlaceholders) {
        const store = storeMap.get(ph.store_id);
        if (!store) continue;

        const aspects = ph.aspect === "secondary" ? SECONDARY_ASPECTS : CORE_ASPECTS;
        const weights = ph.aspect === "secondary" ? SECONDARY_WEIGHTS : CORE_WEIGHTS;

        const batch = (childRuns || []).filter(
          (r) => r.store_id === ph.store_id && r.started_at >= ph.started_at && aspects.includes(r.aspect)
        );
        const byAspect = new Map<string, string>();
        for (const r of batch) if (!byAspect.has(r.aspect)) byAspect.set(r.aspect, r.status);

        let progress = 0;
        let currentAspect: string | null = null;
        for (const asp of aspects) {
          const w = weights[asp] || 0;
          const st = byAspect.get(asp);
          if (!st) continue;
          if (st === "completed" || st === "failed") progress += w;
          else if (st === "running") { progress += w * 0.4; currentAspect = asp; }
        }
        if (progress >= 100) progress = 99;

        results.push({
          store_id: ph.store_id,
          store_name: store.name,
          store_url: store.url,
          store_logo_url: store.logo_url,
          progress: Math.round(progress),
          currentAspect,
          started_at: ph.started_at,
          is_initial: !!ph.is_initial,
          running: true,
          phase: ph.aspect as "core" | "secondary" | "all",
        });
      }
      return results;
    },
  });
}