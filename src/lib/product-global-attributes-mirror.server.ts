import { supabaseAdmin as supabase } from "@/integrations/supabase/admin";
import type { Json } from "@/integrations/supabase/database.types";
import { fetchPagesChunked, fetchPagesConcurrent, basicAuth } from "@/lib/sync-engine";

export type WooMirrorAttribute = {
  id: number;
  name: string;
  slug: string;
  type: string;
  order_by: string;
  has_archives: boolean;
};

export type WooMirrorTerm = {
  id: number;
  name: string;
  slug: string;
  description: string;
  menu_order: number;
  count: number;
};

function toJson<T>(obj: T): Json {
  return JSON.parse(JSON.stringify(obj)) as Json;
}

export function wooAttributeToMirrorRow(
  storeId: string,
  item: Record<string, unknown>,
  now: string,
): Record<string, unknown> {
  return {
    store_id: storeId,
    woo_id: item.id as number,
    name: (item.name as string) ?? "",
    slug: (item.slug as string) ?? "",
    type: (item.type as string) ?? "select",
    order_by: (item.order_by as string) ?? "menu_order",
    has_archives: !!(item.has_archives as boolean),
    raw_data: toJson(item),
    synced_at: now,
  };
}

export function wooTermToMirrorRow(
  storeId: string,
  attributeWooId: number,
  item: Record<string, unknown>,
  now: string,
): Record<string, unknown> {
  return {
    store_id: storeId,
    attribute_woo_id: attributeWooId,
    woo_id: item.id as number,
    name: (item.name as string) ?? "",
    slug: (item.slug as string) ?? "",
    description: (item.description as string) ?? "",
    menu_order: (item.menu_order as number) ?? 0,
    count: (item.count as number) ?? 0,
    raw_data: toJson(item),
    synced_at: now,
  };
}

export function mirrorRowsToWooAttributes(rows: Record<string, unknown>[]): WooMirrorAttribute[] {
  return rows.map((r) => ({
    id: r.woo_id as number,
    name: (r.name as string) ?? "",
    slug: (r.slug as string) ?? "",
    type: (r.type as string) ?? "select",
    order_by: (r.order_by as string) ?? "menu_order",
    has_archives: !!(r.has_archives as boolean),
  }));
}

export function mirrorRowsToWooTerms(rows: Record<string, unknown>[]): WooMirrorTerm[] {
  return rows.map((r) => ({
    id: r.woo_id as number,
    name: (r.name as string) ?? "",
    slug: (r.slug as string) ?? "",
    description: (r.description as string) ?? "",
    menu_order: (r.menu_order as number) ?? 0,
    count: (r.count as number) ?? 0,
  }));
}

export async function upsertGlobalAttributesMirror(
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from("product_global_attributes").upsert(rows as any, {
    onConflict: "store_id,woo_id",
  });
  if (error) throw new Error(error.message);
}

export async function upsertGlobalAttributeTermsMirror(
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from("product_global_attribute_terms").upsert(rows as any, {
    onConflict: "store_id,attribute_woo_id,woo_id",
  });
  if (error) throw new Error(error.message);
}

export async function mirrorUpsertAttributeAfterWoo(storeId: string, payload: Record<string, unknown>): Promise<void> {
  const now = new Date().toISOString();
  await upsertGlobalAttributesMirror([wooAttributeToMirrorRow(storeId, payload, now)]);
}

export async function mirrorUpsertTermAfterWoo(
  storeId: string,
  attributeWooId: number,
  payload: Record<string, unknown>,
): Promise<void> {
  const now = new Date().toISOString();
  await upsertGlobalAttributeTermsMirror([wooTermToMirrorRow(storeId, attributeWooId, payload, now)]);
}

export async function deleteGlobalAttributeMirror(storeId: string, attributeWooId: number): Promise<void> {
  await supabase.from("product_global_attribute_terms").delete().eq("store_id", storeId).eq("attribute_woo_id", attributeWooId);
  await supabase.from("product_global_attributes").delete().eq("store_id", storeId).eq("woo_id", attributeWooId);
}

export async function deleteGlobalAttributeTermMirror(
  storeId: string,
  attributeWooId: number,
  termWooId: number,
): Promise<void> {
  await supabase
    .from("product_global_attribute_terms")
    .delete()
    .eq("store_id", storeId)
    .eq("attribute_woo_id", attributeWooId)
    .eq("woo_id", termWooId);
}

/** When initial sync has finished: read mirror (ordered). Caller may fallback to live Woo if empty. */
export async function getGlobalAttributeFromMirror(storeId: string, wooId: number): Promise<WooMirrorAttribute | null> {
  const { data, error } = await supabase
    .from("product_global_attributes")
    .select("woo_id,name,slug,type,order_by,has_archives")
    .eq("store_id", storeId)
    .eq("woo_id", wooId)
    .maybeSingle();
  if (error || !data) return null;
  return mirrorRowsToWooAttributes([data as Record<string, unknown>])[0];
}

