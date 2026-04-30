import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import { supabase } from "@/integrations/supabase/client";

const ASPECTS = ["products", "orders", "customers", "categories", "tags", "coupons"];
const ASPECT_WEIGHTS: Record<string, number> = {
  orders: 45,
  products: 25,
  customers: 20,
  categories: 4,
  tags: 3,
  coupons: 3,
};

type ActiveSyncData = {
  running: boolean;
  progress: number;
  currentAspect: string | null;
  elapsed_seconds: number;
  estimated_total: number;
  processed: number;
  pages_done?: number;
  pages_total?: number;
  started_at?: string;
  is_initial: boolean;
} | null;

export function useActiveSync(storeId: string | null) {
  const qc = useQueryClient();
  const prevRunningRef = useRef(false);
  const prevStoreIdRef = useRef<string | null>(null);

  const query = useQuery({
    queryKey: ["active-sync", storeId],
    enabled: !!storeId,
    refetchInterval: 2000,
    queryFn: async (): Promise<ActiveSyncData> => {
      if (!storeId) return null;

      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { data: runs } = await supabase
        .from("sync_runs")
        .select("id, aspect, status, records_processed, started_at, completed_at, is_initial, cursor_page, total_pages")
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

      const statusByAspect = new Map<string, { status: string; processed: number; cursor: number; totalPages: number; started_at: string }>();
      for (const r of batchRuns) {
        const prev = statusByAspect.get(r.aspect);
        if (!prev || r.started_at > prev.started_at) {
          statusByAspect.set(r.aspect, {
            status: r.status,
            processed: r.records_processed || 0,
            cursor: r.cursor_page || 0,
            totalPages: r.total_pages || 0,
            started_at: r.started_at,
          });
        }
      }

      let progress = 0;
      let currentAspect: string | null = null;
      let totalProcessed = 0;
      let pagesDone = 0;
      let pagesTotal = 0;
      for (const asp of ASPECTS) {
        const weight = ASPECT_WEIGHTS[asp] || 0;
        const s = statusByAspect.get(asp);
        if (!s) continue;
        if (s.status === "completed") {
          progress += weight;
          totalProcessed += s.processed;
          pagesDone += s.totalPages || s.cursor;
          pagesTotal += s.totalPages || s.cursor;
        } else if (s.status === "running") {
          const pageRatio = s.totalPages > 0 ? Math.min(1, s.cursor / s.totalPages) : 0.05;
          progress += weight * pageRatio;
          if (!currentAspect) currentAspect = asp;
          totalProcessed += s.processed;
          pagesDone += s.cursor;
          pagesTotal += s.totalPages;
        } else if (s.status === "failed") {
          progress += weight;
          pagesDone += s.cursor;
          pagesTotal += s.totalPages || s.cursor;
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
        pages_done: pagesDone,
        pages_total: pagesTotal,
        started_at: batchStart,
        is_initial: !!allRow.is_initial,
      };
    },
  });

  useEffect(() => {
    if (!storeId || !query.data) return;
    if (prevStoreIdRef.current !== storeId) {
      prevStoreIdRef.current = storeId;
      prevRunningRef.current = query.data.running;
      return;
    }
    if (prevRunningRef.current && !query.data.running) {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["taxonomy"] });
      qc.invalidateQueries({ queryKey: ["webhooks"] });
      qc.invalidateQueries({ queryKey: ["sync-runs"] });
      qc.invalidateQueries({ queryKey: ["active-syncs-all"] });
      qc.invalidateQueries({ queryKey: queryKeys.productCategoryOptions(storeId) });
    }
    prevRunningRef.current = query.data.running;
  }, [query.data, storeId, qc]);

  return query;
}