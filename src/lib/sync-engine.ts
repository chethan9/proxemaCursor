import { getWooUserAgent } from "@/lib/brand-name-server";
import { detectBlockingService } from "./sync-error";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function buildUrl(storeUrl: string, endpoint: string, params: Record<string, string>): string {
  const url = new URL(`${storeUrl.replace(/\/$/, "")}/wp-json/wc/v3/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  return url.toString();
}

export function basicAuth(consumerKey: string, consumerSecret: string): string {
  return Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
}

export interface FetchRetryOptions {
  timeoutMs?: number;
  attempts?: number;
}

export interface PagesConcurrentOptions {
  concurrency?: number;
  maxPages?: number;
  perPage?: number;
  onProgress?: (fetched: number, total?: number) => void;
}

/**
 * Fetch with exponential backoff. Retries on:
 * - Network errors / timeouts
 * - HTTP 429 (honors Retry-After)
 * - HTTP 5xx
 * Non-retryable: 4xx except 429.
 */
export async function fetchWooWithRetry(
  url: string,
  auth: string,
  opts: FetchRetryOptions = {}
): Promise<Response> {
  const attempts = opts.attempts ?? 3;
  const timeoutMs = opts.timeoutMs ?? 30000;
  let lastError: Error | null = null;
  const ua = await getWooUserAgent();

  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
          "User-Agent": ua,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) return res;

      if (res.status === 429 || res.status >= 500) {
        if (attempt === attempts - 1) return res;
        const retryAfter = parseInt(res.headers.get("retry-after") || "0", 10);
        const delayMs = retryAfter > 0 ? retryAfter * 1000 : Math.min(1000 * Math.pow(2, attempt), 8000);
        await sleep(delayMs);
        continue;
      }
      return res;
    } catch (e) {
      clearTimeout(timeout);
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt === attempts - 1) break;
      await sleep(Math.min(1000 * Math.pow(2, attempt), 8000));
    }
  }
  throw lastError ?? new Error("Retry exhausted");
}

/**
 * Parallel page fetcher: reads X-WP-TotalPages from first response,
 * then fetches remaining pages in concurrent batches.
 */
export async function fetchPagesConcurrent<T>(
  storeUrl: string,
  auth: string,
  endpoint: string,
  params: Record<string, string> = {},
  opts: PagesConcurrentOptions & { onBatch?: (items: T[]) => Promise<void> } = {}
): Promise<T[]> {
  const concurrency = opts.concurrency ?? 2;
  const maxPages = opts.maxPages ?? 5000;
  const perPage = opts.perPage ?? 100;

  const firstUrl = buildUrl(storeUrl, endpoint, { ...params, per_page: String(perPage), page: "1" });
  const firstRes = await fetchWooWithRetry(firstUrl, auth);

  if (!firstRes.ok) {
    if (firstRes.status === 400 || firstRes.status === 404) return [];
    const text = await firstRes.text().catch(() => "");
    const detection = detectBlockingService(firstRes.status, text.slice(0, 2000), firstRes.headers);
    const suffix = detection ? ` [blocked by ${detection.service}: ${detection.hint}]` : "";
    throw new Error(`${endpoint}: ${firstRes.status} ${firstRes.statusText}${suffix}`);
  }

  const firstPage: T[] = await firstRes.json();
  const wpTotalPages = parseInt(firstRes.headers.get("x-wp-totalpages") || "1", 10);
  const wpTotal = parseInt(firstRes.headers.get("x-wp-total") || String(firstPage.length), 10);
  const totalPages = Math.min(wpTotalPages, maxPages);

  const all: T[] = [...firstPage];
  if (firstPage.length > 0 && opts.onBatch) {
    try { await opts.onBatch(firstPage); } catch (e) { console.warn("[sync-engine] onBatch p1 failed:", e); }
  }
  opts.onProgress?.(all.length, wpTotal);

  if (totalPages <= 1 || firstPage.length < perPage) return all;

  const remaining = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);

  for (let i = 0; i < remaining.length; i += concurrency) {
    const batch = remaining.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map(async (pageNum) => {
        const url = buildUrl(storeUrl, endpoint, { ...params, per_page: String(perPage), page: String(pageNum) });
        const res = await fetchWooWithRetry(url, auth);
        if (!res.ok) {
          if (res.status === 400 || res.status === 404) return [] as T[];
          throw new Error(`${endpoint} p${pageNum}: ${res.status}`);
        }
        return (await res.json()) as T[];
      })
    );
    const batchItems: T[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") {
        batchItems.push(...r.value);
        all.push(...r.value);
      } else {
        console.error(`[sync-engine] ${endpoint} page fetch failed:`, r.reason);
      }
    }
    if (batchItems.length > 0 && opts.onBatch) {
      try { await opts.onBatch(batchItems); } catch (e) { console.warn("[sync-engine] onBatch failed:", e); }
    }
    opts.onProgress?.(all.length, wpTotal);
  }

  return all;
}

/**
 * Cursor-aware page fetcher for chunked / resumable syncs.
 * Reads up to `maxPages` pages starting at `startPage` (1-based),
 * calls `onBatch(items, pageNum)` per page (in order) so the caller can
 * persist + heartbeat as progress is made. Returns the last page actually
 * processed and whether more pages remain on the remote.
 *
 * Caller stores `lastPage` as cursor; next invocation passes `startPage = cursor + 1`.
 * When `hasMore === false`, the aspect is complete.
 */
export async function fetchPagesChunked<T>(
  storeUrl: string,
  auth: string,
  endpoint: string,
  params: Record<string, string>,
  opts: {
    startPage: number;
    maxPages: number;
    perPage?: number;
    concurrency?: number;
    onBatch: (items: T[], pageNum: number) => Promise<void>;
  }
): Promise<{ lastPage: number; hasMore: boolean; totalPages: number }> {
  const perPage = opts.perPage ?? 100;
  const concurrency = opts.concurrency ?? 2;
  const startPage = Math.max(1, opts.startPage || 1);
  const maxPages = Math.max(1, opts.maxPages);

  const firstUrl = buildUrl(storeUrl, endpoint, { ...params, per_page: String(perPage), page: String(startPage) });
  const firstRes = await fetchWooWithRetry(firstUrl, auth);

  if (!firstRes.ok) {
    if (firstRes.status === 400 || firstRes.status === 404) {
      return { lastPage: startPage - 1, hasMore: false, totalPages: startPage - 1 };
    }
    const text = await firstRes.text().catch(() => "");
    const detection = detectBlockingService(firstRes.status, text.slice(0, 2000), firstRes.headers);
    const suffix = detection ? ` [blocked by ${detection.service}: ${detection.hint}]` : "";
    throw new Error(`${endpoint}: ${firstRes.status} ${firstRes.statusText}${suffix}`);
  }

  const firstPage: T[] = await firstRes.json();
  const totalPages = parseInt(firstRes.headers.get("x-wp-totalpages") || "1", 10);

  if (firstPage.length > 0) {
    await opts.onBatch(firstPage, startPage);
  }

  if (firstPage.length < perPage || startPage >= totalPages) {
    return { lastPage: startPage, hasMore: false, totalPages };
  }

  const lastPossible = Math.min(startPage + maxPages - 1, totalPages);
  const remaining = Array.from({ length: lastPossible - startPage }, (_, i) => startPage + 1 + i);

  let lastProcessed = startPage;
  let aborted = false;

  const fetchOnePage = async (pageNum: number): Promise<{ page: number; items: T[] }> => {
    const url = buildUrl(storeUrl, endpoint, { ...params, per_page: String(perPage), page: String(pageNum) });
    const res = await fetchWooWithRetry(url, auth);
    if (!res.ok) {
      if (res.status === 400 || res.status === 404) return { page: pageNum, items: [] as T[] };
      throw new Error(`${endpoint} p${pageNum}: ${res.status}`);
    }
    return { page: pageNum, items: (await res.json()) as T[] };
  };

  /**
   * Weak Woo hosts: parallel page fetches may 502/timeout under load.
   * Outer chunk width stays at configured concurrency; retries lower parallelism only for failed pages.
   */
  const outerConcurrency = Math.max(1, concurrency);
  let sliceStart = 0;
  while (sliceStart < remaining.length && !aborted) {
    const batchPages = remaining.slice(sliceStart, sliceStart + outerConcurrency);
    let liveConcurrency = outerConcurrency;
    let queue = [...batchPages];
    let failureRetries = 0;

    while (queue.length > 0 && !aborted) {
      const take = Math.min(liveConcurrency, queue.length);
      const chunk = queue.slice(0, take);
      const settled = await Promise.allSettled(chunk.map((pageNum) => fetchOnePage(pageNum)));
      const failed: number[] = [];
      const ok: { page: number; items: T[] }[] = [];

      for (let k = 0; k < settled.length; k++) {
        const pageNum = chunk[k];
        const r = settled[k];
        if (r.status === "fulfilled") {
          ok.push(r.value);
        } else {
          console.warn(`[sync-engine] ${endpoint} p${pageNum}:`, r.reason);
          failed.push(pageNum);
        }
      }

      ok.sort((a, b) => a.page - b.page);
      for (const { page, items } of ok) {
        if (items.length > 0) await opts.onBatch(items, page);
        lastProcessed = page;
      }

      const tail = queue.slice(take);
      if (failed.length === 0) {
        queue = tail;
        liveConcurrency = outerConcurrency;
        failureRetries = 0;
        continue;
      }

      failureRetries += 1;
      if (failureRetries > 8) {
        console.error(`[sync-engine] ${endpoint} too many failure retries, halting chunk`);
        aborted = true;
        break;
      }

      if (liveConcurrency > 1) {
        liveConcurrency = Math.max(1, Math.floor(liveConcurrency / 2));
        console.warn(`[sync-engine] ${endpoint} retrying ${failed.length} page(s) at concurrency=${liveConcurrency}`);
      } else if (failureRetries >= 3) {
        console.error(`[sync-engine] ${endpoint} still failing at concurrency=1, halting chunk`);
        aborted = true;
        break;
      }

      queue = [...failed, ...tail];
      await sleep(300 + failureRetries * 150);
    }

    if (aborted) break;
    sliceStart += batchPages.length;
  }

  const hasMore = lastProcessed < totalPages;
  return { lastPage: lastProcessed, hasMore, totalPages };
}