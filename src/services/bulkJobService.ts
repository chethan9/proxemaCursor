import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/helpers";

export type BulkJob = Tables<"bulk_jobs">;

export type BulkJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export type BulkJobType =
  | "update_order_status"
  | "delete_orders"
  | "update_product_price"
  | "update_product_stock"
  | "update_product_status"
  | "assign_product_categories"
  | "delete_products";

export type BulkJobError = { id: number | string; error: string };

export type BulkJobPayload =
  | { type: "update_order_status"; order_ids: number[]; new_status: string }
  | { type: "delete_orders"; order_ids: number[]; force?: boolean }
  | { type: "update_product_price"; product_ids: number[]; operation: "set" | "increase_pct" | "decrease_pct" | "increase_fixed" | "decrease_fixed" | "set_sale"; value: number }
  | { type: "update_product_stock"; product_ids: number[]; operation: "set" | "adjust" | "set_status"; value?: number; stock_status?: "instock" | "outofstock" | "onbackorder" }
  | { type: "update_product_status"; product_ids: number[]; new_status: "publish" | "draft" | "pending" | "private" }
  | { type: "assign_product_categories"; product_ids: number[]; mode: "add" | "remove" | "replace"; category_ids: number[] }
  | { type: "delete_products"; product_ids: number[]; force?: boolean };

export async function createBulkJob(args: {
  store_id: string;
  job_type: BulkJobType;
  payload: BulkJobPayload;
  total: number;
}): Promise<BulkJob> {
  const { data: auth } = await supabase.auth.getUser();
  const insert: TablesInsert<"bulk_jobs"> = {
    store_id: args.store_id,
    user_id: auth.user?.id ?? null,
    job_type: args.job_type,
    payload: args.payload as unknown as TablesInsert<"bulk_jobs">["payload"],
    total: args.total,
    status: "pending",
  };
  const { data, error } = await supabase.from("bulk_jobs").insert(insert).select("*").single();
  if (error) throw error;
  return data;
}

export async function getBulkJob(id: string): Promise<BulkJob | null> {
  const { data, error } = await supabase.from("bulk_jobs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listBulkJobs(storeId: string, limit = 50): Promise<BulkJob[]> {
  const { data, error } = await supabase
    .from("bulk_jobs")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listActiveBulkJobs(): Promise<BulkJob[]> {
  const { data, error } = await supabase
    .from("bulk_jobs")
    .select("*")
    .in("status", ["pending", "running"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function cancelBulkJob(id: string): Promise<BulkJob> {
  const { data, error } = await supabase
    .from("bulk_jobs")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["pending", "running"])
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export function subscribeToBulkJob(
  id: string,
  onChange: (job: BulkJob) => void,
): () => void {
  const channel = supabase
    .channel(`bulk_job_${id}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "bulk_jobs", filter: `id=eq.${id}` },
      (payload) => onChange(payload.new as BulkJob),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToStoreBulkJobs(
  storeId: string,
  onChange: (job: BulkJob) => void,
): () => void {
  const channel = supabase
    .channel(`bulk_jobs_store_${storeId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "bulk_jobs", filter: `store_id=eq.${storeId}` },
      (payload) => {
        const next = (payload.new ?? payload.old) as BulkJob;
        onChange(next);
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export const JOB_TYPE_LABEL: Record<BulkJobType, string> = {
  update_order_status: "Update order status",
  delete_orders: "Delete orders",
  update_product_price: "Update product price",
  update_product_stock: "Update product stock",
  update_product_status: "Update product status",
  assign_product_categories: "Assign categories",
  delete_products: "Delete products",
};

export const ORDER_STATUS_OPTIONS = ["pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"] as const;