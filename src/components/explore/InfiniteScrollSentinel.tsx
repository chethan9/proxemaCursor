import { useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const SITE_SCROLL_ROOT_ID = "site-scroll-root";

function getScrollableAncestor(el: HTMLElement | null): HTMLElement | Window | null {
  if (!el) return null;
  let parent: HTMLElement | null = el.parentElement;
  while (parent) {
    const style = getComputedStyle(parent);
    const oy = style.overflowY;
    if ((oy === "auto" || oy === "scroll" || oy === "overlay") && parent.scrollHeight > parent.clientHeight + 1) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

function scrollDepthRatio(root: HTMLElement | Window): number {
  if (root instanceof Window) {
    const scrollTop = window.scrollY ?? document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = window.innerHeight;
    const maxScroll = Math.max(0, scrollHeight - clientHeight);
    return maxScroll <= 0 ? 1 : scrollTop / maxScroll;
  }
  const { scrollTop, scrollHeight, clientHeight } = root;
  const maxScroll = Math.max(0, scrollHeight - clientHeight);
  return maxScroll <= 0 ? 1 : scrollTop / maxScroll;
}

interface InfiniteScrollSentinelProps {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  loaded: number;
  total: number;
  /**
   * Start loading the next chunk when scroll depth reaches this fraction (0–1).
   * Default 0.75 so the next page begins loading before the user hits the bottom.
   */
  scrollDepthThreshold?: number;
  /** Extra px margin for IntersectionObserver backup (sentinel near viewport). */
  rootMargin?: string;
  className?: string;
}

/**
 * Infinite list footer: loads more when scroll position passes `scrollDepthThreshold`
 * (default 75%) inside the site scroll region, plus IntersectionObserver on the
 * sentinel as a fallback. Manual "Load more" remains as a last resort.
 */
export function InfiniteScrollSentinel({
  hasMore,
  isLoading,
  onLoadMore,
  loaded,
  total,
  scrollDepthThreshold = 0.75,
  rootMargin = "400px",
  className,
}: InfiniteScrollSentinelProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  const tryLoad = useCallback(() => {
    if (!hasMore || isLoading) return;
    onLoadMoreRef.current();
  }, [hasMore, isLoading]);

  // Primary: scroll depth (e.g. 75%) on the real scroll container
  useEffect(() => {
    if (!hasMore || isLoading) return;

    const pickRoot = (): HTMLElement | Window => {
      const byId = typeof document !== "undefined" ? document.getElementById(SITE_SCROLL_ROOT_ID) : null;
      if (byId) return byId;
      const ancestor = getScrollableAncestor(ref.current);
      if (ancestor) return ancestor;
      return window;
    };

    const root = pickRoot();
    let raf = 0;

    const check = () => {
      if (!hasMore || isLoading) return;
      const ratio = scrollDepthRatio(root);
      if (ratio >= scrollDepthThreshold) tryLoad();
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(check);
    };

    root.addEventListener("scroll", onScroll, { passive: true });
    // Short content: no scroll bar yet — still try once layout settles
    check();
    const ro =
      typeof ResizeObserver !== "undefined" && root instanceof HTMLElement
        ? new ResizeObserver(() => check())
        : null;
    if (ro && root instanceof HTMLElement) ro.observe(root);

    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener("scroll", onScroll);
      ro?.disconnect();
    };
  }, [hasMore, isLoading, scrollDepthThreshold, tryLoad, loaded, total]);

  // Fallback: sentinel intersecting viewport (or rootMargin area)
  useEffect(() => {
    if (!hasMore || isLoading) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) tryLoad();
      },
      { rootMargin },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [hasMore, isLoading, tryLoad, rootMargin]);

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
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => tryLoad()}>
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
