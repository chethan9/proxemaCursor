import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient, deleteClient, getClients, getClient, updateClient, type Client } from "@/services/clientService";
import { getStoresByClient } from "@/services/storeService";
import { queryKeys } from "@/lib/query-client";

export function useClients() {
  return useQuery({
    queryKey: queryKeys.clients,
    queryFn: getClients,
    staleTime: 60_000,
  });
}

export function useClient(id: string | null | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.client(id) : ["clients", "none"],
    queryFn: () => getClient(id as string),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useClientsWithCounts() {
  return useQuery({
    queryKey: [...queryKeys.clients, "with-counts"] as const,
    queryFn: async () => {
      const clients = await getClients();
      const withCounts = await Promise.all(
        clients.map(async (c) => {
          const stores = await getStoresByClient(c.id);
          return { ...c, siteCount: stores.length };
        })
      );
      return withCounts;
    },
    staleTime: 60_000,
  });
}

export type ClientWithSiteCount = Client & { siteCount: number };

function useInvalidateClients() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.clients });
}

export function useCreateClient() {
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: (input: Parameters<typeof createClient>[0]) => createClient(input),
    onSuccess: invalidate,
  });
}

export function useUpdateClient() {
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateClient>[1] }) => updateClient(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteClient() {
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: invalidate,
  });
}