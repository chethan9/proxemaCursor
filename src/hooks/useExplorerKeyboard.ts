import { useEffect, type RefObject } from "react";

interface Options {
  searchRef: RefObject<HTMLInputElement | null>;
  onPrev?: () => void;
  onNext?: () => void;
  enabled?: boolean;
}

export function useExplorerKeyboard({ searchRef, onPrev, onNext, enabled = true }: Options) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable === true;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = searchRef.current;
        if (el) {
          el.focus();
          try { el.select(); } catch { /* noop */ }
        }
        return;
      }

      if (isEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

      if (e.key === "ArrowLeft" && onPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight" && onNext) {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchRef, onPrev, onNext, enabled]);
}