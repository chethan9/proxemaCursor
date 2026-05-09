import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

function isScrollable(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const style = getComputedStyle(el);
  const overflowY = style.overflowY;
  const canScroll = overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
  return canScroll && el.scrollHeight > el.clientHeight + 10;
}

function findBestScroller(): HTMLElement | Window {
  const candidates: HTMLElement[] = [];
  document.querySelectorAll("*").forEach((el) => {
    if (isScrollable(el)) candidates.push(el as HTMLElement);
  });
  if (candidates.length === 0) {
    const doc = document.documentElement;
    if (doc.scrollHeight > doc.clientHeight + 10) return window;
    return window;
  }
  candidates.sort((a, b) => b.scrollHeight - a.scrollHeight);
  return candidates[0];
}

function getMetrics(target: HTMLElement | Window) {
  if (target === window) {
    const doc = document.documentElement;
    return {
      scrollTop: window.scrollY || doc.scrollTop,
      scrollHeight: doc.scrollHeight,
      clientHeight: doc.clientHeight,
    };
  }
  const el = target as HTMLElement;
  return { scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
}

export function ScrollToEdgeButton() {
  const [mode, setMode] = useState<"hidden" | "up" | "down">("hidden");
  const [isRtl, setIsRtl] = useState(false);
  const targetRef = useRef<HTMLElement | Window | null>(null);

  useEffect(() => {
    const updateDir = () => setIsRtl(document.documentElement.dir === "rtl");
    updateDir();
    const dirObserver = new MutationObserver(updateDir);
    dirObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["dir", "lang"] });

    const attachedTargets = new Set<HTMLElement | Window>();

    const update = () => {
      const target = findBestScroller();
      targetRef.current = target;
      const { scrollTop, scrollHeight, clientHeight } = getMetrics(target);
      const overflow = scrollHeight - clientHeight;
      if (overflow < 20) {
        setMode("hidden");
        return;
      }
      setMode(scrollTop > 100 ? "up" : "down");

      if (!attachedTargets.has(target)) {
        attachedTargets.add(target);
        target.addEventListener("scroll", update, { passive: true } as AddEventListenerOptions);
      }
    };

    window.addEventListener("scroll", update, { passive: true });
    attachedTargets.add(window);

    update();
    const initialDelay = setTimeout(update, 200);
    const secondDelay = setTimeout(update, 800);

    const ro = new ResizeObserver(update);
    ro.observe(document.body);

    const mo = new MutationObserver(() => {
      update();
    });
    mo.observe(document.body, { childList: true, subtree: true });

    const interval = setInterval(update, 1500);

    return () => {
      attachedTargets.forEach((t) => t.removeEventListener("scroll", update));
      ro.disconnect();
      mo.disconnect();
      dirObserver.disconnect();
      clearTimeout(initialDelay);
      clearTimeout(secondDelay);
      clearInterval(interval);
    };
  }, []);

  const handleClick = () => {
    const target = targetRef.current || findBestScroller();
    const top = mode === "up" ? 0 : getMetrics(target).scrollHeight;
    if (target === window) window.scrollTo({ top, behavior: "smooth" });
    else (target as HTMLElement).scrollTo({ top, behavior: "smooth" });
  };

  const visible = mode !== "hidden";

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={mode === "up" ? "Scroll to top" : "Scroll to bottom"}
      className={cn(
        /** Outer corner — scroll FAB sits rightmost; assistant is inward (`right-[4.75rem]`). */
        "fixed bottom-6 z-[10000] h-11 w-11 rounded-full border bg-background shadow-lg",
        "flex items-center justify-center text-foreground/80 hover:text-foreground hover:shadow-xl",
        "transition-all duration-200",
        isRtl ? "left-6" : "right-6",
        visible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
      )}
    >
      {mode === "up" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
    </button>
  );
}
