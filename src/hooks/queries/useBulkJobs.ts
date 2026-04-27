import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listActiveBulkJobs, listBulkJobs, subscribeToStoreBulkJobs, type BulkJob } from "@/services/bulkJobService";
import { supabase } from "@/integrations/supabase/client";

export function useActiveBulkJobs() {
  return useQuery({
    queryKey: ["bulk-jobs", "active"],
    queryFn: listActiveBulkJobs,
    refetchInterval: (q) => {
      const data = q.state.data as BulkJob[] | undefined;
      return data && data.length > 0 ? 2000 : 8000;
    },
    staleTime: 0,
  });
}

export function useStoreBulkJobs(storeId: string | null | undefined, limit = 50) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["bulk-jobs", "store", storeId, limit],
    queryFn: () => listBulkJobs(storeId as string, limit),
    enabled: !!storeId,
    staleTime: 0,
    refetchInterval: (q) => {
      const data = q.state.data as BulkJob[] | undefined;
      if (!data) return 5000;
      const running = data.some((j) => j.status === "pending" || j.status === "running");
      return running ? 2000 : 15000;
    },
  });

  useEffect(() => {
    if (!storeId) return;
    const off = subscribeToStoreBulkJobs(storeId, () => {
      qc.invalidateQueries({ queryKey: ["bulk-jobs", "store", storeId] });
      qc.invalidateQueries({ queryKey: ["bulk-jobs", "active"] });
    });
    return off;
  }, [storeId, qc]);

  return query;
}

export function useRecentCompletedPrintJobs() {
  return useQuery({
    queryKey: ["bulk-jobs", "completed-print"],
    queryFn: async (): Promise<BulkJob[]> => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return [];
      const since = new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString();
      const { data, error } = await supabase
        .from("bulk_jobs")
        .select("*")
        .eq("user_id", uid)
        .eq("job_type", "print_invoices_bulk")
        .eq("status", "completed")
        .gte("completed_at", since)
        .order("completed_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []).filter((j) => {
        const p = j.payload as { artifact_path?: string } | null;
        return !!p?.artifact_path;
      });
    },
    refetchInterval: 5000,
    staleTime: 0,
  });
}