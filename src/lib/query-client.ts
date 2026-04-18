import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2 * 60_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        retry: 1,
      },
    },
  });
}

export const queryKeys = {
  all: ["all"] as const,
  stores: ["stores"] as const,
  store: (id: string) => ["stores", id] as const,
  storesByClient: (clientId: string) => ["stores", "by-client", clientId] as const,
  products: (storeId: string, filters?: Record<string, unknown>) =>
    filters === undefined ? (["stores", storeId, "products"] as const) : (["stores", storeId, "products", filters] as const),
  productCategoryOptions: (storeId: string) => ["stores", storeId, "products", "category-options"] as const,
  orders: (storeId: string, filters?: Record<string, unknown>) =>
    filters === undefined ? (["stores", storeId, "orders"] as const) : (["stores", storeId, "orders", filters] as const),
  orderPaymentOptions: (storeId: string) => ["stores", storeId, "orders", "payment-options"] as const,
  paymentMethods: ["payment-methods"] as const,
  syncRuns: (storeId: string) => ["stores", storeId, "sync-runs"] as const,
  webhooks: (storeId: string) => ["stores", storeId, "webhooks"] as const,
  clients: ["clients"] as const,
  client: (id: string) => ["clients", id] as const,
  taxonomy: (storeId: string, type: "categories" | "tags") => ["stores", storeId, "taxonomy", type] as const,
  viewPrefs: (key: string) => ["view-prefs", key] as const,
};