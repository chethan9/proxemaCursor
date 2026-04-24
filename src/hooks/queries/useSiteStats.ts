import { useQuery } from "@tanstack/react-query";
import { fetchSiteHomeStats } from "@/services/siteStatsService";

export function useSiteHomeStats(storeId: string | null | undefined, currency?: string | null) {
  return useQuery({
    queryKey: ["site-home-stats", storeId, currency || null],
    queryFn: () => fetchSiteHomeStats(storeId as string, currency),
    enabled: !!storeId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}