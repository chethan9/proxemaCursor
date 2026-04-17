import { useEffect, useRef, useCallback, useState } from "react";

interface UseInfiniteScrollOptions {
  /** Function to load more data. Receives current page number, returns true if more pages exist. */
  loadMore: (page: number) => Promise<boolean>;
  /** Initial page size */
  pageSize?: number;
  /** Distance from bottom (px) to trigger next load */
  threshold?: number;
  /** Whether to start loading immediately */
  enabled?: boolean;
}

export function useInfiniteScroll({ loadMore, pageSize = 50, threshold = 300, enabled = true }: UseInfiniteScrollOptions) {
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const reset = useCallback(() => {
    setPage(0);
    setHasMore(true);
    setInitialLoading(true);
    loadingRef.current = false;
  }, []);

  const fetchPage = useCallback(async (pageNum: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    try {
      const more = await loadMore(pageNum);
      setHasMore(more);
      setPage(pageNum);
    } catch (err) {
      console.error("Infinite scroll load error:", err);
    } finally {
      setLoading(false);
      setInitialLoading(false);
      loadingRef.current = false;
    }
  }, [loadMore]);

  useEffect(() => {
    if (!enabled) return;
    fetchPage(0);
  }, [enabled, fetchPage]);

  useEffect(() => {
    if (!enabled || !hasMore) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingRef.current && hasMore) {
          fetchPage(page + 1);
        }
      },
      { rootMargin: `${threshold}px` }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, hasMore, page, threshold, fetchPage]);

  return { sentinelRef, loading, hasMore, initialLoading, page, reset };
}