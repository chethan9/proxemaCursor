"use client";

import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  /** When null, `src` is used as-is (no mirror lookup). */
  storeId: string | null;
  src: string | null | undefined;
  alt: string;
  imgClassName?: string;
  /** Square placeholder when no src */
  placeholder?: "package" | "none";
};

/**
 * Resolves Woo/source URLs to Cloudflare Images thumb (then card) via API, then falls back to source.
 */
export function ResolvedStoreImage({
  storeId,
  src,
  alt,
  imgClassName,
  placeholder = "none",
}: Props) {
  const [displaySrc, setDisplaySrc] = useState<string | null>(() =>
    src?.trim() ? src.trim() : null,
  );

  useEffect(() => {
    const raw = src?.trim();
    if (!raw) {
      setDisplaySrc(null);
      return;
    }
    if (!storeId) {
      setDisplaySrc(raw);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          if (!cancelled) setDisplaySrc(raw);
          return;
        }
        const r = await fetch(
          `/api/stores/${storeId}/resolved-product-thumb?url=${encodeURIComponent(raw)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!r.ok || cancelled) {
          if (!cancelled) setDisplaySrc(raw);
          return;
        }
        const j = (await r.json()) as { url?: string };
        const next = typeof j.url === "string" && j.url.trim() ? j.url.trim() : raw;
        if (!cancelled) setDisplaySrc(next);
      } catch {
        if (!cancelled) setDisplaySrc(raw);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storeId, src]);

  if (!displaySrc && !src?.trim()) {
    if (placeholder === "package") {
      return (
        <div className="flex h-full w-full items-center justify-center">
          <Package className="h-8 w-8 text-muted-foreground/50" aria-hidden />
        </div>
      );
    }
    return null;
  }

  const url = displaySrc ?? src!.trim();

  return (
    // eslint-disable-next-line @next/next/no-img-element -- resolved public CDN / Woo URLs
    <img
      src={url}
      alt={alt}
      className={imgClassName}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        const raw = src?.trim();
        if (raw && e.currentTarget.src !== raw) {
          e.currentTarget.src = raw;
        }
      }}
    />
  );
}
