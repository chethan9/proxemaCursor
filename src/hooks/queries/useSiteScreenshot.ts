import { useQuery } from "@tanstack/react-query";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function useSiteScreenshot(storeId: string) {
  return useQuery({
    queryKey: ["site-screenshot", storeId],
    queryFn: async () => {
      const res = await fetch(`/api/stores/${storeId}/screenshot`);
      if (!res.ok) throw new Error("Failed to load screenshot");
      return (await res.json()) as { url: string; cached: boolean; stale?: boolean };
    },
    staleTime: SEVEN_DAYS_MS,
    gcTime: SEVEN_DAYS_MS,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}