export async function listGlobalAttributesFromMirror(storeId: string): Promise<WooMirrorAttribute[]> {
  const { data, error } = await supabase
    .from("product_global_attributes")
    .select("woo_id,name,slug,type,order_by,has_archives")
    .eq("store_id", storeId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return mirrorRowsToWooAttributes((data || []) as Record<string, unknown>[]);
}

export async function listGlobalAttributeTermsFromMirror(
  storeId: string,
  attributeWooId: number,
): Promise<WooMirrorTerm[]> {
  const { data, error } = await supabase
    .from("product_global_attribute_terms")
    .select("woo_id,name,slug,description,menu_order,count")
    .eq("store_id", storeId)
    .eq("attribute_woo_id", attributeWooId)
    .order("menu_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return mirrorRowsToWooTerms((data || []) as Record<string, unknown>[]);
}

export async function storeHasInitialSyncDone(storeId: string): Promise<boolean> {
  const { data } = await supabase.from("stores").select("initial_sync_completed_at").eq("id", storeId).maybeSingle();
  return !!data?.initial_sync_completed_at;
}

export async function countGlobalAttributesMirror(storeId: string): Promise<number> {
  const { count, error } = await supabase
    .from("product_global_attributes")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

type PaMeta = { stage: "attrs" | "terms"; termsAttrIdx: number };

function parseMeta(raw: string | null | undefined): PaMeta | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<PaMeta>;
    if (o.stage === "terms" || o.stage === "attrs") {
      return {
        stage: o.stage,
        termsAttrIdx: typeof o.termsAttrIdx === "number" ? o.termsAttrIdx : 0,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

type StoreCreds = { id: string; url: string; auth: string };

type Counters = { processed: number; created: number; updated: number };

export interface AspectChunkResult {
  processed: number;
  created: number;
  updated: number;
  hasMore: boolean;
  runId: string;
  aspect: string;
  error?: string;
}

type SyncRunRow = {
  id: string;
  cursor_page: number | null;
  records_processed: number | null;
  records_created: number | null;
  records_updated: number | null;
  started_at: string | null;
  is_initial: boolean | null;
  info_message: string | null;
};

const PER_PAGE = 100;
const ATTR_TERM_BATCH = 20;

/** Chunked sync for global attributes + terms (resumable via sync_runs). */
export async function runProductAttributesAspectChunk(
  store: StoreCreds,
  isInitial: boolean,
  resumeRun: SyncRunRow | null,
  maxPagesPerChunk: number,
  taxonomyPageConcurrency: number,
): Promise<AspectChunkResult> {
  const aspectName = "product_attributes";
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
        cursor_page: 0,
        last_heartbeat_at: nowIso,
        is_initial: isInitial,
        info_message: JSON.stringify({ stage: "attrs", termsAttrIdx: 0 } satisfies PaMeta),
      })
      .select()
      .single();
    if (error || !data) {
      return {
        processed: 0,
        created: 0,
        updated: 0,
        hasMore: false,
        runId: "",
        aspect: aspectName,
        error: error?.message || "Failed to create run",
      };
    }
    run = data as unknown as SyncRunRow;
  }

  const counters: Counters = {
    processed: run.records_processed || 0,
    created: run.records_created || 0,
    updated: run.records_updated || 0,
  };

  const meta = parseMeta(run.info_message) ?? { stage: "attrs" as const, termsAttrIdx: 0 };

  try {
    if (meta.stage === "attrs") {
      const startPage = (run.cursor_page || 0) + 1;
      const result = await fetchPagesChunked<Record<string, unknown>>(store.url, store.auth, "products/attributes", {}, {
        startPage,
        maxPages: maxPagesPerChunk,
        perPage: PER_PAGE,
        concurrency: taxonomyPageConcurrency,
        onBatch: async (items, page) => {
          const batchNow = new Date().toISOString();
          const rows = items.map((item) => wooAttributeToMirrorRow(store.id, item, batchNow));
          await upsertGlobalAttributesMirror(rows);
          const n = rows.length;
          counters.processed += n;
          counters.updated += n;
          await supabase
            .from("sync_runs")
            .update({
              cursor_page: page,
              last_heartbeat_at: new Date().toISOString(),
              records_processed: counters.processed,
              records_created: counters.created,
              records_updated: counters.updated,
            })
            .eq("id", run!.id);
        },
      });

      if (result.hasMore) {
        await supabase
          .from("sync_runs")
          .update({
            cursor_page: result.lastPage,
            total_pages: result.totalPages,
            last_heartbeat_at: new Date().toISOString(),
            records_processed: counters.processed,
            records_created: counters.created,
            records_updated: counters.updated,
          })
          .eq("id", run.id);
        return { ...counters, hasMore: true, runId: run.id, aspect: aspectName };
      }

      await supabase
        .from("sync_runs")
        .update({
          cursor_page: 0,
          info_message: JSON.stringify({ stage: "terms", termsAttrIdx: 0 } satisfies PaMeta),
          last_heartbeat_at: new Date().toISOString(),
          records_processed: counters.processed,
          records_created: counters.created,
          records_updated: counters.updated,
        })
        .eq("id", run.id);

      meta.stage = "terms";
      meta.termsAttrIdx = 0;
    }

    const { data: attrRows } = await supabase
      .from("product_global_attributes")
      .select("woo_id")
      .eq("store_id", store.id)
      .order("woo_id", { ascending: true });
    const attrIds = ((attrRows || []) as { woo_id: number }[]).map((r) => r.woo_id);
    if (attrIds.length === 0) {
      await finishProductAttributesRun(run.id, store.id, counters, isInitial);
      return { ...counters, hasMore: false, runId: run.id, aspect: aspectName };
    }

    let idx = meta.termsAttrIdx;
    const endIdx = Math.min(idx + ATTR_TERM_BATCH, attrIds.length);

    for (; idx < endIdx; idx++) {
      const attributeWooId = attrIds[idx];
      await fetchPagesConcurrent<Record<string, unknown>>(
        store.url,
        store.auth,
        `products/attributes/${attributeWooId}/terms`,
        {},
        {
          perPage: PER_PAGE,
          concurrency: taxonomyPageConcurrency,
          maxPages: 500,
          onBatch: async (terms) => {
            const batchNow = new Date().toISOString();
            const rows = terms.map((t) => wooTermToMirrorRow(store.id, attributeWooId, t, batchNow));
            await upsertGlobalAttributeTermsMirror(rows);
            const n = rows.length;
            counters.processed += n;
            counters.updated += n;
          },
        },
      );

      await supabase
        .from("sync_runs")
        .update({
          info_message: JSON.stringify({ stage: "terms", termsAttrIdx: idx + 1 } satisfies PaMeta),
          last_heartbeat_at: new Date().toISOString(),
          records_processed: counters.processed,
          records_created: counters.created,
          records_updated: counters.updated,
        })
        .eq("id", run.id);
    }

    if (idx < attrIds.length) {
      return { ...counters, hasMore: true, runId: run.id, aspect: aspectName };
    }

    await finishProductAttributesRun(run.id, store.id, counters, isInitial);
    return { ...counters, hasMore: false, runId: run.id, aspect: aspectName };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Sync] product_attributes chunk failed:", msg);
    await supabase
      .from("sync_runs")
      .update({
        status: "running",
        completed_at: null,
        last_heartbeat_at: new Date().toISOString(),
        records_processed: counters.processed,
        records_created: counters.created,
        records_updated: counters.updated,
        error_message: msg,
      })
      .eq("id", run.id);
    return { ...counters, hasMore: true, runId: run.id, aspect: aspectName, error: msg };
  }
}

async function finishProductAttributesRun(
  runId: string,
  storeId: string,
  counters: Counters,
  isInitial: boolean,
): Promise<void> {
  const startedRow = await supabase.from("sync_runs").select("started_at").eq("id", runId).maybeSingle();
  const startedAtMs = startedRow.data?.started_at ? new Date(startedRow.data.started_at as string).getTime() : Date.now();
  const duration = (Date.now() - startedAtMs) / 1000;

  await supabase
    .from("sync_runs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      cursor_page: null,
      last_heartbeat_at: new Date().toISOString(),
      records_processed: counters.processed,
      records_created: counters.created,
      records_updated: counters.updated,
      error_message: null,
    })
    .eq("id", runId);

  await supabase.from("sync_benchmarks").insert({
    store_id: storeId,
    aspect: "product_attributes",
    record_count: counters.processed,
    duration_seconds: duration,
    is_initial: isInitial,
  });
}

