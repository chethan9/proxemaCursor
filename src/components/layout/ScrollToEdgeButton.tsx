import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

function findScroller(): HTMLElement | Window {
  const main = document.getElementById("main-content");
  if (main && main.scrollHeight > main.clientHeight + 20) return main;
  const doc = document.documentElement;
  if (doc.scrollHeight > doc.clientHeight + 20) return window;
  if (main) return main;
  return window;
}

function getMetrics(target: HTMLElement | Window) {
  if (target instanceof Window) {
    const doc = document.documentElement;
    return {
      scrollTop: window.scrollY || doc.scrollTop,
      scrollHeight: doc.scrollHeight,
      clientHeight: doc.clientHeight,
    };
  }
  return {
    scrollTop: target.scrollTop,
    scrollHeight: target.scrollHeight,
    clientHeight: target.clientHeight,
  };
}

export function ScrollToEdgeButton() {
  const [mode, setMode] = useState<"hidden" | "up" | "down">("hidden");

  useEffect(() => {
    let target: HTMLElement | Window = findScroller();

    const update = () => {
      target = findScroller();
      const { scrollTop, scrollHeight, clientHeight } = getMetrics(target);
      const overflow = scrollHeight - clientHeight;
      if (overflow < 20) {
        setMode("hidden");
        return;
      }
      setMode(scrollTop > 120 ? "up" : "down");
    };

    update();

    const scrollTargets: (HTMLElement | Window)[] = [window];
    const main = document.getElementById("main-content");
    if (main) scrollTargets.push(main);
    scrollTargets.forEach((t) => t.addEventListener("scroll", update, { passive: true } as AddEventListenerOptions));

    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    if (main) ro.observe(main);

    const mo = new MutationObserver(update);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      scrollTargets.forEach((t) => t.removeEventListener("scroll", update));
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  const handleClick = () => {
    const target = findScroller();
    const top = mode === "up" ? 0 : getMetrics(target).scrollHeight;
    if (target instanceof Window) window.scrollTo({ top, behavior: "smooth" });
    else target.scrollTo({ top, behavior: "smooth" });
  };

  const visible = mode !== "hidden";

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={mode === "up" ? "Scroll to top" : "Scroll to bottom"}
      className={cn(
        "fixed bottom-6 right-6 z-40 h-10 w-10 rounded-full border bg-background/90 backdrop-blur shadow-lg",
        "flex items-center justify-center text-foreground/70 hover:text-foreground hover:bg-background",
        "transition-all duration-200",
        visible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
      )}
    >
      {mode === "up" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
    </button>
  );
}