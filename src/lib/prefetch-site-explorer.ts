import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import { fetchOrders } from "@/services/orderService";
import { fetchProducts } from "@/services/productService";
import { fetchCustomers } from "@/services/customerService";
import { fetchCategories, fetchTags, fetchBrands } from "@/services/taxonomyService";
import { fetchStoreSyncStatus } from "@/hooks/queries/useStoreSyncStatus";

const DEFAULT_PAGE_SIZE = 100;

type PageChunk = { data: unknown[]; count?: number };

function listInfiniteNextPageParam(lastPage: PageChunk, allPages: PageChunk[]): number | undefined {
  const loaded = allPages.reduce((acc, p) => acc + p.data.length, 0);
  const total = lastPage.count ?? 0;
  if (lastPage.data.length === 0) return undefined;
  if (loaded >= total) return undefined;
  return allPages.length;
}

/** Matches default explorer filters when URL/query prefs are at defaults (see OrdersTab / ProductsTab / TaxonomyTab). */
export async function warmSiteExplorerPrefetch(queryClient: QueryClient, storeId: string, section: string): Promise<void> {
  await queryClient.ensureQueryData({
    queryKey: ["store-sync-status", storeId] as const,
    queryFn: () => fetchStoreSyncStatus(storeId),
    staleTime: 4_000,
  });

  const sync = queryClient.getQueryData<{ initialSyncDone: boolean; running: boolean }>(["store-sync-status", storeId]);
  const initialSyncRunning = sync ? !sync.initialSyncDone : false;
  const mode: "live" | "db" = initialSyncRunning ? "live" : "db";

  if (section === "orders") {
    const fetchOpts = {
      storeId,
      search: "",
      sortField: "date_created" as const,
      sortDirection: "desc" as const,
      statusFilter: "all",
      paymentMethodFilter: "all",
      totalMin: undefined as number | undefined,
      totalMax: undefined as number | undefined,
      dateFrom: undefined as string | undefined,
      dateTo: undefined as string | undefined,
    };
    const pageSize = DEFAULT_PAGE_SIZE;
    const keyFilter = { ...fetchOpts, pageSize };
    await queryClient.prefetchInfiniteQuery({
      queryKey: [
        ...queryKeys.orders(storeId, keyFilter as unknown as Record<string, unknown>),
        mode,
        "infinite",
      ] as const,
      initialPageParam: 0,
      queryFn: async ({ pageParam }: { pageParam: number }) => {
        if (mode === "live") {
          try {
            return await fetchOrders({ ...fetchOpts, pageSize, page: pageParam, useLive: true });
          } catch {
            return fetchOrders({ ...fetchOpts, pageSize, page: pageParam, useLive: false });
          }
        }
        return fetchOrders({ ...fetchOpts, pageSize, page: pageParam, useLive: false });
      },
      getNextPageParam: listInfiniteNextPageParam,
    });
    return;
  }

  if (section === "products") {
    const fetchOpts = {
      storeId,
      search: "",
      sortField: "woo_date_created" as const,
      sortDirection: "desc" as const,
      statusFilter: "all",
      excludeOutOfStock: false,
      categoryFilter: undefined as string | undefined,
      stockStatusFilter: "all",
      priceMin: undefined as number | undefined,
      priceMax: undefined as number | undefined,
      productTypeFilter: undefined as "simple" | "variable" | undefined,
    };
    const pageSize = DEFAULT_PAGE_SIZE;
    const keyFilter = { ...fetchOpts, pageSize };
    await queryClient.prefetchInfiniteQuery({
      queryKey: [
        ...queryKeys.products(storeId, keyFilter as unknown as Record<string, unknown>),
        mode,
        "infinite",
      ] as const,
      initialPageParam: 0,
      queryFn: async ({ pageParam }: { pageParam: number }) => {
        if (mode === "live") {
          try {
            return await fetchProducts({ ...fetchOpts, pageSize, page: pageParam, useLive: true });
          } catch {
            return fetchProducts({ ...fetchOpts, pageSize, page: pageParam, useLive: false });
          }
        }
        return fetchProducts({ ...fetchOpts, pageSize, page: pageParam, useLive: false });
      },
      getNextPageParam: listInfiniteNextPageParam,
    });
    return;
  }

  if (section === "customers") {
    const fetchOpts = {
      storeId,
      search: "",
      sortField: "date_created" as const,
      sortDirection: "desc" as const,
    };
    const pageSize = DEFAULT_PAGE_SIZE;
    const keyFilter = { ...fetchOpts, pageSize };
    await queryClient.prefetchInfiniteQuery({
      queryKey: ["customers", storeId, keyFilter as Record<string, unknown>, mode, "infinite"] as const,
      initialPageParam: 0,
      queryFn: async ({ pageParam }: { pageParam: number }) => {
        if (mode === "live") {
          try {
            return await fetchCustomers({ ...fetchOpts, pageSize, page: pageParam, useLive: true });
          } catch {
            return fetchCustomers({ ...fetchOpts, pageSize, page: pageParam, useLive: false });
          }
        }
        return fetchCustomers({ ...fetchOpts, pageSize, page: pageParam, useLive: false });
      },
      getNextPageParam: listInfiniteNextPageParam,
    });
    return;
  }

  if (section === "categories" || section === "tags" || section === "brands") {
    const modeTax = section === "categories" ? "categories" : section === "tags" ? "tags" : "brands";
    const search = "";
    const pageSize = DEFAULT_PAGE_SIZE;
    const sortField = "name" as const;
    const sortDirection = "asc" as const;
    await queryClient.prefetchInfiniteQuery({
      queryKey: ["taxonomy", modeTax, storeId, "infinite", search, pageSize, sortField, sortDirection] as const,
      initialPageParam: 0,
      queryFn: async ({ pageParam }: { pageParam: number }) => {
        if (modeTax === "categories") return fetchCategories(storeId, search, pageParam, pageSize, sortField, sortDirection);
        if (modeTax === "tags") return fetchTags(storeId, search, pageParam, pageSize, sortField, sortDirection);
        return fetchBrands(storeId, search, pageParam, pageSize, sortField, sortDirection);
      },
      getNextPageParam: listInfiniteNextPageParam,
    });
  }
}
