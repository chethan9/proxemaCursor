import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InfiniteScrollSentinelProps {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  loaded: number;
  total: number;
  /** How early to start loading (px before sentinel enters viewport). */
  rootMargin?: string;
  className?: string;
}

/**
 * Bottom-of-list sentinel that auto-fetches the next page when scrolled near
 * the viewport edge. Falls back to a manual "Load more" button if the auto
 * trigger doesn't fire (e.g. parent has overflow hidden, intersection observer
 * blocked, etc.).
 */
export function InfiniteScrollSentinel({
  hasMore,
  isLoading,
  onLoadMore,
  loaded,
  total,
  rootMargin = "600px",
  className,
}: InfiniteScrollSentinelProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore || isLoading) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { rootMargin },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [hasMore, isLoading, onLoadMore, rootMargin]);

  if (!hasMore && total === 0) return null;

  return (
    <div
      ref={ref}
      className={
        "flex flex-col items-center justify-center gap-2 py-4 text-xs text-muted-foreground" +
        (className ? ` ${className}` : "")
      }
    >
      {hasMore ? (
        isLoading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading more…
          </span>
        ) : (
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onLoadMore}>
            Load more
          </Button>
        )
      ) : (
        <span>{`Showing all ${loaded.toLocaleString()} of ${total.toLocaleString()}`}</span>
      )}
      {hasMore && (
        <span className="text-[10px] text-muted-foreground/70">
          {`${loaded.toLocaleString()} of ${total.toLocaleString()} loaded`}
        </span>
      )}
    </div>
  );
}
