import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAttributes,
  createAttribute,
  getAttribute,
  updateAttribute,
  deleteAttribute,
  listAttributeTerms,
  createAttributeTerm,
  updateAttributeTerm,
  deleteAttributeTerm,
  WooAttribute,
} from "@/services/wooAttributeService";
import { queryKeys } from "@/lib/query-client";
import { useStoreSyncStatus } from "@/hooks/queries/useStoreSyncStatus";

export function useWooAttributes(storeId: string) {
  const { data: syncStatus } = useStoreSyncStatus(storeId);
  const poll = syncStatus?.running || (syncStatus ? !syncStatus.initialSyncDone : false);
  return useQuery({
    queryKey: ["woo", "attributes", storeId] as const,
    queryFn: () => listAttributes(storeId),
    enabled: !!storeId,
    staleTime: 5 * 60_000,
    refetchInterval: poll ? 5000 : false,
  });
}

export function useWooAttribute(storeId: string, attributeId: number | null) {
  const { data: syncStatus } = useStoreSyncStatus(storeId);
  const poll = syncStatus?.running || (syncStatus ? !syncStatus.initialSyncDone : false);
  return useQuery({
    queryKey: ["woo", "attributes", storeId, attributeId] as const,
    queryFn: () => getAttribute(storeId, attributeId!),
    enabled: !!storeId && attributeId !== null && !Number.isNaN(attributeId),
    staleTime: 5 * 60_000,
    refetchInterval: poll ? 5000 : false,
  });
}

export function useWooAttributeTerms(storeId: string, attributeId: number | null) {
  const { data: syncStatus } = useStoreSyncStatus(storeId);
  const poll = syncStatus?.running || (syncStatus ? !syncStatus.initialSyncDone : false);
  return useQuery({
    queryKey: ["woo", "attributes", storeId, attributeId, "terms"] as const,
    queryFn: () => listAttributeTerms(storeId, attributeId!),
    enabled: !!storeId && !!attributeId,
    staleTime: 5 * 60_000,
    refetchInterval: poll ? 5000 : false,
  });
}

export function useCreateWooAttribute(storeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof createAttribute>[1]) => createAttribute(storeId, payload),
    onSuccess: (attr: WooAttribute) => {
      qc.invalidateQueries({ queryKey: ["woo", "attributes", storeId] });
      qc.invalidateQueries({ queryKey: queryKeys.products(storeId) });
      return attr;
    },
  });
}

export function useUpdateWooAttribute(storeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ attributeId, payload }: { attributeId: number; payload: Parameters<typeof updateAttribute>[2] }) =>
      updateAttribute(storeId, attributeId, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["woo", "attributes", storeId] });
      qc.invalidateQueries({ queryKey: ["woo", "attributes", storeId, vars.attributeId] });
      qc.invalidateQueries({ queryKey: queryKeys.products(storeId) });
    },
  });
}

export function useDeleteWooAttribute(storeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attributeId: number) => deleteAttribute(storeId, attributeId),
    onSuccess: (_void, attributeId) => {
      qc.invalidateQueries({ queryKey: ["woo", "attributes", storeId] });
      qc.removeQueries({ queryKey: ["woo", "attributes", storeId, attributeId] });
      qc.removeQueries({ queryKey: ["woo", "attributes", storeId, attributeId, "terms"] });
      qc.invalidateQueries({ queryKey: queryKeys.products(storeId) });
    },
  });
}

export function useCreateWooAttributeTerm(storeId: string, attributeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof createAttributeTerm>[2]) => createAttributeTerm(storeId, attributeId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["woo", "attributes", storeId, attributeId, "terms"] });
      qc.invalidateQueries({ queryKey: ["woo", "attributes", storeId] });
      qc.invalidateQueries({ queryKey: queryKeys.products(storeId) });
    },
  });
}

export function useUpdateWooAttributeTerm(storeId: string, attributeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      termId,
      payload,
    }: {
      termId: number;
      payload: Parameters<typeof updateAttributeTerm>[3];
    }) => updateAttributeTerm(storeId, attributeId, termId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["woo", "attributes", storeId, attributeId, "terms"] });
      qc.invalidateQueries({ queryKey: ["woo", "attributes", storeId] });
      qc.invalidateQueries({ queryKey: queryKeys.products(storeId) });
    },
  });
}

export function useDeleteWooAttributeTerm(storeId: string, attributeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (termId: number) => deleteAttributeTerm(storeId, attributeId, termId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["woo", "attributes", storeId, attributeId, "terms"] });
      qc.invalidateQueries({ queryKey: ["woo", "attributes", storeId] });
      qc.invalidateQueries({ queryKey: queryKeys.products(storeId) });
    },
  });
}
