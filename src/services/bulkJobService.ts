import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/database.types";
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
  | "assign_product_tags"
  | "assign_product_brands"
  | "delete_products"
  | "print_invoices_bulk";

export type BulkJobError = { id: number | string; error: string };

function jobTypeToAction(t: BulkJobType): string | null {
  switch (t) {
    case "update_order_status":
    case "update_product_status": return "status_change";
    case "delete_orders":
    case "delete_products": return "delete";
    case "update_product_price": return "price_update";
    case "update_product_stock": return "stock_update";
    case "assign_product_categories": return "category_update";
    case "assign_product_tags": return "tag_update";
    case "assign_product_brands": return "brand_update";
    case "print_invoices_bulk": return null;
  }
}

function entityFromJobType(t: BulkJobType): "products" | "orders" | null {
  if (t === "update_order_status" || t === "delete_orders") return "orders";
  if (
    t.startsWith("update_product") ||
    t === "delete_products" ||
    t === "assign_product_categories" ||
    t === "assign_product_tags" ||
    t === "assign_product_brands"
  )
    return "products";
  return null;
}

function extractWooIds(payload: BulkJobPayload): number[] {
  if ("product_ids" in payload && Array.isArray(payload.product_ids)) return payload.product_ids;
  if ("order_ids" in payload && Array.isArray(payload.order_ids) && payload.order_ids.length > 0 && typeof payload.order_ids[0] === "number") {
    return payload.order_ids as number[];
  }
  return [];
}

export type BulkJobPayload =
  | { type: "update_order_status"; order_ids: number[]; new_status: string }
  | { type: "delete_orders"; order_ids: number[]; force?: boolean }
  | { type: "update_product_price"; product_ids: number[]; operation: "set" | "increase_pct" | "decrease_pct" | "increase_fixed" | "decrease_fixed" | "set_sale"; value: number }
  | { type: "update_product_stock"; product_ids: number[]; operation: "set" | "adjust" | "set_status"; value?: number; stock_status?: "instock" | "outofstock" | "onbackorder" }
  | { type: "update_product_status"; product_ids: number[]; new_status: "publish" | "draft" | "pending" | "private" }
  | { type: "assign_product_categories"; product_ids: number[]; mode: "add" | "remove" | "replace"; category_ids: number[] }
  | { type: "assign_product_tags"; product_ids: number[]; mode: "add" | "remove" | "replace"; tag_ids: number[] }
  | { type: "assign_product_brands"; product_ids: number[]; mode: "add" | "remove" | "replace"; brand_ids: number[] }
  | { type: "delete_products"; product_ids: number[]; force?: boolean }
  | { type: "print_invoices_bulk"; order_ids: string[]; template_id: string; output_mode: "single-pdf" | "zip"; artifact_path?: string; compress?: boolean };

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

  try {
    const action = jobTypeToAction(args.job_type);
    const entity = entityFromJobType(args.job_type);
    const ids = extractWooIds(args.payload);
    if (action && entity && ids.length > 0) {
      await supabase
        .from(entity)
        .update({
          pending_action: action,
          pending_job_id: data.id,
          pending_at: new Date().toISOString(),
        })
        .eq("store_id", args.store_id)
        .in("woo_id", ids)
        .is("pending_action", null);
    }
  } catch (lockErr) {
    console.warn("[bulkJob] failed to set pending locks:", lockErr);
  }

  return data;
}

export async function getBulkJob(id: string): Promise<BulkJob | null> {
  const { data, error } = await supabase.from("bulk_jobs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listBulkJobs(storeId: string, limit = 50): Promise<BulkJob[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("bulk_jobs")
    .select("*")
    .eq("store_id", storeId)
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listActiveBulkJobs(): Promise<BulkJob[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("bulk_jobs")
    .select("*")
    .eq("user_id", uid)
    .in("status", ["pending", "running"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function cancelBulkJob(id: string): Promise<BulkJob> {
  const existing = await getBulkJob(id);
  const prevPayload =
    existing?.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
      ? { ...(existing.payload as Record<string, unknown>) }
      : {};
  const merged = { ...prevPayload, cancelled_by: "user" as const };
  const { data, error } = await supabase
    .from("bulk_jobs")
    .update({
      status: "cancelled",
      completed_at: new Date().toISOString(),
      payload: merged as Json,
    })
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

export function subscribeToStoreBulkJobs(storeId: string, onChange: () => void): () => void {
  const uniq = Math.random().toString(36).slice(2, 10);
  const channel = supabase
    .channel(`bulk_jobs_store_${storeId}_${uniq}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "bulk_jobs", filter: `store_id=eq.${storeId}` },
      () => onChange()
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export const JOB_TYPE_LABEL: Record<BulkJobType, string> = {
  update_order_status: "Update order status",
  delete_orders: "Delete orders",
  update_product_price: "Update product price",
  update_product_stock: "Update product stock",
  update_product_status: "Update product status",
  assign_product_categories: "Assign categories",
  assign_product_tags: "Assign tags",
  assign_product_brands: "Assign brands",
  delete_products: "Delete products",
  print_invoices_bulk: "Print invoices",
};

export const ORDER_STATUS_OPTIONS = ["pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed"] as const;

export async function retryFailedBulkJobItems(jobId: string, opts?: { force?: boolean }): Promise<BulkJob> {
  const orig = await getBulkJob(jobId);
  if (!orig) throw new Error("Original job not found");
  const errors = Array.isArray(orig.errors) ? (orig.errors as unknown as BulkJobError[]) : [];
  const failedIds = errors.map((e) => (typeof e.id === "string" ? Number(e.id) : e.id)).filter((n) => Number.isFinite(n)) as number[];
  if (failedIds.length === 0) throw new Error("No failed items to retry");

  const origPayload = (orig.payload ?? {}) as Record<string, unknown>;
  const jobType = orig.job_type as BulkJobType;
  const idKey = jobType === "update_order_status" || jobType === "delete_orders" ? "order_ids" : "product_ids";

  const newPayload: Record<string, unknown> = { ...origPayload, [idKey]: failedIds };
  if (opts?.force !== undefined && (jobType === "delete_products" || jobType === "delete_orders")) {
    newPayload.force = opts.force;
  }

  return createBulkJob({
    store_id: orig.store_id,
    job_type: jobType,
    payload: newPayload as unknown as BulkJobPayload,
    total: failedIds.length,
  });
}