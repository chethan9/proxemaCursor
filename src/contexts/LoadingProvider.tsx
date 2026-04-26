import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/router";

interface LoadingContextValue {
  active: boolean;
  start: () => void;
  stop: () => void;
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const router = useRouter();

  const start = useCallback(() => setCount((c) => c + 1), []);
  const stop = useCallback(() => setCount((c) => Math.max(0, c - 1)), []);

  useEffect(() => {
    const onStart = () => setCount((c) => c + 1);
    const onDone = () => setCount((c) => Math.max(0, c - 1));
    router.events.on("routeChangeStart", onStart);
    router.events.on("routeChangeComplete", onDone);
    router.events.on("routeChangeError", onDone);
    return () => {
      router.events.off("routeChangeStart", onStart);
      router.events.off("routeChangeComplete", onDone);
      router.events.off("routeChangeError", onDone);
    };
  }, [router.events]);

  return (
    <LoadingContext.Provider value={{ active: count > 0, start, stop }}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useGlobalLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) return { active: false, start: () => {}, stop: () => {} };
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
  }, [active, ctx]);
  useEffect(() => {
    return () => {
      if (wasActive.current && ctx) {
        ctx.stop();
        wasActive.current = false;
      }
    };
  }, [ctx]);
}