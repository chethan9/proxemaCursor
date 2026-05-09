/** Shared URL rules for store-scoped product/image APIs (image-proxy, resolved-product-thumb). */

function stripWww(h: string): string {
  return h.replace(/^www\./i, "");
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "0.0.0.0") return true;
  if (h.endsWith(".localhost")) return true;
  if (h === "127.0.0.1" || h === "[::1]") return true;
  return false;
}

/** Hostnames we allow for product/cdn images (in addition to the store site). */
const EXTRA_IMAGE_HOSTS = new Set(
  [
    "imagedelivery.net",
    "i0.wp.com",
    "i1.wp.com",
    "i2.wp.com",
    "i.optimole.com",
    "res.cloudinary.com",
    "cdn.shortpixel.ai",
  ].map((s) => s.toLowerCase()),
);

/** Public WordPress / e-commerce image CDN suffixes. Covers per-site subdomains. */
const ALLOWED_HOST_SUFFIXES = [
  ".imagedelivery.net",
  ".i.optimole.com",
  ".cloudinary.com",
  ".b-cdn.net",
  ".bunnycdn.com",
  ".shortpixel.ai",
  ".akamaized.net",
  ".fastly.net",
  ".cloudfront.net",
  ".wp.com",
];

/** Same site as store URL host or any subdomain (cdn.shop.com when store is shop.com). */
export function hostAllowedForStore(targetHost: string, storeUrl: string | null | undefined): boolean {
  const th = stripWww(targetHost.toLowerCase());
  if (isPrivateOrLocalHost(th)) return false;
  if (EXTRA_IMAGE_HOSTS.has(th)) return true;
  if (ALLOWED_HOST_SUFFIXES.some((suffix) => th.endsWith(suffix))) return true;
  if (/^i[0-2]\.wp\.com$/i.test(th)) return true;
  if (!storeUrl) return false;
  try {
    const u = new URL(storeUrl);
    const sh = stripWww(u.hostname.toLowerCase());
    if (!sh) return false;
    if (th === sh) return true;
    if (th.endsWith(`.${sh}`)) return true;
    if (th === `www.${sh}` || sh === `www.${th}`) return true;
  } catch {
    return false;
  }
  return false;
}

/** Turn Woo relative paths (/wp-content/...) into absolute URLs using the store base. */
export function resolveImageUrl(raw: string, storeUrl: string | null | undefined): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("//")) {
    try {
      return new URL(`https:${t}`).href;
    } catch {
      return null;
    }
  }
  if (/^https?:\/\//i.test(t)) {
    try {
      return new URL(t).href;
    } catch {
      return null;
    }
  }
  if (!storeUrl?.trim()) return null;
  try {
    const base = storeUrl.endsWith("/") ? storeUrl : `${storeUrl}/`;
    const path = t.startsWith("/") ? t : `/${t}`;
    return new URL(path, base).href;
  } catch {
    return null;
  }
}
