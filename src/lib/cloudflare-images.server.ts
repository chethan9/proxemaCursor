/**
 * Cloudflare Images API (account upload + delete). Server-only.
 * @see https://developers.cloudflare.com/images/upload-images/upload-url/
 */

const API_BASE = "https://api.cloudflare.com/client/v4";

export function isCloudflareImagesConfigured(): boolean {
  return (
    process.env.CLOUDFLARE_PRODUCT_IMAGES_ENABLED === "true" &&
    !!process.env.CLOUDFLARE_ACCOUNT_ID &&
    !!process.env.CLOUDFLARE_API_TOKEN &&
    !!process.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH
  );
}

export function getCfImageVariantNames(): { thumb: string; card: string; edit: string; zoom: string } {
  return {
    thumb: process.env.CLOUDFLARE_IMAGES_VARIANT_THUMB || "thumb",
    card: process.env.CLOUDFLARE_IMAGES_VARIANT_CARD || "card",
    edit: process.env.CLOUDFLARE_IMAGES_VARIANT_EDIT || "edit",
    zoom: process.env.CLOUDFLARE_IMAGES_VARIANT_ZOOM || "zoom",
  };
}

export function buildDeliveryUrls(cfImageId: string): { thumb: string; card: string; edit: string; zoom: string } {
  const hash = process.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH!;
  const v = getCfImageVariantNames();
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
  errors: { message: string }[];
  result?: CfApiResult;
}

async function cfFetch(path: string, init: RequestInit): Promise<CfApiEnvelope> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
  const token = process.env.CLOUDFLARE_API_TOKEN!;
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
  if (!isCloudflareImagesConfigured()) {
    return { ok: false, error: "Cloudflare Images not configured" };
  }
  const form = new FormData();
  form.append("url", remoteUrl);
  const json = await cfFetch("/images/v1", { method: "POST", body: form });
  if (!json.success || !json.result?.id) {
    const msg = json.errors?.map((e) => e.message).join("; ") || "Upload failed";
    return { ok: false, error: msg };
  }
  return { ok: true, id: json.result.id };
}

export async function deleteCloudflareImage(imageId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isCloudflareImagesConfigured()) return { ok: true };
  const json = await cfFetch(`/images/v1/${encodeURIComponent(imageId)}`, { method: "DELETE" });
  if (!json.success) {
    const msg = json.errors?.map((e) => e.message).join("; ") || "Delete failed";
    return { ok: false, error: msg };
  }
  return { ok: true };
}
