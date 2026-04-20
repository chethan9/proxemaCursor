import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScrollToEdgeButton() {
  const [mode, setMode] = useState<"hidden" | "up" | "down">("hidden");

  useEffect(() => {
    const el = document.getElementById("main-content");
    if (!el) return;

    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const overflow = scrollHeight - clientHeight;
      if (overflow < 20) {
        setMode("hidden");
        return;
      }
      if (scrollTop > 120) setMode("up");
      else setMode("down");
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);

    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  const handleClick = () => {
    const el = document.getElementById("main-content");
    if (!el) return;
    if (mode === "up") el.scrollTo({ top: 0, behavior: "smooth" });
    else el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
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