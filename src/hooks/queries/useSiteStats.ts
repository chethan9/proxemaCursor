import { useQuery } from "@tanstack/react-query";
import { fetchSiteHomeStats } from "@/services/siteStatsService";

export function useSiteHomeStats(storeId: string | null | undefined) {
  return useQuery({
    queryKey: ["site-home-stats", storeId],
    queryFn: () => fetchSiteHomeStats(storeId as string),
    enabled: !!storeId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}