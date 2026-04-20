import { useEffect } from "react";

export function useScrollExpandedIntoView(expandedId: string | null) {
  useEffect(() => {
    if (!expandedId) return;
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-expanded-row="${expandedId}"]`) as HTMLElement | null;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const fullyVisible = rect.top >= 80 && rect.bottom <= vh - 40;
      if (!fullyVisible) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 120);
    return () => clearTimeout(t);
  }, [expandedId]);
}