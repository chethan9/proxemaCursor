import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { listSiteDownloads } from "@/services/downloadsService";
import { supabase } from "@/integrations/supabase/client";

export function useSiteDownloads(storeId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["site-downloads", storeId],
    queryFn: () => listSiteDownloads(storeId!),
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