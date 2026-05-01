import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getStoreCreds, wooRequest, type WooStoreCreds } from "@/lib/woo-client";
import type { Json } from "@/integrations/supabase/database.types";
import type { TablesUpdate } from "@/integrations/supabase/helpers";
import { WooApiError } from "@/lib/sync-error";
import { renderInvoicePdfForOrder } from "@/lib/templates/render-invoice";
import { slugifyFilenameSegment } from "@/lib/templates/render-filename";
import { refreshCustomerForOrder } from "@/lib/customer-refresh";
import { refreshOrderFromWoo } from "@/lib/order-refresh";

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

  // If transitioning to completed, refresh full order + customer from Woo
  if (newStatus === "completed") {
    void refreshOrderFromWoo(store.id, orderId);
    const { data: orderRow } = await supabaseAdmin
      .from("orders")
      .select("customer_id")
      .eq("store_id", store.id)
      .eq("woo_id", orderId)
      .maybeSingle();
    const customerId = orderRow?.customer_id;
    if (typeof customerId === "number" && customerId > 0) {
      void refreshCustomerForOrder(store.id, customerId);
    }
  }
}

async function deleteOrder(store: WooStoreCreds, orderId: number, force = false) {
  try {
    await wooRequest(store, "DELETE", `orders/${orderId}${force ? "?force=true" : ""}`);
  } catch (e) {
    if (!(e instanceof WooApiError) || e.context.status !== 404) throw e;
  }
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

async function assignProductTags(
  store: WooStoreCreds,
  productId: number,
  mode: string,
  tagIds: number[],
) {
  const current = await wooRequest<{ tags?: { id: number }[] }>(store, "GET", `products/${productId}`);
  const currentIds = new Set((current.tags ?? []).map((c) => c.id));
  let nextIds: number[];
  if (mode === "add") {
    tagIds.forEach((id) => currentIds.add(id));
    nextIds = Array.from(currentIds);
  } else if (mode === "remove") {
    tagIds.forEach((id) => currentIds.delete(id));
    nextIds = Array.from(currentIds);
  } else {
    nextIds = tagIds;
  }
  const body = { tags: nextIds.map((id) => ({ id })) };
  const updated = await wooRequest<{ tags?: unknown[] }>(store, "PUT", `products/${productId}`, body);
  await supabaseAdmin
    .from("products")
    .update({
      tags: (updated.tags ?? []) as unknown as Json,
      synced_at: new Date().toISOString(),
    })
    .eq("store_id", store.id)
    .eq("woo_id", productId);
}

async function assignProductBrands(
  store: WooStoreCreds,
  productId: number,
  mode: string,
  brandIds: number[],
) {
  const current = await wooRequest<{ brands?: { id: number }[] }>(store, "GET", `products/${productId}`);
  const currentIds = new Set((current.brands ?? []).map((c) => c.id));
  let nextIds: number[];
  if (mode === "add") {
    brandIds.forEach((id) => currentIds.add(id));
    nextIds = Array.from(currentIds);
  } else if (mode === "remove") {
    brandIds.forEach((id) => currentIds.delete(id));
    nextIds = Array.from(currentIds);
  } else {
    nextIds = brandIds;
  }
  const body = { brands: nextIds.map((id) => ({ id })) };
  const updated = await wooRequest<{ brands?: unknown[] }>(store, "PUT", `products/${productId}`, body);
  await supabaseAdmin
    .from("products")
    .update({
      brands: (updated.brands ?? []) as unknown as Json,
      synced_at: new Date().toISOString(),
    })
    .eq("store_id", store.id)
    .eq("woo_id", productId);
}

async function deleteProduct(store: WooStoreCreds, productId: number, force = false) {
  try {
    await wooRequest(store, "DELETE", `products/${productId}${force ? "?force=true" : ""}`);
  } catch (e) {
    if (!(e instanceof WooApiError) || e.context.status !== 404) throw e;
  }
  await supabaseAdmin.from("products").delete().eq("store_id", store.id).eq("woo_id", productId);
}

// --- Main processor --------------------------------------------------------

async function processJob(job: JobRow, deadline: number): Promise<"done" | "partial" | "cancelled"> {
  if (job.job_type === "print_invoices_bulk") {
    return processPrintInvoicesJob(job, deadline);
  }

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
    job.job_type === "assign_product_tags" ||
    job.job_type === "assign_product_brands" ||
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
        } else if (job.job_type === "assign_product_tags") {
          await assignProductTags(store, id, payload.mode as string, (payload.tag_ids as number[]) ?? []);
        } else if (job.job_type === "assign_product_brands") {
          await assignProductBrands(store, id, payload.mode as string, (payload.brand_ids as number[]) ?? []);
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
  const finalStatus = succeeded === 0 && failed > 0 ? "failed" : "completed";
  const errorMessage = succeeded === 0 && failed > 0
    ? `All ${failed} item${failed === 1 ? "" : "s"} failed${errors[0]?.error ? `: ${errors[0].error}` : ""}`
    : null;
  const completedPayload: BulkJobUpdate = {
    status: finalStatus,
    completed_at: new Date().toISOString(),
    processed,
    succeeded,
    failed,
    errors: toJson(errors),
    error_message: errorMessage,
  };
  await supabaseAdmin.from("bulk_jobs").update(completedPayload).eq("id", job.id);

  return "done";
}

// --- Print invoices bulk handler ------------------------------------------

async function processPrintInvoicesJob(job: JobRow, deadline: number): Promise<"done" | "partial" | "cancelled"> {
  const payload = job.payload as Record<string, unknown>;
  const orderIds = (payload.order_ids as string[]) ?? [];
  const templateId = payload.template_id as string;
  const outputMode = (payload.output_mode as string) || "single-pdf";

  if (!templateId) {
    const p: BulkJobUpdate = { status: "failed", completed_at: new Date().toISOString(), error_message: "Missing template_id" };
    await supabaseAdmin.from("bulk_jobs").update(p).eq("id", job.id);
    return "done";
  }

  const { data: store, error: storeErr } = await supabaseAdmin
    .from("stores")
    .select("client_id")
    .eq("id", job.store_id)
    .maybeSingle();
  if (storeErr || !store) {
    const p: BulkJobUpdate = { status: "failed", completed_at: new Date().toISOString(), error_message: "Store not found" };
    await supabaseAdmin.from("bulk_jobs").update(p).eq("id", job.id);
    return "done";
  }
  const pathScope = (store.client_id as string | null) ?? `store-${job.store_id}`;

  if (job.status === "pending") {
    const p: BulkJobUpdate = { status: "running", started_at: new Date().toISOString() };
    await supabaseAdmin.from("bulk_jobs").update(p).eq("id", job.id);
  }

  let processed = job.processed;
  let succeeded = job.succeeded;
  let failed = job.failed;
  const existingErrors: ItemError[] = Array.isArray(job.errors) ? (job.errors as unknown as ItemError[]) : [];
  const errors: ItemError[] = [...existingErrors];

  const remaining = orderIds.slice(processed);
  const partsPrefix = `${pathScope}/${job.id}/parts`;

  // Render PDFs serially (puppeteer is heavy; concurrency 1 is safest)
  for (let i = 0; i < remaining.length; i++) {
    if (Date.now() > deadline) {
      await saveProgress(job.id, processed, succeeded, failed, errors);
      return "partial";
    }
    if (await checkCancelled(job.id)) {
      await saveProgress(job.id, processed, succeeded, failed, errors);
      return "cancelled";
    }

    const orderId = remaining[i];
    try {
      const { pdf } = await renderInvoicePdfForOrder(supabaseAdmin, {
        storeId: job.store_id,
        orderId,
        templateId,
      });
      const partPath = `${partsPrefix}/${orderId}.pdf`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("bulk-invoices")
        .upload(partPath, pdf, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;
      succeeded++;
    } catch (e) {
      failed++;
      errors.push({ id: orderId, error: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      processed++;
    }
    await saveProgress(job.id, processed, succeeded, failed, errors);
  }

  // Finalize once all orders processed
  if (succeeded === 0) {
    const p: BulkJobUpdate = {
      status: "failed",
      completed_at: new Date().toISOString(),
      processed,
      succeeded,
      failed,
      errors: toJson(errors),
      error_message: `All ${failed} order${failed === 1 ? "" : "s"} failed${errors[0]?.error ? `: ${errors[0].error}` : ""}`,
    };
    await supabaseAdmin.from("bulk_jobs").update(p).eq("id", job.id);
    return "done";
  }

  let artifactPath: string;
  try {
    const result = await finalizeBulkInvoiceArtifact(pathScope, job.store_id, job.id, orderIds, outputMode);
    artifactPath = result.path;
    console.log(`[print_invoices_bulk] jobId=${job.id} mode=${outputMode} parts=${result.partsCount} final_size=${result.sizeBytes} bytes (${(result.sizeBytes / 1024).toFixed(1)} KB)`);
    const newPayload = { ...payload, artifact_path: artifactPath, artifact_size_bytes: result.sizeBytes };
    const finalUpdate: BulkJobUpdate = {
      status: "completed",
      completed_at: new Date().toISOString(),
      processed,
      succeeded,
      failed,
      errors: toJson(errors),
      payload: newPayload as unknown as Json,
    };
    await supabaseAdmin.from("bulk_jobs").update(finalUpdate).eq("id", job.id);
    return "done";
  } catch (e) {
    const p: BulkJobUpdate = {
      status: "failed",
      completed_at: new Date().toISOString(),
      processed,
      succeeded,
      failed,
      errors: toJson(errors),
      error_message: `Finalize failed: ${e instanceof Error ? e.message : "Unknown error"}`,
    };
    await supabaseAdmin.from("bulk_jobs").update(p).eq("id", job.id);
    return "done";
  }
}

async function finalizeBulkInvoiceArtifact(
  pathScope: string,
  storeId: string,
  jobId: string,
  orderIds: string[],
  outputMode: string,
): Promise<{ path: string; sizeBytes: number; partsCount: number }> {
  const partsPrefix = `${pathScope}/${jobId}/parts`;

  const orderZipLabels: Record<string, string> = {};
  if (orderIds.length > 0) {
    const { data: ordRows } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, woo_id")
      .eq("store_id", storeId)
      .in("id", orderIds);
    for (const row of ordRows ?? []) {
      const id = row.id as string;
      const raw =
        row.order_number != null && String(row.order_number).trim() !== ""
          ? String(row.order_number).trim()
          : String(row.woo_id ?? id);
      orderZipLabels[id] = slugifyFilenameSegment(raw) || id.slice(0, 8);
    }
    for (const id of orderIds) {
      if (!orderZipLabels[id]) orderZipLabels[id] = id.slice(0, 8);
    }
  }
  const ext = outputMode === "zip" ? "zip" : "pdf";
  const finalKey = `${pathScope}/${jobId}.${ext}`;

  type Part = { id: string; data: Buffer };
  const parts: Part[] = [];
  for (const id of orderIds) {
    const { data, error } = await supabaseAdmin.storage.from("bulk-invoices").download(`${partsPrefix}/${id}.pdf`);
    if (!error && data) {
      const buf = Buffer.from(await data.arrayBuffer());
      parts.push({ id, data: buf });
    }
  }

  let finalBuf: Buffer;
  let contentType: string;
  if (outputMode === "zip") {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    const usedStemCounts = new Map<string, number>();
    for (const p of parts) {
      const label = orderZipLabels[p.id] || p.id.slice(0, 8);
      const stem = `invoice-${label}`;
      const n = (usedStemCounts.get(stem) || 0) + 1;
      usedStemCounts.set(stem, n);
      const entryName = n === 1 ? `${stem}.pdf` : `${stem}-${n}.pdf`;
      zip.file(entryName, p.data);
    }
    finalBuf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
    contentType = "application/zip";
  } else {
    const { PDFDocument } = await import("pdf-lib");
    const merged = await PDFDocument.create();
    for (const p of parts) {
      try {
        const src = await PDFDocument.load(p.data);
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((pg) => merged.addPage(pg));
      } catch {
        // skip corrupt part
      }
    }
    const savedBytes = await merged.save({ useObjectStreams: true, addDefaultPage: false });
    finalBuf = Buffer.from(savedBytes);
    contentType = "application/pdf";
  }

  const { error: upErr } = await supabaseAdmin.storage
    .from("bulk-invoices")
    .upload(finalKey, finalBuf, { contentType, upsert: true });
  if (upErr) throw upErr;

  // Best-effort cleanup of parts
  try {
    const { data: list } = await supabaseAdmin.storage.from("bulk-invoices").list(`${pathScope}/${jobId}/parts`);
    if (list && list.length > 0) {
      const paths = list.map((f) => `${pathScope}/${jobId}/parts/${f.name}`);
      await supabaseAdmin.storage.from("bulk-invoices").remove(paths);
    }
  } catch {
    /* non-fatal */
  }

  return { path: finalKey, sizeBytes: finalBuf.length, partsCount: parts.length };
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