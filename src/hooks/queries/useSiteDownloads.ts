import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { listSiteDownloads, type DownloadsFilters } from "@/services/downloadsService";
import { supabase } from "@/integrations/supabase/client";

export function useSiteDownloads(storeId: string | undefined, filters: DownloadsFilters) {
  const queryClient = useQueryClient();
  const queryKey = ["site-downloads", storeId, filters] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => listSiteDownloads(storeId!, filters),
    enabled: !!storeId,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!storeId) return;
    const channel = supabase
      .channel(`downloads-${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bulk_jobs", filter: `store_id=eq.${storeId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["site-downloads", storeId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, queryClient]);

  return query;
}