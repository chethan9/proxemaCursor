import { useRouter } from "next/router";
import { useEffect, useRef } from "react";

export type UrlValue = string | number | boolean | undefined | null;

export function getQueryString(
  query: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const v = query[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

export function getQueryNumber(
  query: Record<string, string | string[] | undefined>,
  key: string,
  fallback: number,
): number {
  const raw = getQueryString(query, key);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function useSyncUrl(
  values: Record<string, UrlValue>,
  defaults: Record<string, UrlValue>,
  options?: { debounceMs?: number },
) {
  const router = useRouter();
  const lastSerialized = useRef<string>("");
  const debounceMs = options?.debounceMs ?? 0;

  const serializedValues = JSON.stringify(values);

  useEffect(() => {
    if (!router.isReady) return;

    const apply = () => {
      const nextQuery: Record<string, string | string[]> = {};

      for (const [k, v] of Object.entries(router.query)) {
        if (!(k in values) && v !== undefined) nextQuery[k] = v;
      }

      for (const [k, v] of Object.entries(values)) {
        if (v === undefined || v === null || v === "") continue;
        if (defaults[k] !== undefined && v === defaults[k]) continue;
        nextQuery[k] = String(v);
      }

      const serialized = JSON.stringify(nextQuery);
      if (serialized === lastSerialized.current) return;
      lastSerialized.current = serialized;

      router.replace(
        { pathname: router.pathname, query: nextQuery },
        undefined,
        { shallow: true, scroll: false },
      );
    };

    if (debounceMs > 0) {
      const t = setTimeout(apply, debounceMs);
      return () => clearTimeout(t);
    }
    apply();
  }, [router.isReady, serializedValues]);  // eslint-disable-line react-hooks/exhaustive-deps
}