import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchProducts, type FetchProductsOptions } from "@/services/productService";
import { queryKeys } from "@/lib/query-client";

export function useProducts(opts: FetchProductsOptions) {
  return useQuery({
    queryKey: queryKeys.products(opts.storeId, opts as unknown as Record<string, unknown>),
    queryFn: () => fetchProducts(opts),
    placeholderData: keepPreviousData,
    enabled: !!opts.storeId,
  });
}

export function useProductCategoryOptions(storeId: string) {
  return useQuery({
    queryKey: queryKeys.productCategoryOptions(storeId),
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("categories")
        .eq("store_id", storeId)
        .limit(500);
      const set = new Set<string>();
      (data || []).forEach((r: { categories: unknown }) => {
        if (Array.isArray(r.categories)) {
          r.categories.forEach((c: unknown) => {
            const obj = c as { name?: string };
            if (obj?.name) set.add(obj.name);
          });
        }
      });
      return Array.from(set).sort();
    },
    enabled: !!storeId,
    staleTime: 5 * 60_000,
  });
}