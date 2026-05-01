/**
 * Cloudflare Images API (account upload + delete). Server-only.
 * @see https://developers.cloudflare.com/images/upload-images/upload-url/
 */

import type { ResolvedCloudflareConfig } from "@/lib/cloudflare-images-config.server";
import { getResolvedCloudflareConfig } from "@/lib/cloudflare-images-config.server";

const API_BASE = "https://api.cloudflare.com/client/v4";

/** @deprecated Use getResolvedCloudflareConfig() — env-only check for tooling. */
export function isCloudflareImagesConfigured(): boolean {
  return (
    process.env.CLOUDFLARE_PRODUCT_IMAGES_ENABLED === "true" &&
    !!process.env.CLOUDFLARE_ACCOUNT_ID &&
    !!process.env.CLOUDFLARE_API_TOKEN &&
    !!process.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH
  );
}

export function getCfImageVariantNames(cfg: ResolvedCloudflareConfig): {
  thumb: string;
  card: string;
  edit: string;
  zoom: string;
} {
  return cfg.variants;
}

export function buildDeliveryUrls(cfImageId: string, cfg: ResolvedCloudflareConfig): {
  thumb: string;
  card: string;
  edit: string;
  zoom: string;
} {
  const hash = cfg.accountHash;
  const v = cfg.variants;
  const base = `https://imagedelivery.net/${hash}/${cfImageId}`;
  return {
    thumb: `${base}/${v.thumb}`,
    card: `${base}/${v.card}`,
    edit: `${base}/${v.edit}`,
    zoom: `${base}/${v.zoom}`,
  };
}

interface CfApiResult {
  id: string;
}

interface CfApiEnvelope {
  success: boolean;
  errors?: { message: string }[];
  result?: CfApiResult;
}

