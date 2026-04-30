import { useEffect, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

/**
 * Progressive background prefetch for paginated lists.
 *
 * Strategy:
 * - Never blocks the current page. Runs one page at a time during idle.
 * - Cancels & restarts when `resetKey` changes (e.g. filter/search change).
 * - Respects caps so huge datasets don't blow memory.
 *
 * Usage: call once from a list component with the same queryKey/queryFn the
 * visible page uses. It will prefetch pages 1, 2, 3 ... up to `maxPages`.
 */
export interface UseBackgroundPaginationOptions<T> {
  enabled: boolean;
  /** Total number of records available (from first query's count). */
  totalCount: number;
  pageSize: number;
  /** Current page index (0-based) the user is actively viewing. Prefetch skips this. */
  currentPage: number;
  /** Build the React Query cache key for a given page index. */
  queryKeyFn: (page: number) => QueryKey;
  /** Fetcher for a given page index. Must return the same shape as the visible query. */
  queryFn: (page: number) => Promise<T>;
  /** Hard cap on total records to prefetch (default 5000). */
  maxRecords?: number;
  /** Hard cap on number of pages to prefetch (default 100, tighter of the two wins). */
  maxPages?: number;
  /** Delay before starting prefetch chain, lets page 1 settle (default 800ms). */
  startDelayMs?: number;
  /**
   * When this value changes, all in-flight prefetches are cancelled and
   * the chain restarts from page 0 (after startDelay).
   */
  resetKey?: string | number;
}

export function useBackgroundPagination<T>({
  enabled,
  totalCount,
  pageSize,
  currentPage,
  queryKeyFn,
  queryFn,
  maxRecords = 5000,
  maxPages = 100,
  startDelayMs = 800,
  resetKey,
}: UseBackgroundPaginationOptions<T>): void {
  const queryClient = useQueryClient();
  const abortRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  useEffect(() => {
    if (!enabled || !totalCount || !pageSize) return;

    // Cancel any previous chain
    abortRef.current.cancelled = true;
    const token = { cancelled: false };
    abortRef.current = token;

    const totalPages = Math.ceil(totalCount / pageSize);
    const recordCap = Math.min(maxRecords, totalCount);
    const pageCap = Math.min(maxPages, Math.ceil(recordCap / pageSize), totalPages);

    if (pageCap <= 1) return;

    const runWhenIdle = (fn: () => void) => {
      if (typeof window === "undefined") return;
      const w = window as unknown as {
        requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number;
      };
      if (typeof w.requestIdleCallback === "function") {
        w.requestIdleCallback(fn, { timeout: 2000 });
      } else {
        setTimeout(fn, 50);
      }
    };

    let started = false;
    const timer = setTimeout(() => {
      if (token.cancelled) return;
      started = true;
      let nextPage = 0;
      const chain = () => {
        if (token.cancelled) return;
        while (nextPage < pageCap && (nextPage === currentPage || queryClient.getQueryData(queryKeyFn(nextPage)) !== undefined)) {
          nextPage++;
        }
        if (nextPage >= pageCap) return;
        const pageToFetch = nextPage++;
        runWhenIdle(() => {
          if (token.cancelled) return;
          queryClient
            .prefetchQuery({
              queryKey: queryKeyFn(pageToFetch),
              queryFn: () => queryFn(pageToFetch),
            })
            .finally(() => {
              if (!token.cancelled) chain();
            });
        });
      };
      chain();
    }, startDelayMs);

    return () => {
      token.cancelled = true;
      if (!started) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, totalCount, pageSize, currentPage, resetKey]);
}