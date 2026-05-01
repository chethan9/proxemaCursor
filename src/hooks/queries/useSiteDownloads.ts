import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId } from "react";
import { listSiteDownloads } from "@/services/downloadsService";
import { supabase } from "@/integrations/supabase/client";

/**
 * Supabase Realtime requires `.on(...)` before `.subscribe()`, and does not allow
 * attaching another `.on()` after subscribe. `useSiteDownloads` is mounted from
 * more than one component (e.g. sidebar unseen badge + Downloads page) for the
 * same store; reusing an identical channel name makes the second mount attach
 * listeners to an already-subscribed channel → runtime error. Unique channel
 * names per hook instance fixes that; duplicate listeners only invalidate the
 * same query key.
 */
function realtimeChannelSuffix(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useSiteDownloads(storeId: string | undefined) {
  const queryClient = useQueryClient();
  /** Stable per component instance (sidebar vs page both call this hook). */
  const instanceTag = useId().replace(/[^a-zA-Z0-9_-]/g, "") || realtimeChannelSuffix();

  const query = useQuery({
    queryKey: ["site-downloads", storeId],
    queryFn: () => listSiteDownloads(storeId!),
    enabled: !!storeId,
    staleTime: 15_000,
    /** Bulk-print artifacts appear after job completion; polling covers environments without reliable realtime. */
    refetchInterval: 6_000,
  });

  useEffect(() => {
    if (!storeId) return;
    const channelName = `downloads-${storeId}-${instanceTag}`;
    const channel = supabase
      .channel(channelName)
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
  }, [storeId, queryClient, instanceTag]);

  return query;
}