import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useStoreSyncStatus(storeId: string | undefined) {
  return useQuery({
    queryKey: ["store-sync-status", storeId] as const,
    queryFn: async () => {
      if (!storeId) return { initialSyncDone: false, running: false };
      const [storeRes, runsRes] = await Promise.all([
        supabase.from("stores").select("initial_sync_completed_at").eq("id", storeId).maybeSingle(),
        supabase.from("sync_runs").select("id").eq("store_id", storeId).eq("status", "running").limit(1),
      ]);
      return {
        initialSyncDone: !!storeRes.data?.initial_sync_completed_at,
        running: (runsRes.data || []).length > 0,
      };
    },
    enabled: !!storeId,
    staleTime: 3_000,
    refetchInterval: (query) => {
      const data = query.state.data as { initialSyncDone: boolean; running: boolean } | undefined;
      if (!data) return false;
      return (!data.initialSyncDone || data.running) ? 4000 : false;
    },
  });
}