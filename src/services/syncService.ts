import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type SyncRun = Tables<"sync_runs">;
export type SyncRunInsert = TablesInsert<"sync_runs">;

export type SyncAspect =
  | "products"
  | "variations"
  | "categories"
  | "orders"
  | "customers"
  | "coupons"
  | "all";

export interface SyncRunWithStore extends SyncRun {
  store_name: string;
  store_url: string;
}

export async function getSyncRuns(limit = 50): Promise<SyncRunWithStore[]> {
  const { data, error } = await supabase
    .from("sync_runs")
    .select("*, stores(name, url)")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching sync runs:", error);
    throw error;
  }

  return (data || []).map((run) => ({
    ...run,
    store_name: (run.stores as { name: string; url: string } | null)?.name || "Unknown",
    store_url: (run.stores as { name: string; url: string } | null)?.url || "",
    stores: undefined,
  })) as SyncRunWithStore[];
}

export async function getSyncRunsByStore(storeId: string): Promise<SyncRun[]> {
  const { data, error } = await supabase
    .from("sync_runs")
    .select("*")
    .eq("store_id", storeId)
    .order("started_at", { ascending: false });

  if (error) {
    console.error("Error fetching sync runs:", error);
    throw error;
  }

  return data || [];
}

export async function getSyncRun(id: string): Promise<SyncRun | null> {
  const { data, error } = await supabase
    .from("sync_runs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching sync run:", error);
    return null;
  }

  return data;
}

export async function createSyncRun(run: SyncRunInsert): Promise<SyncRun> {
  const { data, error } = await supabase
    .from("sync_runs")
    .insert(run)
    .select()
    .single();

  if (error) {
    console.error("Error creating sync run:", error);
    throw error;
  }

  return data;
}

export async function completeSyncRun(
  id: string,
  result: {
    status: "completed" | "failed";
    records_processed?: number;
    records_created?: number;
    records_updated?: number;
    error_message?: string;
  }
): Promise<SyncRun> {
  const { data, error } = await supabase
    .from("sync_runs")
    .update({
      ...result,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error completing sync run:", error);
    throw error;
  }

  return data;
}

export async function getRecentSyncStats(storeId: string) {
  const { data, error } = await supabase
    .from("sync_runs")
    .select("aspect, status, records_processed")
    .eq("store_id", storeId)
    .order("started_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error fetching sync stats:", error);
    return null;
  }

  const stats = {
    total: data.length,
    completed: data.filter((r) => r.status === "completed").length,
    failed: data.filter((r) => r.status === "failed").length,
    running: data.filter((r) => r.status === "running").length,
    totalRecords: data.reduce((sum, r) => sum + (r.records_processed || 0), 0),
  };

  return stats;
}