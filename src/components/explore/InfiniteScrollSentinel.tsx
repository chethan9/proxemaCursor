import { useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const SITE_SCROLL_ROOT_ID = "site-scroll-root";

function getScrollableAncestor(el: HTMLElement | null): HTMLElement | null {
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

function collectScrollRoots(el: HTMLElement | null): (HTMLElement | Window)[] {
  const roots: (HTMLElement | Window)[] = [];
  if (typeof document !== "undefined") {
    const byId = document.getElementById(SITE_SCROLL_ROOT_ID);
    if (byId) roots.push(byId);
  }
  const ancestor = getScrollableAncestor(el);
  if (ancestor && !roots.includes(ancestor)) roots.push(ancestor);
  if (roots.length === 0) roots.push(window);
  return roots;
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

function scrollTopOf(root: HTMLElement | Window): number {
  if (root instanceof Window) {
    return window.scrollY ?? document.documentElement.scrollTop ?? 0;
  }
  return root.scrollTop;
}

interface InfiniteScrollSentinelProps {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  loaded: number;
  total: number;
  /**
   * Start loading the next chunk when scroll depth reaches this fraction (0–1).
   * Default 0.5 so the next page begins loading earlier (fast scrollers still see seamless paging).
   */
  scrollDepthThreshold?: number;
  /** Extra px margin for IntersectionObserver backup (sentinel near viewport). */
  rootMargin?: string;
  className?: string;
}

/**
 * Infinite list footer: loads more when scroll position passes `scrollDepthThreshold`
 * (default 50%) inside the site scroll region, plus IntersectionObserver on the
 * sentinel as a fallback. Manual "Load more" remains as a last resort.
 */
export function InfiniteScrollSentinel({
  hasMore,
  isLoading,
  onLoadMore,
  loaded,
  total,
  scrollDepthThreshold = 0.5,
  rootMargin = "400px",
  className,
}: InfiniteScrollSentinelProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  const lastTriggerScrollTopRef = useRef(0);
  const waitForFurtherScrollRef = useRef(false);
  onLoadMoreRef.current = onLoadMore;

  const tryLoad = useCallback(() => {
    if (!hasMore || isLoading) return;
    onLoadMoreRef.current();
  }, [hasMore, isLoading]);

  // Primary: scroll depth (e.g. 50%) on the real scroll container
  useEffect(() => {
    if (!hasMore || isLoading) return;

    const roots = collectScrollRoots(ref.current);
    const primaryRoot = roots[0];
    let raf = 0;

    const check = () => {
      if (!hasMore || isLoading) return;
      const ratio = scrollDepthRatio(primaryRoot);
      const scrollTop = scrollTopOf(primaryRoot);
      // Prevent chain-loading: require additional user scroll after each auto-trigger.
      if (waitForFurtherScrollRef.current) {
        if (scrollTop <= lastTriggerScrollTopRef.current + 80) return;
        waitForFurtherScrollRef.current = false;
      }
      if (ratio >= scrollDepthThreshold) tryLoad();
      if (ratio >= scrollDepthThreshold) {
        lastTriggerScrollTopRef.current = scrollTop;
        waitForFurtherScrollRef.current = true;
      }
    };

    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(check);
    };

    primaryRoot.addEventListener("scroll", onScroll, { passive: true });
    // Short content: no scroll bar yet — still try once layout settles
    check();
    const observed = primaryRoot instanceof HTMLElement ? [primaryRoot] : [];
    const ro =
      typeof ResizeObserver !== "undefined" && observed.length > 0
        ? new ResizeObserver(() => check())
        : null;
    if (ro) {
      for (const root of observed) ro.observe(root);
    }

    return () => {
      cancelAnimationFrame(raf);
      primaryRoot.removeEventListener("scroll", onScroll);
      ro?.disconnect();
    };
  }, [hasMore, isLoading, scrollDepthThreshold, tryLoad]);

  // Fallback: sentinel intersecting viewport (or rootMargin area)
  useEffect(() => {
    if (!hasMore || isLoading) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const roots = collectScrollRoots(node);
    const primaryRoot = roots[0];
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          const scrollTop = scrollTopOf(primaryRoot);
          if (waitForFurtherScrollRef.current && scrollTop <= lastTriggerScrollTopRef.current + 80) return;
          tryLoad();
          lastTriggerScrollTopRef.current = scrollTop;
          waitForFurtherScrollRef.current = true;
        }
      },
      { root: primaryRoot instanceof HTMLElement ? primaryRoot : null, rootMargin },
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
