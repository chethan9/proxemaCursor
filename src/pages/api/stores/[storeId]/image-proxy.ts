import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { assertStoreAccess } from "@/lib/assert-store-access";
import { getWooUserAgent } from "@/lib/brand-name-server";

function getBearer(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization;
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  return bearer || (req.cookies?.["sb-access-token"] as string | undefined) || null;
}

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
function hostAllowedForStore(targetHost: string, storeUrl: string | null | undefined): boolean {
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
function resolveImageUrl(raw: string, storeUrl: string | null | undefined): string | null {
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

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Same-origin image fetch for the product image editor: avoids canvas taint from
 * cross-origin Woo/media URLs. Authenticated; URL host must match store or Cloudflare delivery.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = getBearer(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: "Unauthorized" });

  const { storeId: rawSid } = req.query;
  const storeId = Array.isArray(rawSid) ? rawSid[0] : rawSid;
  if (!storeId || typeof storeId !== "string") return res.status(400).json({ error: "Missing store id" });

  const gate = await assertStoreAccess(userData.user.id, storeId);
  if (gate.allowed === false) return res.status(gate.status).json({ error: gate.message });

  const rawUrlParam = typeof req.query.url === "string" ? req.query.url.trim() : "";
  if (!rawUrlParam) return res.status(400).json({ error: "Missing url" });

  const { data: storeRow } = await supabaseAdmin.from("stores").select("url").eq("id", storeId).maybeSingle();
  const storeUrl = storeRow?.url as string | undefined;

  const resolvedHref = resolveImageUrl(rawUrlParam, storeUrl);
  if (!resolvedHref) {
    return res.status(400).json({ error: "Invalid or unresolved url (need absolute URL or store site URL for relative paths)" });
  }

  let target: URL;
  try {
    target = new URL(resolvedHref);
  } catch {
    return res.status(400).json({ error: "Invalid url" });
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return res.status(400).json({ error: "Only http(s) URLs allowed" });
  }

  if (!hostAllowedForStore(target.hostname, storeUrl)) {
    return res.status(403).json({ error: "URL host not allowed for this store" });
  }

  const ua = await getWooUserAgent();
  let upstream: Response;
  try {
    upstream = await fetch(target.href.split("#")[0], {
      headers: { "User-Agent": ua, Accept: "image/*,*/*;q=0.8" },
      redirect: "follow",
    });
  } catch {
    return res.status(502).json({ error: "Failed to fetch image" });
  }

  if (!upstream.ok) {
    const status = upstream.status === 404 ? 404 : 502;
    return res.status(status).json({
      error: "Image fetch failed",
      upstreamStatus: upstream.status,
    });
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  if (buf.length > MAX_BYTES) {
    return res.status(413).json({ error: "Image too large" });
  }

  let ct =
    upstream.headers.get("content-type")?.split(";")[0]?.trim() ||
    "application/octet-stream";

  const sniffImage = (): boolean => {
    if (buf.length < 12) return false;
    if (buf[0] === 0xff && buf[1] === 0xd8) return true;
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true;
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return true;
    return false;
  };

  if (!/^image\//i.test(ct)) {
    if (!sniffImage()) return res.status(415).json({ error: "Not an image" });
    ct = "image/jpeg";
  }

  res.setHeader("Content-Type", ct);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.setHeader("Content-Length", String(buf.length));
  return res.status(200).send(buf);
}
