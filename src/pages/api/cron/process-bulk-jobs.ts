import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getStoreCreds, wooRequest, type WooStoreCreds } from "@/lib/woo-client";
import type { Json } from "@/integrations/supabase/database.types";
import type { TablesUpdate } from "@/integrations/supabase/types";

// Budget per invocation: leave headroom under Vercel's function timeout.
const MAX_RUNTIME_MS = 50_000;
const BATCH_SIZE = 10;        // process 10 items per batch
const CONCURRENCY = 2;        // 2 parallel WooCommerce requests

type JobRow = {
  id: string;
  store_id: string;
  job_type: string;
  payload: Json;
  status: string;
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors: Json;
  started_at: string | null;
};

type ItemError = { id: number | string; error: string };

type BulkJobUpdate = TablesUpdate<"bulk_jobs">;

function toJson<T>(v: T): Json {
  return JSON.parse(JSON.stringify(v)) as Json;
}

async function chunkParallel<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const slice = items.slice(i, i + size);
    const results = await Promise.all(slice.map(fn));
    out.push(...results);
  }
  return out;
}

async function checkCancelled(jobId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("bulk_jobs")
    .select("status")
    .eq("id", jobId)
    .single();
  return data?.status === "cancelled";
}

async function saveProgress(
  jobId: string,
  processed: number,
  succeeded: number,
  failed: number,
  errors: ItemError[],
) {
  const payload: BulkJobUpdate = {
    processed,
    succeeded,
    failed,
    errors: toJson(errors),
  };
  await supabaseAdmin.from("bulk_jobs").update(payload).eq("id", jobId);
}

// --- Job handlers ----------------------------------------------------------

async function updateOrderStatus(
  store: WooStoreCreds,
  orderId: number,
  newStatus: string,
) {
  await wooRequest(store, "PUT", `orders/${orderId}`, { status: newStatus });
  // Update local mirror
  await supabaseAdmin
    .from("orders")
    .update({ status: newStatus, synced_at: new Date().toISOString() })
    .eq("store_id", store.id)
    .eq("woo_id", orderId);
}

async function deleteOrder(store: WooStoreCreds, orderId: number, force = false) {
  await wooRequest(store, "DELETE", `orders/${orderId}${force ? "?force=true" : ""}`);
  await supabaseAdmin
    .from("orders")
    .delete()
    .eq("store_id", store.id)
    .eq("woo_id", orderId);
}

async function updateProductPrice(
  store: WooStoreCreds,
  productId: number,
  operation: string,
  value: number,
) {
  // Fetch current price first for relative operations
  let newRegularPrice: string | undefined;
  let newSalePrice: string | undefined;
  if (operation === "set") {
    newRegularPrice = String(value);
  } else if (operation === "set_sale") {
    newSalePrice = String(value);
  } else {
    const current = await wooRequest<{ regular_price?: string }>(store, "GET", `products/${productId}`);
    const curPrice = parseFloat(current.regular_price || "0") || 0;
    let next = curPrice;
    if (operation === "increase_pct") next = curPrice * (1 + value / 100);
    else if (operation === "decrease_pct") next = curPrice * (1 - value / 100);
    else if (operation === "increase_fixed") next = curPrice + value;
    else if (operation === "decrease_fixed") next = curPrice - value;
    newRegularPrice = next.toFixed(2);
  }
  const body: Record<string, unknown> = {};
  if (newRegularPrice !== undefined) body.regular_price = newRegularPrice;
  if (newSalePrice !== undefined) body.sale_price = newSalePrice;
  const updated = await wooRequest<{ price?: string; regular_price?: string; sale_price?: string }>(store, "PUT", `products/${productId}`, body);
  await supabaseAdmin
    .from("products")
    .update({
      price: (updated.price ?? newRegularPrice ?? null) as unknown as number | null,
      regular_price: (updated.regular_price ?? newRegularPrice ?? null) as unknown as number | null,
      sale_price: (updated.sale_price ?? newSalePrice ?? null) as unknown as number | null,
      synced_at: new Date().toISOString(),
    })
    .eq("store_id", store.id)
    .eq("woo_id", productId);
}

