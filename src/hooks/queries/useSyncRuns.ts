import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-client";

export interface SyncRunFilters {
  store?: string;
  status?: string;
  aspect?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface StoreOption { id: string; name: string; }

export function useSyncRuns(limit = 100) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["sync-runs", "recent", limit] as const,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_runs")
        .select("*, stores(name)")
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []).map((r) => ({
        ...r,
        store_name: (r.stores as { name: string } | null)?.name || r.store_id.substring(0, 8),
      }));
    },
    staleTime: 30_000,
    enabled: !!user,
  });
}

export function useStoreOptions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["stores", "id-name-list"] as const,
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("id, name").order("name");
      return (data || []) as StoreOption[];
    },
    staleTime: 5 * 60_000,
    enabled: !!user,
  });
}

export function useSyncRunsStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["sync-runs-stats"] as const,
    queryFn: async () => {
      const { data } = await supabase.from("sync_runs").select("status, records_processed");
      const rows = data || [];
      return {
        total: rows.length,
        completed: rows.filter((r) => r.status === "completed").length,
        failed: rows.filter((r) => r.status === "failed").length,
        running: rows.filter((r) => r.status === "running").length,
        totalRecords: rows.reduce((s, r) => s + (r.records_processed || 0), 0),
      };
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
    enabled: !!user,
  });
}

export function useSyncRunsPaged(
  page: number,
  pageSize: number,
  filters: SyncRunFilters,
  stores: StoreOption[],
  pollingMs: number | false,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["sync-runs", "paged", page, pageSize, filters, stores.length] as const,
    queryFn: async () => {
      let q = supabase
        .from("sync_runs")
        .select("*", { count: "exact" })
        .order("started_at", { ascending: false });
      if (filters.store && filters.store !== "all") q = q.eq("store_id", filters.store);
      if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
      if (filters.aspect && filters.aspect !== "all") q = q.eq("aspect", filters.aspect);
      if (filters.search) q = q.ilike("error_message", `%${filters.search}%`);
      if (filters.dateFrom) q = q.gte("started_at", filters.dateFrom);
      if (filters.dateTo) q = q.lte("started_at", filters.dateTo);
      q = q.range(page * pageSize, (page + 1) * pageSize - 1);
      const { data, count, error } = await q;
      if (error) throw error;
      const storeMap = new Map(stores.map((s) => [s.id, s.name]));
      return {
        data: (data || []).map((r) => ({
          ...r,
          store_name: storeMap.get(r.store_id) || r.store_id.substring(0, 8),
        })),
        count: count || 0,
      };
    },
    placeholderData: (prev) => prev,
    refetchInterval: pollingMs,
    enabled: !!user,
  });
}

export function useSyncRunsList(filters: SyncRunFilters, page: number, pageSize: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["sync-runs", "list", filters, page, pageSize] as const,
    queryFn: async () => {
      let q = supabase
        .from("sync_runs")
        .select("*, stores(name)", { count: "exact" })
        .order("started_at", { ascending: false });
      if (filters.store && filters.store !== "all") q = q.eq("store_id", filters.store);
      if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
      if (filters.aspect && filters.aspect !== "all") q = q.eq("aspect", filters.aspect);
      if (filters.search) q = q.ilike("error_message", `%${filters.search}%`);
      q = q.range(page * pageSize, (page + 1) * pageSize - 1);
      const { data, count, error } = await q;
      if (error) throw error;
      return {
        data: (data || []).map((r) => ({
          ...r,
          store_name: (r.stores as { name: string } | null)?.name || r.store_id.substring(0, 8),
        })),
        count: count || 0,
      };
    },
    placeholderData: (prev) => prev,
    // Poll every 5s if there's a running run
    refetchInterval: (query) => {
      const rows = (query.state.data as { data?: { status: string }[] } | undefined)?.data;
      return rows?.some((r) => r.status === "running") ? 5000 : false;
    },
    enabled: !!user,
  });
}

export function useSyncRunStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["sync-runs", "stats"] as const,
    queryFn: async () => {
      const { data } = await supabase.from("sync_runs").select("status, records_processed");
      const rows = data || [];
      return {
        total: rows.length,
        completed: rows.filter((r) => r.status === "completed").length,
        failed: rows.filter((r) => r.status === "failed").length,
        running: rows.filter((r) => r.status === "running").length,
        totalRecords: rows.reduce((s, r) => s + (r.records_processed || 0), 0),
      };
    },
    staleTime: 30_000,
    enabled: !!user,
  });
}

export function useStoresForFilter() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["stores", "id-name-list"] as const,
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("id, name").order("name");
      return data || [];
    },
    staleTime: 5 * 60_000,
    enabled: !!user,
  });
}