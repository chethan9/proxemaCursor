import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listActiveBulkJobs, listBulkJobs, subscribeToStoreBulkJobs, type BulkJob } from "@/services/bulkJobService";

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