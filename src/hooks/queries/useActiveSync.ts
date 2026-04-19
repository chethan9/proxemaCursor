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

export function useActiveSync(storeId: string | undefined) {
  return useQuery<ActiveSyncState>({
    queryKey: ["active-sync", storeId],
    enabled: !!storeId,
    refetchInterval: (q) => (q.state.data?.running ? 2500 : false),
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!storeId) throw new Error("no store");
      const { data: runs } = await supabase
        .from("sync_runs")
        .select("id, aspect, status, started_at, records_processed, estimated_total, processed_total, is_initial")
        .eq("store_id", storeId)
        .eq("status", "running")
        .order("started_at", { ascending: false })
        .limit(10);

      const list = runs || [];
      const running = list.length > 0;
      if (!running) {
        return {
          running: false, is_initial: false, progress_pct: 100,
          current_aspect: null, processed: 0, estimated: 0,
          started_at: null, eta_seconds: 0,
        };
      }

      const primary = list[0];
      const estimated = Math.max(primary.estimated_total || 0, 1);
      const processed = list.reduce((sum, r) => sum + (r.records_processed || 0), 0);
      const pct = estimated > 0 ? Math.min(99, Math.round((processed / estimated) * 100)) : 0;

      const startedMs = primary.started_at ? new Date(primary.started_at).getTime() : Date.now();
      const elapsed = (Date.now() - startedMs) / 1000;
      const rate = processed > 0 && elapsed > 0 ? processed / elapsed : 120;
      const remaining = Math.max(0, estimated - processed);
      const eta = Math.ceil(remaining / Math.max(rate, 20));

      return {
        running: true,
        is_initial: !!primary.is_initial,
        progress_pct: pct,
        current_aspect: primary.aspect,
        processed,
        estimated,
        started_at: primary.started_at,
        eta_seconds: eta,
      };
    },
  });
}