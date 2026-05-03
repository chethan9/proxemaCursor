import { createHmac } from "crypto";

export type MetabaseEmbedResourceType = "dashboard" | "question";

function base64UrlEncodeUtf8(data: string): string {
  return Buffer.from(data, "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlEncodeJson(obj: unknown): string {
  return base64UrlEncodeUtf8(JSON.stringify(obj));
}

/** HS256 JWT for Metabase static embedding (same secret as Metabase Admin → Embedding). */
export function signMetabaseEmbedJwt(payload: Record<string, unknown>, secret: string): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncodeJson(header);
  const encodedPayload = base64UrlEncodeJson(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret)
    .update(signingInput)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${signingInput}.${signature}`;
}

function normalizeOrigin(siteUrl: string): string {
  const u = new URL(siteUrl);
  return `${u.protocol}//${u.host}`;
}

export function getMetabaseEmbeddingSecret(): string | undefined {
  return process.env.METABASE_EMBEDDING_SECRET?.trim() || undefined;
}

/** Env slug for locked dashboard parameter (must match Metabase field slug). Default: store_id */
export function getStoreParamSlug(): string {
  return process.env.METABASE_STORE_PARAM_SLUG?.trim() || "store_id";
}

export function mergeEmbedParams(
  lockedParams: Record<string, unknown> | null,
  storeId: string
): Record<string, string> {
  const slug = getStoreParamSlug();
  const merged: Record<string, string> = {};
  if (lockedParams && typeof lockedParams === "object") {
    for (const [k, v] of Object.entries(lockedParams)) {
      if (v === undefined || v === null) continue;
      merged[k] = typeof v === "string" ? v : String(v);
    }
  }
  merged[slug] = storeId;
  return merged;
}

export function buildMetabaseEmbedPayload(options: {
  resourceType: MetabaseEmbedResourceType;
  resourceId: number;
  params: Record<string, string>;
  expiresInSeconds?: number;
}): Record<string, unknown> {
  const exp = Math.floor(Date.now() / 1000) + (options.expiresInSeconds ?? 600);
  const resourceKey = options.resourceType === "dashboard" ? "dashboard" : "question";
  return {
    resource: { [resourceKey]: options.resourceId },
    params: options.params,
    exp,
  };
}

export function buildMetabaseEmbedIframeUrl(options: {
  metabaseSiteUrl: string;
  resourceType: MetabaseEmbedResourceType;
  token: string;
  bordered?: boolean;
  titled?: boolean;
}): string {
  const origin = normalizeOrigin(options.metabaseSiteUrl);
  const path =
    options.resourceType === "dashboard"
      ? `/embed/dashboard/${options.token}`
      : `/embed/question/${options.token}`;
  const url = new URL(path, origin);
  const hash = new URLSearchParams({
    bordered: String(options.bordered ?? true),
    titled: String(options.titled ?? true),
  }).toString();
  url.hash = hash;
  return url.toString();
}
