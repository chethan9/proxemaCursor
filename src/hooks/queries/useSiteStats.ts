import { useQuery } from "@tanstack/react-query";
import { fetchSiteHomeStats } from "@/services/siteStatsService";

export function useSiteHomeStats(
  storeId: string | null | undefined,
  currency?: string | null,
  storeTimezone?: string | null
) {
  const tzKey = storeTimezone?.trim() || null;
  const currencyKey = currency || null;
  return useQuery({
    queryKey: ["site-home-stats", storeId, currencyKey, tzKey],
    queryFn: () => fetchSiteHomeStats(storeId as string, currency, storeTimezone),
    enabled: !!storeId,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData, previousQuery) => {
      const pk = previousQuery?.queryKey;
      if (!pk || pk[1] !== storeId || pk[2] !== currencyKey || pk[3] !== tzKey) return undefined;
      return previousData;
    },
  });
}