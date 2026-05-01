import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin as supabase } from "@/integrations/supabase/admin";
import type { Json } from "@/integrations/supabase/database.types";
import { fetchPagesChunked, basicAuth } from "@/lib/sync-engine";
import {
  getWooSyncHeavyAspectConcurrency,
  getWooSyncMaxPagesPerChunk,
  getWooSyncPageConcurrency,
  getWooSyncPersistBatchSize,
  getWooSyncTaxonomyAspectConcurrency,
  getWooSyncTaxonomyPageConcurrency,
} from "@/lib/sync-config";
import { getAppUrl } from "@/lib/app-url";
import { waitUntil } from "@vercel/functions";
import { getEffectiveHistoryFrom } from "@/lib/history-window";
import { normalizeWooDate } from "@/lib/woo-date";

export const maxDuration = 300;
export const config = { maxDuration: 300 };

const PER_PAGE = 100;

/** If the first waves finish before this elapsed time (ms), run one more chunk per aspect still incomplete — reduces cron round-trips. Must stay below `maxDuration` (300s). */
const INLINE_CHAIN_ELAPSED_CAP_MS = 240_000;

/** Taxonomy first so filters/lists warm before heavy product/order pulls (Phase 1 UX). */
const ASPECT_WAVE_TAXONOMY = ["categories", "tags", "brands"] as const;
const ASPECT_WAVE_HEAVY = ["products", "orders", "customers", "coupons"] as const;

const TAXONOMY_ASPECT_SET = new Set<string>(ASPECT_WAVE_TAXONOMY as unknown as string[]);

interface StoreToSync {
  id: string;
  name: string;
  url: string;
  consumer_key: string;
  consumer_secret: string;
  auth: string;
}

interface SyncRunRow {
  id: string;
  store_id: string;
  aspect: string;
  status: string;
  started_at: string;
  cursor_page: number | null;
  total_pages: number | null;
  records_processed: number | null;
  records_created: number | null;
  records_updated: number | null;
  last_heartbeat_at: string | null;
  is_initial: boolean | null;
}

type Counters = { processed: number; created: number; updated: number };

interface AspectConfig {
  endpoint: string;
  table: string;
  supportsModifiedAfter: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toRow: (item: any, store: StoreToSync, now: string) => Record<string, unknown>;
}

function toJson<T>(obj: T): Json {
  return JSON.parse(JSON.stringify(obj)) as Json;
}

