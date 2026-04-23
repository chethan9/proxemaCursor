import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchCustomers, fetchCustomerById, fetchLastOrdersForCustomer, fetchAllOrdersForCustomer, type FetchCustomersOptions } from "@/services/customerService";
import { useStoreSyncStatus } from "./useStoreSyncStatus";

export function useCustomers(opts: FetchCustomersOptions) {
  const { data: syncStatus } = useStoreSyncStatus(opts.storeId);
  const anySyncRunning = syncStatus?.running || (syncStatus ? !syncStatus.initialSyncDone : false);
  return useQuery({
    queryKey: ["customers", opts.storeId, opts] as const,
    queryFn: () => fetchCustomers(opts),
    placeholderData: keepPreviousData,
    enabled: !!opts.storeId,
    refetchOnWindowFocus: true,
    refetchInterval: anySyncRunning ? 5000 : false,
    retry: 1,
  });
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