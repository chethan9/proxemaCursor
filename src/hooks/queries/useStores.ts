import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createStore, getStores, getStore, getStoresByClient, updateStore, deleteStore, type StoreWithClient, type Store } from "@/services/storeService";
import { queryKeys } from "@/lib/query-client";

export function useStores() {
  return useQuery({
    queryKey: queryKeys.stores,
    queryFn: getStores,
    staleTime: 60_000,
  });
}

export function useStore(id: string | null | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.store(id) : ["stores", "none"],
    queryFn: () => getStore(id as string),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useStoresByClient(clientId: string | null | undefined) {
  return useQuery({
    queryKey: clientId ? queryKeys.storesByClient(clientId) : ["stores", "by-client", "none"],
    queryFn: () => getStoresByClient(clientId as string),
    enabled: !!clientId,
  });
}

export function usePrefetchStore() {
  const qc = useQueryClient();
  return (id: string) => {
    qc.prefetchQuery({
      queryKey: queryKeys.store(id),
      queryFn: () => getStore(id),
      staleTime: 60_000,
    });
  };
}

function useInvalidateStores() {
  const qc = useQueryClient();
  return (id?: string) => {
    qc.invalidateQueries({ queryKey: queryKeys.stores });
    if (id) qc.invalidateQueries({ queryKey: queryKeys.store(id) });
  };
}

export function useCreateStore() {
  const invalidate = useInvalidateStores();
  return useMutation({
    mutationFn: (input: Parameters<typeof createStore>[0]) => createStore(input),
    onSuccess: (created) => invalidate(created?.id),
  });
}

export function useUpdateStore() {
  const invalidate = useInvalidateStores();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateStore>[1] }) => updateStore(id, patch),
    onSuccess: (_data, vars) => invalidate(vars.id),
  });
}

export function useDeleteStore() {
  const invalidate = useInvalidateStores();
  return useMutation({
    mutationFn: (id: string) => deleteStore(id),
    onSuccess: (_data, id) => invalidate(id),
  });
}

export type { StoreWithClient, Store };