function toNumeric(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const ASPECTS: Record<string, AspectConfig> = {
  products: {
    endpoint: "products",
    table: "products",
    supportsModifiedAfter: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toRow: (p: any, store, now) => ({
      store_id: store.id, woo_id: p.id, name: p.name, slug: p.slug, sku: p.sku || null,
      price: toNumeric(p.price),
      regular_price: toNumeric(p.regular_price),
      sale_price: toNumeric(p.sale_price),
      stock_quantity: p.stock_quantity, stock_status: p.stock_status,
      status: p.status, type: p.type, description: p.description,
      short_description: p.short_description,
      categories: toJson(p.categories), images: toJson(p.images),
      tags: toJson(p.tags || []),
      brands: toJson(p.brands || []),
      attributes: toJson(p.attributes || []), raw_data: toJson(p), synced_at: now,
    }),
  },
  orders: {
    endpoint: "orders",
    table: "orders",
    supportsModifiedAfter: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toRow: (o: any, store, now) => ({
      store_id: store.id, woo_id: o.id, order_number: o.number,
      status: o.status, currency: o.currency,
      total: toNumeric(o.total),
      discount_total: toNumeric(o.discount_total),
      shipping_total: toNumeric(o.shipping_total),
      customer_id: o.customer_id || null,
      payment_method: o.payment_method || null,
      payment_method_title: o.payment_method_title || null,
      billing: toJson(o.billing), shipping: toJson(o.shipping),
      line_items: toJson(o.line_items),
      shipping_lines: toJson(o.shipping_lines || []),
      fee_lines: toJson(o.fee_lines || []),
      coupon_lines: toJson(o.coupon_lines || []),
      raw_data: toJson(o),
      date_created: normalizeWooDate(o.date_created, o.date_created_gmt),
      date_modified: normalizeWooDate(o.date_modified, o.date_modified_gmt),
      synced_at: now,
    }),
  },
  customers: {
    endpoint: "customers",
    table: "customers",
    supportsModifiedAfter: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toRow: (c: any, store, now) => ({
      store_id: store.id, woo_id: c.id, email: c.email,
      first_name: c.first_name, last_name: c.last_name, username: c.username,
      role: null as string | null,
      billing: toJson(c.billing), shipping: toJson(c.shipping),
      avatar_url: c.avatar_url || null,
      is_paying_customer: c.is_paying_customer || false,
      orders_count: c.orders_count || 0,
      total_spent: toNumeric(c.total_spent),
      raw_data: toJson(c), date_created: c.date_created, synced_at: now,
    }),
  },
  categories: {
    endpoint: "products/categories",
    table: "categories",
    supportsModifiedAfter: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toRow: (c: any, store, now) => ({
      store_id: store.id, woo_id: c.id, name: c.name, slug: c.slug,
      parent_id: c.parent || null, description: c.description, display: c.display,
      image: toJson(c.image), menu_order: c.menu_order, count: c.count,
      raw_data: toJson(c), synced_at: now,
    }),
  },
  tags: {
    endpoint: "products/tags",
    table: "tags",
    supportsModifiedAfter: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toRow: (t: any, store, now) => ({
      store_id: store.id, woo_id: t.id, name: t.name, slug: t.slug,
      description: t.description || "", count: t.count || 0,
      raw_data: toJson(t), synced_at: now,
    }),
  },
  brands: {
    endpoint: "products/brands",
    table: "brands",
    supportsModifiedAfter: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toRow: (b: any, store, now) => ({
      store_id: store.id, woo_id: b.id, name: b.name, slug: b.slug,
      description: b.description || "", count: b.count || 0,
      image: toJson(b.image || null),
      raw_data: toJson(b), synced_at: now,
    }),
  },
  coupons: {
    endpoint: "coupons",
    table: "coupons",
    supportsModifiedAfter: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toRow: (c: any, store, now) => ({
      store_id: store.id, woo_id: c.id, code: c.code,
      amount: toNumeric(c.amount),
      discount_type: c.discount_type, description: c.description || "",
      date_expires: c.date_expires, usage_count: c.usage_count || 0,
      individual_use: c.individual_use || false,
      product_ids: toJson(c.product_ids || []),
      excluded_product_ids: toJson(c.excluded_product_ids || []),
      usage_limit: c.usage_limit, usage_limit_per_user: c.usage_limit_per_user,
      free_shipping: c.free_shipping || false,
      minimum_amount: toNumeric(c.minimum_amount),
      maximum_amount: toNumeric(c.maximum_amount),
      raw_data: toJson(c), date_created: c.date_created, synced_at: now,
    }),
  },
};

async function persistAndCheckpoint(
  table: string,
  rows: Record<string, unknown>[],
  storeId: string,
  runId: string,
  page: number,
  counters: Counters,
  opts?: { skipExistingLookup?: boolean }
): Promise<void> {
  if (rows.length === 0) return;
  const maxPersistBatch = getWooSyncPersistBatchSize();
  const skipLookup = opts?.skipExistingLookup === true;
  for (let offset = 0; offset < rows.length; offset += maxPersistBatch) {
    const slice = rows.slice(offset, offset + maxPersistBatch);

    let existingSet = new Set<number>();
    if (!skipLookup) {
      const ids = slice.map((r) => r.woo_id as number);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from(table)
        .select("woo_id")
        .eq("store_id", storeId)
        .in("woo_id", ids);
      existingSet = new Set((existing || []).map((e: { woo_id: number }) => e.woo_id));
    }

    // Upsert with deadlock retry: PG can deadlock when concurrent chunks touch overlapping (store_id, woo_id) keys.
    let lastErr: { message: string; code?: string } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from(table)
        .upsert(slice, { onConflict: "store_id,woo_id", ignoreDuplicates: false });
      if (!error) { lastErr = null; break; }
      lastErr = error;
      const isDeadlock = error.code === "40P01" || /deadlock/i.test(error.message || "");
      const isSerialization = error.code === "40001";
      if (!isDeadlock && !isSerialization) break;
      const backoffMs = 200 * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
      console.warn(`[Sync] ${table} upsert ${error.code} (attempt ${attempt + 1}/3) — retrying in ${backoffMs}ms`);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
    if (lastErr) throw new Error(`${table} upsert failed: ${lastErr.message}`);

    const n = slice.length;
    if (skipLookup) {
      // Onboarding full sync: skip extra SELECT per batch — approximate counts (upsert still exact).
      counters.processed += n;
      counters.updated += n;
    } else {
      const newCount = slice.filter((r) => !existingSet.has(r.woo_id as number)).length;
      counters.created += newCount;
      counters.updated += n - newCount;
      counters.processed += n;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("sync_runs").update({
      cursor_page: page,
      last_heartbeat_at: new Date().toISOString(),
      records_processed: counters.processed,
      records_created: counters.created,
      records_updated: counters.updated,
    }).eq("id", runId);
  }
}

interface AspectResult extends Counters {
  hasMore: boolean;
  runId: string;
  error?: string;
  aspect: string;
}

async function fetchRunningAspectRun(storeId: string, aspectName: string): Promise<SyncRunRow | null> {
  const { data } = await supabase
    .from("sync_runs")
    .select(
      "id, store_id, aspect, status, started_at, cursor_page, total_pages, records_processed, records_created, records_updated, last_heartbeat_at, is_initial"
    )
    .eq("store_id", storeId)
    .eq("aspect", aspectName)
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? (data as unknown as SyncRunRow) : null;
}

async function runAspectWave(
  aspectNames: readonly string[],
  concurrency: number,
  worker: (name: string) => Promise<AspectResult>
): Promise<AspectResult[]> {
  const out: AspectResult[] = [];
  const width = Math.max(1, concurrency);
  for (let i = 0; i < aspectNames.length; i += width) {
    const batch = aspectNames.slice(i, i + width);
    const batchResults = await Promise.all(batch.map((name) => worker(name)));
    out.push(...batchResults);
  }
  return out;
}

async function runAspectChunk(
  store: StoreToSync,
  aspectName: string,
  modifiedAfter: string | null,
  isInitial: boolean,
  resumeRun: SyncRunRow | null,
  ordersHistoryFrom: string | null = null,
): Promise<AspectResult> {
  const cfg = ASPECTS[aspectName];
  const nowIso = new Date().toISOString();

  let run = resumeRun;
  if (!run) {
    const { data, error } = await supabase
      .from("sync_runs")
      .insert({
        store_id: store.id,
        aspect: aspectName,
        status: "running",
        started_at: nowIso,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cursor_page: 0 as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        last_heartbeat_at: nowIso as any,
        is_initial: isInitial,
      })
      .select()
      .single();
    if (error || !data) {
      return { processed: 0, created: 0, updated: 0, hasMore: false, runId: "", aspect: aspectName, error: error?.message || "Failed to create run" };
    }
    run = data as unknown as SyncRunRow;
  }

  const counters: Counters = {
    processed: run.records_processed || 0,
    created: run.records_created || 0,
    updated: run.records_updated || 0,
  };
  const startPage = (run.cursor_page || 0) + 1;
  const params: Record<string, string> = {};
  if (cfg.supportsModifiedAfter && modifiedAfter) params.modified_after = modifiedAfter;
  else if ((aspectName === "orders" || aspectName === "customers") && ordersHistoryFrom) {
    params.after = ordersHistoryFrom;
  }

  /** Keep created/updated counters accurate (including onboarding runs). */
  const skipExistingLookup = false;

  const pageConcurrency = TAXONOMY_ASPECT_SET.has(aspectName)
    ? getWooSyncTaxonomyPageConcurrency()
    : getWooSyncPageConcurrency();

  try {
    const result = await fetchPagesChunked(store.url, store.auth, cfg.endpoint, params, {
      startPage,
      maxPages: getWooSyncMaxPagesPerChunk(),
      perPage: PER_PAGE,
      concurrency: pageConcurrency,
      onBatch: async (items, page) => {
        const batchNow = new Date().toISOString();
        const persistItems =
          aspectName === "products"
            ? (items as Record<string, unknown>[]).filter((i) => i.type !== "variation")
            : items;
        const rows = persistItems.map((item) => cfg.toRow(item, store, batchNow));
        await persistAndCheckpoint(cfg.table, rows, store.id, run!.id, page, counters, {
          skipExistingLookup,
        });
        if (aspectName === "products" && persistItems.length > 0) {
          const wooIds = persistItems.map((i) => (i as { id: number }).id);
          waitUntil(
            (async () => {
              try {
                const { mirrorImagesForProductRows } = await import("@/lib/product-image-mirror.server");
                const { data: prows } = await supabase
                  .from("products")
                  .select("id, images")
                  .eq("store_id", store.id)
                  .in("woo_id", wooIds);
                if (prows?.length) {
                  await mirrorImagesForProductRows(
                    store.id,
                    prows as { id: string; images: unknown }[],
                    "sync"
                  );
                }
              } catch (e) {
                console.warn("[Sync] product image mirror:", e);
              }
            })()
          );
        }
      },
    });

    if (result.hasMore) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("sync_runs").update({
        cursor_page: result.lastPage,
        total_pages: result.totalPages,
        last_heartbeat_at: new Date().toISOString(),
        records_processed: counters.processed,
        records_created: counters.created,
        records_updated: counters.updated,
      }).eq("id", run.id);
      return { ...counters, hasMore: true, runId: run.id, aspect: aspectName };
    } else {
      const startedAtMs = run.started_at ? new Date(run.started_at).getTime() : Date.now();
      const duration = (Date.now() - startedAtMs) / 1000;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("sync_runs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        cursor_page: result.lastPage,
        total_pages: result.totalPages,
        last_heartbeat_at: new Date().toISOString(),
        records_processed: counters.processed,
        records_created: counters.created,
        records_updated: counters.updated,
      }).eq("id", run.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("sync_benchmarks").insert({
        store_id: store.id,
        aspect: aspectName,
        record_count: counters.processed,
        duration_seconds: duration,
        is_initial: isInitial,
      });
      return { ...counters, hasMore: false, runId: run.id, aspect: aspectName };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Sync] ${aspectName} chunk failed:`, msg);
    if (run) {
      await supabase.from("sync_runs").update({
        // Keep resumable on transient failures/timeouts: cron scheduler will pick this back up.
        status: "running",
        completed_at: null,
        last_heartbeat_at: new Date().toISOString(),
        cursor_page: Math.max(0, (run.cursor_page || 0)),
        records_processed: counters.processed,
        records_created: counters.created,
        records_updated: counters.updated,
        error_message: msg,
      }).eq("id", run.id);
    }
    return { ...counters, hasMore: true, runId: run?.id || "", aspect: aspectName, error: msg };
  }
}

async function fetchStoreForSync(storeId: string): Promise<{ store: StoreToSync; isInitial: boolean; modifiedAfter: string | null; ordersHistoryFrom: string | null; allRunId: string | null; allStartedAt: string | null; rawStore: { last_full_sync_at: string | null; last_sync_at: string | null; initial_sync_completed_at: string | null; client_id: string | null; logo_url: string | null; name: string | null; url: string } } | { error: string; status: number }> {
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, name, url, consumer_key, consumer_secret, last_sync_at, last_full_sync_at, initial_sync_completed_at, client_id, logo_url")
    .eq("id", storeId)
    .single();

  if (storeError || !store) return { error: "Store not found", status: 404 };
  if (!store.consumer_key || !store.consumer_secret) return { error: "Store not connected - missing API credentials", status: 400 };

  const { data: allRow } = await supabase
    .from("sync_runs")
    .select("id, started_at, is_initial")
    .eq("store_id", storeId).eq("aspect", "all").eq("status", "running")
    .order("started_at", { ascending: false }).limit(1).maybeSingle();

  const isInitial = !!allRow?.is_initial;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const lastFull = store.last_full_sync_at ? new Date(store.last_full_sync_at).getTime() : 0;
  const fullSyncDue = !lastFull || (Date.now() - lastFull) > SEVEN_DAYS_MS;
  const useIncremental = !isInitial && !fullSyncDue && !!store.last_sync_at;

  let modifiedAfter: string | null = null;
  if (useIncremental && store.last_sync_at) {
    const t = new Date(store.last_sync_at).getTime() - 60 * 60 * 1000;
    modifiedAfter = new Date(t).toISOString();
  }

  const ordersHistoryFrom = await getEffectiveHistoryFrom(storeId);

  return {
    store: {
      id: store.id, name: store.name || "", url: store.url,
      consumer_key: store.consumer_key, consumer_secret: store.consumer_secret,
      auth: basicAuth(store.consumer_key, store.consumer_secret),
    },
    isInitial,
    modifiedAfter,
    ordersHistoryFrom,
    allRunId: allRow?.id || null,
    allStartedAt: allRow?.started_at || null,
    rawStore: store,
  };
}

async function maybeFireCelebrationAndVariations(
  storeId: string,
  rawStore: { client_id: string | null; logo_url: string | null; name: string | null; url: string; initial_sync_completed_at: string | null },
  isInitial: boolean,
  baseUrl: string
): Promise<void> {
  if (isInitial && !rawStore.initial_sync_completed_at) {
    await supabase.from("stores").update({ initial_sync_completed_at: new Date().toISOString() }).eq("id", storeId).is("initial_sync_completed_at", null);
    let userIds: string[] = [];
    if (rawStore.client_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: members } = await (supabase as any).from("client_members").select("user_id").eq("client_id", rawStore.client_id);
      userIds = ((members || []) as { user_id: string }[]).map((m) => m.user_id);
    }
    if (userIds.length === 0) {
      const { data: allUsers } = await supabase.from("profiles").select("id").limit(50);
      userIds = (allUsers || []).map((u: { id: string }) => u.id);
    }
    const rows = userIds.map((uid) => ({
      user_id: uid, type: "celebration",
      title: `${rawStore.name} is ready!`, body: "Welcome aboard. To infinity and beyond 🚀",
      cta_label: "Let's go", lottie_url: "/confetti.json", priority: 90,
      metadata: { store_id: storeId, store_name: rawStore.name, store_url: rawStore.url, logo_url: rawStore.logo_url },
    }));
    if (rows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("user_notifications").insert(rows);
    }
  }
  // Variations sync
  const variationsPromise = fetch(`${baseUrl}/api/stores/${storeId}/sync-variations`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  }).catch((e) => console.error("[Sync] variations trigger:", e));
  waitUntil(variationsPromise);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // PATCH = manual cancel
  if (req.method === "PATCH") {
    const { storeId } = req.query;
    if (!storeId || typeof storeId !== "string") return res.status(400).json({ error: "Store ID required" });
    const { data: allRunning } = await supabase.from("sync_runs").select("id").eq("store_id", storeId).eq("status", "running");
    const cancelIds = (allRunning || []).map((r) => r.id);
    if (cancelIds.length > 0) {
      await supabase.from("sync_runs").update({
        status: "failed", error_message: "Manually cancelled", completed_at: new Date().toISOString(),
      }).in("id", cancelIds);
    }
    await supabase.from("stores").update({ status: "connected" }).eq("id", storeId);
    return res.status(200).json({ cancelled: cancelIds.length });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { storeId } = req.query;
  if (!storeId || typeof storeId !== "string") return res.status(400).json({ error: "Store ID required" });

  const queryAspect = typeof req.query.aspect === "string" ? req.query.aspect : null;
  const queryResume = req.query.resume === "true" || req.query.resume === "1";
  const bodyAspect = (req.body && typeof req.body.aspect === "string") ? req.body.aspect : null;
  const bodyResume = req.body && (req.body.resume === true || req.body.resume === "true");
  const targetAspect = queryAspect || bodyAspect;
  const isResume = queryResume || bodyResume;

  try {
    const ctx = await fetchStoreForSync(storeId);
    if ("error" in ctx) return res.status(ctx.status).json({ error: ctx.error });

    const { store, isInitial, modifiedAfter, ordersHistoryFrom, allRunId, allStartedAt, rawStore } = ctx;

    const syncRequestStartedAt = Date.now();

    await supabase.from("stores").update({ status: "syncing" }).eq("id", storeId);

    // ---------- RESUME single aspect ----------
    if (isResume && targetAspect && targetAspect !== "all") {
      if (!ASPECTS[targetAspect]) return res.status(400).json({ error: `Unknown aspect: ${targetAspect}` });
      const { data: runRow } = await supabase
        .from("sync_runs")
        .select("id, store_id, aspect, status, started_at, cursor_page, total_pages, records_processed, records_created, records_updated, last_heartbeat_at, is_initial")
        .eq("store_id", storeId).eq("aspect", targetAspect).eq("status", "running")
        .order("started_at", { ascending: false }).limit(1).maybeSingle();
      if (!runRow) {
        return res.status(404).json({ error: "No running run to resume", aspect: targetAspect });
      }
      const result = await runAspectChunk(store, targetAspect, modifiedAfter, !!runRow.is_initial, runRow as unknown as SyncRunRow, ordersHistoryFrom);

      // After this chunk, check whether the whole "all" run is now complete
      if (allRunId) {
        const { data: stillRunning } = await supabase
          .from("sync_runs").select("id").eq("store_id", storeId).eq("status", "running").neq("aspect", "all");
        const allDone = !stillRunning || stillRunning.length === 0;
        if (allDone) {
          const allStartMs = allStartedAt ? new Date(allStartedAt).getTime() : Date.now();
          const overallDuration = (Date.now() - allStartMs) / 1000;
          // sum totals from all aspect runs in this initial sync session
          const { data: aspectRuns } = await supabase
            .from("sync_runs").select("records_processed, records_created, records_updated")
            .eq("store_id", storeId).eq("status", "completed").gte("started_at", allStartedAt || new Date(0).toISOString()).neq("aspect", "all");
          const totals = (aspectRuns || []).reduce((a, r) => ({
            processed: a.processed + (r.records_processed || 0),
            created: a.created + (r.records_created || 0),
            updated: a.updated + (r.records_updated || 0),
          }), { processed: 0, created: 0, updated: 0 });
          const nowIso = new Date().toISOString();
          await supabase.from("sync_runs").update({
            status: "completed", completed_at: nowIso,
            records_processed: totals.processed, records_created: totals.created, records_updated: totals.updated,
          }).eq("id", allRunId);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("sync_benchmarks").insert({
            store_id: storeId, aspect: "all", record_count: totals.processed,
            duration_seconds: overallDuration, is_initial: isInitial,
          });
          await supabase.from("stores").update({ status: "connected", last_sync_at: nowIso }).eq("id", storeId);
          await maybeFireCelebrationAndVariations(storeId, rawStore, isInitial, getAppUrl(req));
        } else {
          // still running — keep store status "syncing"
          await supabase.from("stores").update({ status: "syncing" }).eq("id", storeId);
        }
      } else {
        // ad-hoc single-aspect resume: update store back when done
        if (!result.hasMore) {
          await supabase.from("stores").update({ status: "connected", last_sync_at: new Date().toISOString() }).eq("id", storeId);
        }
      }

      return res.status(200).json({ success: true, store_id: storeId, resumed: true, result });
    }

    // ---------- Fresh single aspect ----------
    if (targetAspect && targetAspect !== "all" && targetAspect !== "variations") {
      if (!ASPECTS[targetAspect]) return res.status(400).json({ error: `Unknown aspect: ${targetAspect}` });
      const result = await runAspectChunk(store, targetAspect, modifiedAfter, false, null, ordersHistoryFrom);
      if (!result.hasMore) {
        await supabase.from("stores").update({ status: "connected", last_sync_at: new Date().toISOString() }).eq("id", storeId);
      }
      return res.status(200).json({ success: true, store_id: storeId, results: { [targetAspect]: result } });
    }

    // ---------- Fresh "all" sync — taxonomy wave first (filters usable sooner), then heavy aspects ----------
    const aspectNames = [...ASPECT_WAVE_TAXONOMY, ...ASPECT_WAVE_HEAVY];
    const waveTaxonomy = await runAspectWave(
      ASPECT_WAVE_TAXONOMY,
      getWooSyncTaxonomyAspectConcurrency(),
      (name) => runAspectChunk(store, name, modifiedAfter, isInitial, null, ordersHistoryFrom)
    );
    const waveHeavy = await runAspectWave(
      ASPECT_WAVE_HEAVY,
      getWooSyncHeavyAspectConcurrency(),
      (name) => runAspectChunk(store, name, modifiedAfter, isInitial, null, ordersHistoryFrom)
    );
    let results = [...waveTaxonomy, ...waveHeavy];

    // Phase 2.1: one extra in-process chunk per aspect still incomplete (avoids waiting on cron) when within time budget.
    const elapsedAfterWaves = Date.now() - syncRequestStartedAt;
    if (elapsedAfterWaves < INLINE_CHAIN_ELAPSED_CAP_MS && results.some((r) => r.hasMore && !r.error)) {
      const byAspect = new Map<string, AspectResult>();
      aspectNames.forEach((name, i) => byAspect.set(name, results[i]));

      const applySecondChunk = async (name: string): Promise<AspectResult> => {
        const r = byAspect.get(name);
        if (!r || !r.hasMore || r.error) return r!;
        const runRow = await fetchRunningAspectRun(storeId, name);
        if (!runRow) return r;
        return runAspectChunk(store, name, modifiedAfter, isInitial, runRow, ordersHistoryFrom);
      };

      const secondTaxonomy = await runAspectWave(
        ASPECT_WAVE_TAXONOMY,
        getWooSyncTaxonomyAspectConcurrency(),
        applySecondChunk
      );
      const secondHeavy = await runAspectWave(
        ASPECT_WAVE_HEAVY,
        getWooSyncHeavyAspectConcurrency(),
        applySecondChunk
      );
      results = [...secondTaxonomy, ...secondHeavy];
    }

    const totals = results.reduce((a, r) => ({
      processed: a.processed + r.processed,
      created: a.created + r.created,
      updated: a.updated + r.updated,
    }), { processed: 0, created: 0, updated: 0 });

    const allDone = results.every((r) => !r.hasMore);
    const nowIso = new Date().toISOString();

    if (allDone) {
      const allStartMs = allStartedAt ? new Date(allStartedAt).getTime() : Date.now();
      const overallDuration = (Date.now() - allStartMs) / 1000;
      const storeUpdate: Record<string, unknown> = { status: "connected", last_sync_at: nowIso };
      if (isInitial || !rawStore.last_full_sync_at) storeUpdate.last_full_sync_at = nowIso;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from("stores").update(storeUpdate as any).eq("id", storeId);

      if (allRunId) {
        await supabase.from("sync_runs").update({
          status: "completed", completed_at: nowIso,
          records_processed: totals.processed, records_created: totals.created, records_updated: totals.updated,
        }).eq("id", allRunId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("sync_benchmarks").insert({
          store_id: storeId, aspect: "all", record_count: totals.processed,
          duration_seconds: overallDuration, is_initial: isInitial,
        });
      }
      await maybeFireCelebrationAndVariations(storeId, rawStore, isInitial, getAppUrl(req));
    } else {
      // chunks remaining — update "all" run heartbeat with running totals; cron will resume
      if (allRunId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("sync_runs").update({
          last_heartbeat_at: nowIso,
          records_processed: totals.processed,
          records_created: totals.created,
          records_updated: totals.updated,
        }).eq("id", allRunId);
      }
      // store stays in "syncing" status until cron finishes the rest
    }

    const resultsByAspect: Record<string, AspectResult> = {};
    aspectNames.forEach((name, i) => { resultsByAspect[name] = results[i]; });

    return res.status(200).json({
      success: true,
      store_id: storeId,
      all_done: allDone,
      results: resultsByAspect,
      totals,
    });

  } catch (error) {
    console.error("[Sync API] Error:", error);
    await supabase.from("stores").update({ status: "error" }).eq("id", storeId);
    return res.status(500).json({
      error: "Sync failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}