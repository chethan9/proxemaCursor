import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAttributes,
  createAttribute,
  listAttributeTerms,
  createAttributeTerm,
  deleteAttributeTerm,
  WooAttribute,
  WooAttributeTerm,
} from "@/services/wooAttributeService";

export function useWooAttributes(storeId: string) {
  return useQuery({
    queryKey: ["woo", "attributes", storeId] as const,
    queryFn: () => listAttributes(storeId),
    enabled: !!storeId,
    staleTime: 5 * 60_000,
  });
}

export function useWooAttributeTerms(storeId: string, attributeId: number | null) {
  return useQuery({
    queryKey: ["woo", "attributes", storeId, attributeId, "terms"] as const,
    queryFn: () => listAttributeTerms(storeId, attributeId!),
    enabled: !!storeId && !!attributeId,
    staleTime: 5 * 60_000,
  });
}

export function useCreateWooAttribute(storeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof createAttribute>[1]) => createAttribute(storeId, payload),
    onSuccess: (attr: WooAttribute) => {
      qc.invalidateQueries({ queryKey: ["woo", "attributes", storeId] });
      return attr;
    },
  });
}

export function useCreateWooAttributeTerm(storeId: string, attributeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof createAttributeTerm>[2]) => createAttributeTerm(storeId, attributeId, payload),
    onSuccess: (term: WooAttributeTerm) => {
      qc.invalidateQueries({ queryKey: ["woo", "attributes", storeId, attributeId, "terms"] });
      return term;
    },
  });
}

export function useDeleteWooAttributeTerm(storeId: string, attributeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (termId: number) => deleteAttributeTerm(storeId, attributeId, termId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["woo", "attributes", storeId, attributeId, "terms"] }),
  });
}