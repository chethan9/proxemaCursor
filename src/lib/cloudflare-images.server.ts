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

type CfApiResponse = {
  status: number;
  json: CfApiEnvelope;
};

async function cfFetch(cfg: ResolvedCloudflareConfig, path: string, init: RequestInit): Promise<CfApiResponse> {
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
  return { status: res.status, json };
}

let variantsEnsureAt = 0;
const VARIANTS_ENSURE_TTL_MS = 5 * 60_000;

export async function ensureConfiguredVariants(cfg: ResolvedCloudflareConfig): Promise<void> {
  const now = Date.now();
  if (now - variantsEnsureAt < VARIANTS_ENSURE_TTL_MS) return;

  const desired = [cfg.variants.thumb, cfg.variants.card, cfg.variants.edit, cfg.variants.zoom]
    .map((v) => v.trim())
    .filter(Boolean)
    .filter((v) => v.toLowerCase() !== "public");
  const uniqueDesired = [...new Set(desired)];
  if (uniqueDesired.length === 0) {
    variantsEnsureAt = now;
    return;
  }

  const defaults: Record<string, { fit: string; width: number; height: number }> = {
    thumb: { fit: "cover", width: 384, height: 384 },
    card: { fit: "cover", width: 768, height: 768 },
    edit: { fit: "contain", width: 1400, height: 1400 },
    zoom: { fit: "contain", width: 2200, height: 2200 },
  };

  for (const id of uniqueDesired) {
    const d = defaults[id.toLowerCase()] ?? { fit: "contain", width: 1200, height: 1200 };
    const { status, json } = await cfFetch(cfg, "/images/v1/variants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        options: {
          fit: d.fit,
          width: d.width,
          height: d.height,
          metadata: "none",
        },
        neverRequireSignedURLs: true,
      }),
    });
    const msg = json.errors?.map((e) => e.message).join("; ") || "";
    const alreadyExists = /already exists/i.test(msg);
    if (!json.success && !alreadyExists) {
      console.warn("[cloudflare-images] ensure variant failed", id, status, msg);
    }
  }

  variantsEnsureAt = now;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadImageByRemoteUrlForm(
  cfg: NonNullable<Awaited<ReturnType<typeof getResolvedCloudflareConfig>>>,
  remoteUrl: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const rawAttempts = Number(process.env.CF_MIRROR_URL_UPLOAD_ATTEMPTS || 3);
  const attempts = Number.isFinite(rawAttempts) ? Math.min(6, Math.max(1, rawAttempts)) : 3;
  const baseBackoffMs = 350;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const form = new FormData();
    form.append("url", remoteUrl);
    const { status, json } = await cfFetch(cfg, "/images/v1", { method: "POST", body: form });
    if (json.success && json.result?.id) {
      return { ok: true, id: json.result.id };
    }

    const msg = json.errors?.map((e) => e.message).join("; ") || `Upload failed (${status})`;
    const retryable = status === 429 || status >= 500;
    if (retryable && attempt < attempts) {
      await sleep(baseBackoffMs * Math.pow(2, attempt - 1));
      continue;
    }
    return { ok: false, error: msg };
  }

  return { ok: false, error: "Upload failed" };
}

/** Upload remote image URL into Cloudflare Images via direct URL ingest. */
export async function uploadImageFromUrl(remoteUrl: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const cfg = await getResolvedCloudflareConfig();
  if (!cfg || !cfg.enabled) {
    return { ok: false, error: "Cloudflare Images not configured" };
  }
  await ensureConfiguredVariants(cfg).catch((e) => {
    console.warn("[cloudflare-images] ensure variants warning", e);
  });
  return uploadImageByRemoteUrlForm(cfg, remoteUrl);
}

export async function deleteCloudflareImage(imageId: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getResolvedCloudflareConfig();
  if (!cfg || !cfg.enabled) return { ok: true };
  const { json } = await cfFetch(cfg, `/images/v1/${encodeURIComponent(imageId)}`, { method: "DELETE" });
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
    const { json } = await cfFetch(cfg, "/images/v1?per_page=1", { method: "GET" });
    if (!json.success) {
      return { ok: false, error: json.errors?.map((e) => e.message).join("; ") || "API error" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Request failed" };
  }
}