async function updateProductStock(
  store: WooStoreCreds,
  productId: number,
  operation: string,
  value: number | undefined,
  stockStatus: string | undefined,
) {
  const body: Record<string, unknown> = {};
  if (operation === "set") {
    body.manage_stock = true;
    body.stock_quantity = value;
  } else if (operation === "adjust") {
    const current = await wooRequest<{ stock_quantity?: number | null }>(store, "GET", `products/${productId}`);
    body.manage_stock = true;
    body.stock_quantity = (current.stock_quantity ?? 0) + (value ?? 0);
  } else if (operation === "set_status") {
    body.stock_status = stockStatus;
  }
  const updated = await wooRequest<{ stock_quantity?: number | null; stock_status?: string; manage_stock?: boolean }>(store, "PUT", `products/${productId}`, body);
  await supabaseAdmin
    .from("products")
    .update({
      stock_quantity: updated.stock_quantity ?? null,
      stock_status: updated.stock_status ?? null,
      synced_at: new Date().toISOString(),
    })
    .eq("store_id", store.id)
    .eq("woo_id", productId);
}

async function updateProductStatus(store: WooStoreCreds, productId: number, newStatus: string) {
  await wooRequest(store, "PUT", `products/${productId}`, { status: newStatus });
  await supabaseAdmin
    .from("products")
    .update({ status: newStatus, synced_at: new Date().toISOString() })
    .eq("store_id", store.id)
    .eq("woo_id", productId);
}

async function assignProductCategories(
  store: WooStoreCreds,
  productId: number,
  mode: string,
  categoryIds: number[],
) {
  const current = await wooRequest<{ categories?: { id: number }[] }>(store, "GET", `products/${productId}`);
  const currentIds = new Set((current.categories ?? []).map((c) => c.id));
  let nextIds: number[];
  if (mode === "add") {
    categoryIds.forEach((id) => currentIds.add(id));
    nextIds = Array.from(currentIds);
  } else if (mode === "remove") {
    categoryIds.forEach((id) => currentIds.delete(id));
    nextIds = Array.from(currentIds);
  } else {
    nextIds = categoryIds;
  }
  const body = { categories: nextIds.map((id) => ({ id })) };
  const updated = await wooRequest<{ categories?: unknown[] }>(store, "PUT", `products/${productId}`, body);
  await supabaseAdmin
    .from("products")
    .update({
      categories: (updated.categories ?? []) as unknown as Json,
      synced_at: new Date().toISOString(),
    })
    .eq("store_id", store.id)
    .eq("woo_id", productId);
}

async function deleteProduct(store: WooStoreCreds, productId: number, force = false) {
  await wooRequest(store, "DELETE", `products/${productId}${force ? "?force=true" : ""}`);
  await supabaseAdmin.from("products").delete().eq("store_id", store.id).eq("woo_id", productId);
}

// --- Main processor --------------------------------------------------------

