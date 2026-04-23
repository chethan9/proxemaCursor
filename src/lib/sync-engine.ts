import { WOO_USER_AGENT, detectBlockingService } from "./sync-error";

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

  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
          "User-Agent": WOO_USER_AGENT,
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
  const maxPages = opts.maxPages ?? 50;
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