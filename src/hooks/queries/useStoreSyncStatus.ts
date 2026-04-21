import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useStoreSyncStatus(storeId: string | undefined) {
  return useQuery({
    queryKey: ["store-sync-status", storeId] as const,
    queryFn: async () => {
      if (!storeId) return { initialSyncDone: false };
      const { data } = await supabase
        .from("stores")
        .select("initial_sync_completed_at")
        .eq("id", storeId)
        .maybeSingle();
      return { initialSyncDone: !!data?.initial_sync_completed_at };
    },
    enabled: !!storeId,
    staleTime: 5_000,
    refetchInterval: (query) => {
      const data = query.state.data as { initialSyncDone: boolean } | undefined;
      return data && !data.initialSyncDone ? 4000 : false;
    },
  });
}