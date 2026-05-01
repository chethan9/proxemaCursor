import { useMemo } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fetchCustomers, fetchCustomerById, fetchLastOrdersForCustomer, fetchAllOrdersForCustomer, type FetchCustomersOptions, type CustomerRow } from "@/services/customerService";
import { useStoreSyncStatus } from "./useStoreSyncStatus";

export type UseCustomersOptions = Omit<FetchCustomersOptions, "page"> & {
  enabled?: boolean;
  /** Batch size per fetched chunk. Default 100. */
  pageSize?: number;
};

/**
 * Infinite-scroll hook for the customers list (same pattern as Orders / Products).
 */
export function useCustomers(opts: UseCustomersOptions) {
  const { enabled: enabledOverride, pageSize = 100, ...fetchOpts } = opts;
  const { data: syncStatus } = useStoreSyncStatus(fetchOpts.storeId);
  const initialSyncRunning = syncStatus ? !syncStatus.initialSyncDone : false;
  const anySyncRunning = syncStatus?.running || initialSyncRunning;

  const query = useInfiniteQuery({
    queryKey: [
      "customers",
      fetchOpts.storeId,
      { ...fetchOpts, pageSize } as Record<string, unknown>,
      initialSyncRunning ? "live" : "db",
      "infinite",
    ] as const,
    queryFn: async ({ pageParam = 0 }: { pageParam?: number }) => {
      if (initialSyncRunning) {
        try {
          return await fetchCustomers({ ...fetchOpts, pageSize, page: pageParam, useLive: true });
        } catch (e) {
          console.warn("[useCustomers] live fetch failed, falling back to DB:", e);
          return fetchCustomers({ ...fetchOpts, pageSize, page: pageParam, useLive: false });
        }
      }
      return fetchCustomers({ ...fetchOpts, pageSize, page: pageParam, useLive: false });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + p.data.length, 0);
      const total = lastPage.count ?? 0;
      if (lastPage.data.length === 0) return undefined;
      if (loaded >= total) return undefined;
      return allPages.length;
    },
    placeholderData: keepPreviousData,
    // Don't block the first customers fetch on sync-status query; start with DB mode immediately.
    enabled: !!fetchOpts.storeId && (enabledOverride ?? true),
    staleTime: anySyncRunning ? 10_000 : 120_000,
    gcTime: 10 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
    refetchInterval: anySyncRunning ? 8000 : false,
    retry: 1,
  });

  const data = useMemo<CustomerRow[]>(() => {
    if (!query.data) return [];
    const out: CustomerRow[] = [];
    for (const p of query.data.pages) {
      for (const r of p.data) out.push(r);
    }
    return out;
  }, [query.data]);

  const count = query.data?.pages[0]?.count ?? 0;

  return {
    data,
    count,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: !!query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isPlaceholderData: query.isPlaceholderData,
    refetch: query.refetch,
    error: query.error,
  };
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ["customer", id] as const,
    queryFn: () => fetchCustomerById(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useCustomerLastOrders(storeId: string, wooCustomerId: number | null | undefined, limit = 3) {
  return useQuery({
    queryKey: ["customer-last-orders", storeId, wooCustomerId, limit] as const,
    queryFn: () => fetchLastOrdersForCustomer(storeId, wooCustomerId ?? null, limit),
    enabled: !!storeId && !!wooCustomerId,
    staleTime: 60_000,
  });
}

export function useCustomerAllOrders(storeId: string, wooCustomerId: number | null | undefined, page: number, pageSize: number) {
  return useQuery({
    queryKey: ["customer-all-orders", storeId, wooCustomerId, page, pageSize] as const,
    queryFn: () => fetchAllOrdersForCustomer(storeId, wooCustomerId ?? null, page, pageSize),
    enabled: !!storeId && !!wooCustomerId,
    staleTime: 30_000,
  });
}
