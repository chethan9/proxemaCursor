/**
 * Shared helpers for product image URLs + Cloudflare Images mirror map keys.
 * Safe for browser and Node (sync).
 */

export type ProductMirrorUrlsEntry = {
  thumb?: string;
  card?: string;
  edit?: string;
  zoom?: string;
};

export type ProductImageMirrorUrlsMap = Record<string, ProductMirrorUrlsEntry>;

/** Normalize Woo/origin URLs for stable dedupe (drops query string — Woo often adds resize params). */
export function normalizeProductImageSrc(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  try {
    const u = new URL(t);
    u.search = "";
    return u.href;
  } catch {
    return t;
  }
}

/** Storage key for `products.image_mirror_urls` JSON (base64url UTF-8). */
export function productImageStorageKey(normalizedSrc: string): string {
  const enc = new TextEncoder().encode(normalizedSrc);
  let bin = "";
  enc.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  if (typeof btoa !== "undefined") {
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  // Node (tests / SSR without btoa)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Buffer } = require("buffer") as typeof import("buffer");
  return Buffer.from(normalizedSrc, "utf8").toString("base64url");
}

export type ImageVariantName = "thumb" | "card" | "edit" | "zoom";

export function resolveMirroredProductImageUrl(
  rawSrc: string | undefined | null,
  mirrorUrls: unknown,
  variant: ImageVariantName,
  enabled: boolean
): string | null {
  if (!rawSrc || !enabled) return rawSrc || null;
  const normalized = normalizeProductImageSrc(rawSrc);
  if (!normalized) return rawSrc;
  const key = productImageStorageKey(normalized);
  const map = mirrorUrls as ProductImageMirrorUrlsMap | null | undefined;
  const entry = map?.[key];
  const v = entry?.[variant];
  return v || rawSrc;
}

export function getProductThumbnailWithMirrors(
  images: unknown,
  mirrorUrls: unknown,
  enabled: boolean
): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0] as { src?: string };
  const src = first?.src;
  if (!src) return null;
  if (!enabled) return src;
  const normalized = normalizeProductImageSrc(src);
  const key = productImageStorageKey(normalized);
  const map = mirrorUrls as ProductImageMirrorUrlsMap | null | undefined;
  const entry = map?.[key];
  return entry?.thumb || entry?.card || src;
}

/** Client-side: enable Cloudflare variant URLs when NEXT_PUBLIC flag is set. */
export function isCloudflareProductImagesClientEnabled(): boolean {
  return typeof process !== "undefined" && process.env.NEXT_PUBLIC_CLOUDFLARE_PRODUCT_IMAGES === "true";
}

/** True when the resolved thumbnail URL is served from Cloudflare Images (Image Delivery). */
export function isCloudflareDeliveryUrl(u: string | null | undefined): boolean {
  if (!u || !/^https?:\/\//i.test(u)) return false;
  try {
    return /(?:^|\.)imagedelivery\.net$/i.test(new URL(u).hostname);
  } catch {
    return false;
  }
}
