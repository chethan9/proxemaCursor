import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listTaxonomy, createTaxonomy, TaxonomyKind, WooTerm } from "@/services/wooTaxonomyService";

export function useWooTaxonomy(storeId: string, kind: TaxonomyKind, enabled = true) {
  return useQuery({
    queryKey: ["woo", "taxonomy", storeId, kind] as const,
    queryFn: () => listTaxonomy(storeId, kind),
    enabled: enabled && !!storeId,
    staleTime: 5 * 60_000,
    retry: (count, err) => {
      if ((err as Error & { brandsUnavailable?: boolean }).brandsUnavailable) return false;
      return count < 2;
    },
  });
}

export function useCreateWooTaxonomy(storeId: string, kind: TaxonomyKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof createTaxonomy>[2]) => createTaxonomy(storeId, kind, payload),
    onSuccess: (term: WooTerm) => {
      qc.invalidateQueries({ queryKey: ["woo", "taxonomy", storeId, kind] });
      return term;
    },
  });
}