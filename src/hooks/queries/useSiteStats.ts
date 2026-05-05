import { useQuery } from "@tanstack/react-query";
import {
  fetchSiteHomeStats,
  type SiteHomeStatsQuery,
} from "@/services/siteStatsService";

export function useSiteHomeStats(
  storeId: string | null | undefined,
  currency: string | null | undefined,
  storeTimezone: string | null | undefined,
  homeQuery: SiteHomeStatsQuery
) {
  const tzKey = storeTimezone?.trim() || null;
  const currencyKey = homeQuery.combineAll ? "" : currency || null;
  const rangeKey = homeQuery.range;
  const fromK = homeQuery.fromYmd ?? "";
  const toK = homeQuery.toYmd ?? "";
  const combineK = homeQuery.combineAll ?? false;

  return useQuery({
    queryKey: ["site-home-stats", storeId, currencyKey, tzKey, rangeKey, fromK, toK, combineK],
    queryFn: () => fetchSiteHomeStats(storeId as string, currency, storeTimezone, homeQuery),
    enabled: !!storeId,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData, previousQuery) => {
      const pk = previousQuery?.queryKey;
      if (
        !pk ||
        pk[1] !== storeId ||
        pk[2] !== currencyKey ||
        pk[3] !== tzKey ||
        pk[4] !== rangeKey ||
        pk[5] !== fromK ||
        pk[6] !== toK ||
        pk[7] !== combineK
      )
        return undefined;
      return previousData;
    },
  });
}