async function cfFetch(cfg: ResolvedCloudflareConfig, path: string, init: RequestInit): Promise<CfApiEnvelope> {
  const accountId = cfg.accountId;
  const token = cfg.apiToken;
  const url = `${API_BASE}/accounts/${accountId}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  const json = (await res.json()) as CfApiEnvelope;
  return json;
}

const DEFAULT_MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024;

function guessUploadFilename(contentType: string): string {
  const c = contentType.toLowerCase();
  if (c.includes("png")) return "image.png";
  if (c.includes("webp")) return "image.webp";
  if (c.includes("gif")) return "image.gif";
  if (c.includes("svg")) return "image.svg";
  return "image.jpg";
}

async function fetchRemoteImageBuffer(
  remoteUrl: string
): Promise<{ ok: true; buffer: Buffer; contentType: string } | { ok: false; error: string }> {
  const ctrl = new AbortController();
  const ms = Math.min(120_000, Math.max(8_000, Number(process.env.CF_MIRROR_FETCH_TIMEOUT_MS || 45_000)));
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(remoteUrl, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent": "ProximaCursor-CfMirror/1.0",
      },
    });
    clearTimeout(t);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const ct = res.headers.get("content-type") || "";
    if (!ct.toLowerCase().startsWith("image/") && !ct.toLowerCase().includes("octet-stream")) {
      return { ok: false, error: `Not an image (${ct || "unknown type"})` };
    }
    const ab = await res.arrayBuffer();
    const max = Number(process.env.CF_MIRROR_MAX_DOWNLOAD_BYTES || DEFAULT_MAX_DOWNLOAD_BYTES);
    if (ab.byteLength > max) return { ok: false, error: `Image too large (${ab.byteLength} bytes)` };
    return { ok: true, buffer: Buffer.from(ab), contentType: ct };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, error: e instanceof Error ? e.message : "fetch failed" };
  }
}

/**
 * Resize / re-encode large masters before upload so CF variants stay fast and storage stays smaller.
 * GIFs are skipped (animation). Set CF_MIRROR_SKIP_MASTER_OPTIMIZE=true to disable.
 * Grid/list URLs use the **thumb** variant from Cloudflare — size that variant in the CF dashboard
 * (see `cloudflare-product-image-sizes.ts`); keep master large enough for zoom/edit variants.
 */
async function optimizeRasterForCfUpload(
  buffer: Buffer,
  contentType: string
): Promise<{ buffer: Buffer; filename: string } | null> {
  if (process.env.CF_MIRROR_SKIP_MASTER_OPTIMIZE === "true") return null;
  const lower = contentType.toLowerCase();
  if (lower.includes("gif")) return null;
  if (lower.includes("svg")) return null;
  if (!/image\/(jpeg|pjpeg|png|webp|tiff|avif)/i.test(lower) && !lower.includes("octet-stream")) return null;

  try {
    const sharpMod = await import("sharp");
    const sharp = sharpMod.default;
    let pipeline = sharp(buffer, { failOn: "none" }).rotate();
    const meta = await pipeline.metadata();
    const maxEdge = Math.min(
      4096,
      Math.max(512, Number(process.env.CF_MIRROR_MASTER_MAX_EDGE_PX || 2048))
    );
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w > maxEdge || h > maxEdge) {
      pipeline = sharp(buffer, { failOn: "none" })
        .rotate()
        .resize({
          width: maxEdge,
          height: maxEdge,
          fit: "inside",
          withoutEnlargement: true,
        });
    }
    const hasAlpha = meta.hasAlpha === true;
    if (hasAlpha) {
      const out = await pipeline.webp({ quality: 84, effort: 4 }).toBuffer();
      return { buffer: out, filename: "image.webp" };
    }
    const out = await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    return { buffer: out, filename: "image.jpg" };
  } catch {
    return null;
  }
}

async function uploadImageBuffer(
  cfg: NonNullable<Awaited<ReturnType<typeof getResolvedCloudflareConfig>>>,
  buffer: Buffer,
  filename: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const form = new FormData();
  form.append("file", new Blob([buffer]), filename);
  const json = await cfFetch(cfg, "/images/v1", { method: "POST", body: form });
  if (!json.success || !json.result?.id) {
    const msg = json.errors?.map((e) => e.message).join("; ") || "Upload failed";
    return { ok: false, error: msg };
  }
  return { ok: true, id: json.result.id };
}

async function uploadImageByRemoteUrlForm(
  cfg: NonNullable<Awaited<ReturnType<typeof getResolvedCloudflareConfig>>>,
  remoteUrl: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const form = new FormData();
  form.append("url", remoteUrl);
  const json = await cfFetch(cfg, "/images/v1", { method: "POST", body: form });
  if (!json.success || !json.result?.id) {
    const msg = json.errors?.map((e) => e.message).join("; ") || "Upload failed";
    return { ok: false, error: msg };
  }
  return { ok: true, id: json.result.id };
}

/** Upload remote image by URL into Cloudflare Images (fetch + optimize when possible, else direct URL upload). */
export async function uploadImageFromUrl(remoteUrl: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const cfg = await getResolvedCloudflareConfig();
  if (!cfg || !cfg.enabled) {
    return { ok: false, error: "Cloudflare Images not configured" };
  }

  const fetched = await fetchRemoteImageBuffer(remoteUrl);
  if (fetched.ok) {
    const optimized = await optimizeRasterForCfUpload(fetched.buffer, fetched.contentType);
    const buf = optimized?.buffer ?? fetched.buffer;
    const fn = optimized?.filename ?? guessUploadFilename(fetched.contentType);
    const up = await uploadImageBuffer(cfg, buf, fn);
    if (up.ok) return up;
  }

  return uploadImageByRemoteUrlForm(cfg, remoteUrl);
}

export async function deleteCloudflareImage(imageId: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getResolvedCloudflareConfig();
  if (!cfg || !cfg.enabled) return { ok: true };
  const json = await cfFetch(cfg, `/images/v1/${encodeURIComponent(imageId)}`, { method: "DELETE" });
  if (!json.success) {
    const msg = json.errors?.map((e) => e.message).join("; ") || "Delete failed";
    return { ok: false, error: msg };
  }
  return { ok: true };
}

/** Verify credentials with Cloudflare API (lightweight list request). */
export async function testCloudflareImagesConnection(
  cfg: ResolvedCloudflareConfig
): Promise<{ ok: boolean; error?: string }> {
  try {
    const json = await cfFetch(cfg, "/images/v1?per_page=1", { method: "GET" });
    if (!json.success) {
      return { ok: false, error: json.errors?.map((e) => e.message).join("; ") || "API error" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Request failed" };
  }
}
