import { useQuery } from "@tanstack/react-query";
import { fetchSiteHomeStats } from "@/services/siteStatsService";

export function useSiteHomeStats(
  storeId: string | null | undefined,
  currency?: string | null,
  storeTimezone?: string | null
) {
  const tzKey = storeTimezone?.trim() || null;
  return useQuery({
    queryKey: ["site-home-stats", storeId, currency || null, tzKey],
    queryFn: () => fetchSiteHomeStats(storeId as string, currency, storeTimezone),
    enabled: !!storeId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}