import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UptimePoint {
  status: string;
  started_at: string;
}

const BARS = 14;

export function useSitesUptime(storeIds: string[]) {
  const key = storeIds.slice().sort().join(",");
  return useQuery<Record<string, UptimePoint[]>>({
    queryKey: ["sites-uptime", key],
    queryFn: async () => {
      if (storeIds.length === 0) return {};
      const { data, error } = await supabase
        .from("sync_runs")
        .select("store_id, status, started_at")
        .in("store_id", storeIds)
        .order("started_at", { ascending: false })
        .limit(BARS * storeIds.length);
      if (error) throw error;
      const map: Record<string, UptimePoint[]> = {};
      for (const row of data || []) {
        const sid = row.store_id as string;
        if (!map[sid]) map[sid] = [];
        if (map[sid].length < BARS) {
          map[sid].push({
            status: String(row.status ?? "unknown"),
            started_at: String(row.started_at ?? ""),
          });
        }
      }
      return map;
    },
    enabled: storeIds.length > 0,
    staleTime: 60_000,
  });
}