async function processJob(job: JobRow, deadline: number): Promise<"done" | "partial" | "cancelled"> {
  const store = await getStoreCreds(job.store_id);
  if (!store) {
    const payload: BulkJobUpdate = {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: "Store credentials unavailable",
    };
    await supabaseAdmin.from("bulk_jobs").update(payload).eq("id", job.id);
    return "done";
  }

  // Mark running if still pending
  if (job.status === "pending") {
    const payload: BulkJobUpdate = {
      status: "running",
      started_at: new Date().toISOString(),
    };
    await supabaseAdmin.from("bulk_jobs").update(payload).eq("id", job.id);
  }

  const payload = job.payload as Record<string, unknown>;
  const existingErrors: ItemError[] = Array.isArray(job.errors)
    ? (job.errors as unknown as ItemError[])
    : [];

  let processed = job.processed;
  let succeeded = job.succeeded;
  let failed = job.failed;
  const errors: ItemError[] = [...existingErrors];

  // Extract item list per job_type
  let itemIds: number[] = [];
  if (job.job_type === "update_order_status" || job.job_type === "delete_orders") {
    itemIds = (payload.order_ids as number[]) ?? [];
  } else if (
    job.job_type === "update_product_price" ||
    job.job_type === "update_product_stock" ||
    job.job_type === "update_product_status" ||
    job.job_type === "assign_product_categories" ||
    job.job_type === "delete_products"
  ) {
    itemIds = (payload.product_ids as number[]) ?? [];
  } else {
    const p: BulkJobUpdate = {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: `Unsupported job_type: ${job.job_type}`,
    };
    await supabaseAdmin.from("bulk_jobs").update(p).eq("id", job.id);
    return "done";
  }

  // Resume from processed index
  const remaining = itemIds.slice(processed);

  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    // Time budget check
    if (Date.now() > deadline) {
      await saveProgress(job.id, processed, succeeded, failed, errors);
      return "partial";
    }

    // Cancellation check before each batch
    if (await checkCancelled(job.id)) {
      await saveProgress(job.id, processed, succeeded, failed, errors);
      return "cancelled";
    }

    const batch = remaining.slice(i, i + BATCH_SIZE);
    await chunkParallel(batch, CONCURRENCY, async (id) => {
      try {
        if (job.job_type === "update_order_status") {
          await updateOrderStatus(store, id, payload.new_status as string);
        } else if (job.job_type === "delete_orders") {
          await deleteOrder(store, id, Boolean(payload.force));
        } else if (job.job_type === "update_product_price") {
          await updateProductPrice(store, id, payload.operation as string, Number(payload.value));
        } else if (job.job_type === "update_product_stock") {
          await updateProductStock(store, id, payload.operation as string, payload.value as number | undefined, payload.stock_status as string | undefined);
        } else if (job.job_type === "update_product_status") {
          await updateProductStatus(store, id, payload.new_status as string);
        } else if (job.job_type === "assign_product_categories") {
          await assignProductCategories(store, id, payload.mode as string, (payload.category_ids as number[]) ?? []);
        } else if (job.job_type === "delete_products") {
          await deleteProduct(store, id, Boolean(payload.force));
        }
        succeeded++;
      } catch (e) {
        failed++;
        errors.push({ id, error: e instanceof Error ? e.message : "Unknown error" });
      } finally {
        processed++;
      }
    });

    await saveProgress(job.id, processed, succeeded, failed, errors);
  }

  // Completed all items
  const completedPayload: BulkJobUpdate = {
    status: "completed",
    completed_at: new Date().toISOString(),
    processed,
    succeeded,
    failed,
    errors: toJson(errors),
  };
  await supabaseAdmin.from("bulk_jobs").update(completedPayload).eq("id", job.id);

  return "done";
}

// --- Handler ---------------------------------------------------------------

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (process.env.NODE_ENV === "production" && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const startedAt = Date.now();
  const deadline = startedAt + MAX_RUNTIME_MS;

  try {
    // Pick up oldest pending or running job (one at a time per invocation)
    const { data: jobs, error } = await supabaseAdmin
      .from("bulk_jobs")
      .select("*")
      .in("status", ["pending", "running"])
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) throw error;
    if (!jobs || jobs.length === 0) {
      return res.status(200).json({ ok: true, message: "No jobs queued", ts: new Date().toISOString() });
    }

    const job = jobs[0] as JobRow;
    console.log(`[bulk-jobs] picked up jobId=${job.id} type=${job.job_type} processed=${job.processed}/${job.total}`);

    const outcome = await processJob(job, deadline);
    const elapsed = Date.now() - startedAt;

    console.log(`[bulk-jobs] jobId=${job.id} outcome=${outcome} elapsed=${elapsed}ms`);

    return res.status(200).json({
      ok: true,
      jobId: job.id,
      job_type: job.job_type,
      outcome,
      elapsed_ms: elapsed,
    });
  } catch (err) {
    console.error("[bulk-jobs] worker error:", err);
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}