/** Prefetch/onboarding: pull attributes + all terms into mirror (best-effort). */
export async function prefetchGlobalAttributesMirror(params: {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  storeId: string;
}): Promise<void> {
  const auth = basicAuth(params.consumerKey, params.consumerSecret);
  const store: StoreCreds = { id: params.storeId, url: params.storeUrl, auth };
  const now = new Date().toISOString();

  const attrs = await fetchPagesConcurrent<Record<string, unknown>>(store.url, auth, "products/attributes", {}, {
    perPage: PER_PAGE,
    maxPages: 100,
    concurrency: 2,
  });
  if (attrs.length === 0) return;

  const rows = attrs.map((a) => wooAttributeToMirrorRow(store.id, a, now));
  await upsertGlobalAttributesMirror(rows);

  for (const a of attrs) {
    const wid = a.id as number;
    await fetchPagesConcurrent<Record<string, unknown>>(
      store.url,
      auth,
      `products/attributes/${wid}/terms`,
      {},
      {
        perPage: PER_PAGE,
        maxPages: 100,
        concurrency: 2,
        onBatch: async (terms) => {
          const batchNow = new Date().toISOString();
          const trows = terms.map((t) => wooTermToMirrorRow(store.id, wid, t, batchNow));
          await upsertGlobalAttributeTermsMirror(trows);
        },
      },
    );
  }
}
