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

/** Upload remote image by URL into Cloudflare Images. */
export async function uploadImageFromUrl(remoteUrl: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const cfg = await getResolvedCloudflareConfig();
  if (!cfg || !cfg.enabled) {
    return { ok: false, error: "Cloudflare Images not configured" };
  }
  const form = new FormData();
  form.append("url", remoteUrl);
  const json = await cfFetch(cfg, "/images/v1", { method: "POST", body: form });
  if (!json.success || !json.result?.id) {
    const msg = json.errors?.map((e) => e.message).join("; ") || "Upload failed";
    return { ok: false, error: msg };
  }
  return { ok: true, id: json.result.id };
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
