import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

type LoadingContextValue = {
  active: boolean;
  start: () => void;
  stop: () => void;
  slotEl: HTMLElement | null;
  setSlotEl: (el: HTMLElement | null) => void;
};

const LoadingContext = createContext<LoadingContextValue | null>(null);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const [slotEl, setSlotEl] = useState<HTMLElement | null>(null);
  const start = useCallback(() => setCount((c) => c + 1), []);
  const stop = useCallback(() => setCount((c) => Math.max(0, c - 1)), []);
  return (
    <LoadingContext.Provider value={{ active: count > 0, start, stop, slotEl, setSlotEl }}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useGlobalLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    return { active: false, start: () => {}, stop: () => {}, slotEl: null, setSlotEl: () => {} };
  }
  return ctx;
}

export function useLoadingEffect(active: boolean) {
  const ctx = useContext(LoadingContext);
  const wasActive = useRef(false);
  useEffect(() => {
    if (!ctx) return;
    if (active && !wasActive.current) {
      ctx.start();
      wasActive.current = true;
    } else if (!active && wasActive.current) {
      ctx.stop();
      wasActive.current = false;
    }
    return () => {
      if (wasActive.current && ctx) {
        ctx.stop();
        wasActive.current = false;
      }
    };
  }, [active, ctx]);
}

export function ProgressSlot({ className }: { className?: string }) {
  const { setSlotEl } = useGlobalLoading();
  return (
    <div
      ref={(el) => setSlotEl(el)}
      className={className ?? "absolute left-0 right-0 -bottom-px h-[3px] overflow-hidden pointer-events-none z-30"}
      aria-hidden="true"
    />
  );
}