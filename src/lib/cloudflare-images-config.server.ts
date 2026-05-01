/**
 * Resolves Cloudflare Images credentials from database (singleton row) with fallback to env vars.
 * Server-only; cached briefly to limit DB reads on hot paths.
 */

import { supabaseAdmin } from "@/integrations/supabase/admin";
import { decryptCredentialWithPaymentKey } from "@/lib/credential-crypto.server";

export const CLOUDFLARE_SETTINGS_SINGLETON_ID = "a0000000-0000-4000-8000-000000000001";

const CACHE_TTL_MS = 45_000;

export type ResolvedCloudflareConfig = {
  enabled: boolean;
  accountId: string;
  apiToken: string;
  accountHash: string;
  variants: { thumb: string; card: string; edit: string; zoom: string };
  metricsEnabled: boolean;
  repairBatchSize: number;
  source: "database" | "env";
};

type CacheEntry = { value: ResolvedCloudflareConfig | null; expires: number };
let cache: CacheEntry | null = null;

export function invalidateCloudflareConfigCache(): void {
  cache = null;
}

function envConfigComplete(): boolean {
  return (
    process.env.CLOUDFLARE_PRODUCT_IMAGES_ENABLED === "true" &&
    !!process.env.CLOUDFLARE_ACCOUNT_ID?.trim() &&
    !!process.env.CLOUDFLARE_API_TOKEN?.trim() &&
    !!process.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH?.trim()
  );
}

function buildFromEnv(): ResolvedCloudflareConfig {
  return {
    enabled: true,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!.trim(),
    apiToken: process.env.CLOUDFLARE_API_TOKEN!.trim(),
    accountHash: process.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH!.trim(),
    variants: {
      thumb: process.env.CLOUDFLARE_IMAGES_VARIANT_THUMB || "thumb",
      card: process.env.CLOUDFLARE_IMAGES_VARIANT_CARD || "card",
      edit: process.env.CLOUDFLARE_IMAGES_VARIANT_EDIT || "edit",
      zoom: process.env.CLOUDFLARE_IMAGES_VARIANT_ZOOM || "zoom",
    },
    metricsEnabled: process.env.CLOUDFLARE_IMAGE_MIRROR_METRICS === "true",
    repairBatchSize: Math.min(
      500,
      Math.max(10, Number(process.env.CF_MIRROR_REPAIR_BATCH) || 50)
    ),
    source: "env",
  };
}

async function buildFromDatabaseRow(row: {
  account_id: string | null;
  images_account_hash: string | null;
  api_token_encrypted: string | null;
  variant_thumb: string;
  variant_card: string;
  variant_edit: string;
  variant_zoom: string;
  mirror_metrics_enabled: boolean;
  repair_batch_size: number | null;
}): Promise<ResolvedCloudflareConfig | null> {
  if (!row.account_id?.trim() || !row.images_account_hash?.trim() || !row.api_token_encrypted) {
    return null;
  }
  const decrypted = await decryptCredentialWithPaymentKey(row.api_token_encrypted);
  if (!decrypted) {
    console.warn("[cloudflare-images-config] decrypt failed (missing PAYMENT_ENCRYPTION_KEY or wrong key)");
    return null;
  }
  const rb = row.repair_batch_size;
  const repairBatchSize =
    rb != null && Number.isFinite(rb) ? Math.min(500, Math.max(10, rb)) : 50;

  return {
    enabled: true,
    accountId: row.account_id.trim(),
    apiToken: decrypted.trim(),
    accountHash: row.images_account_hash.trim(),
    variants: {
      thumb: row.variant_thumb?.trim() || "thumb",
      card: row.variant_card?.trim() || "card",
      edit: row.variant_edit?.trim() || "edit",
      zoom: row.variant_zoom?.trim() || "zoom",
    },
    metricsEnabled:
      row.mirror_metrics_enabled || process.env.CLOUDFLARE_IMAGE_MIRROR_METRICS === "true",
    repairBatchSize,
    source: "database",
  };
}

export type ResolveCloudflareConfigOptions = {
  /**
   * When true (default), the DB row must have `enabled === true` to resolve from database.
   * Set false for admin "test connection" so credentials can be validated before turning integration on.
   * Runtime mirroring always uses the default (enabled row required).
   */
  requireIntegrationEnabled?: boolean;
};

export async function getResolvedCloudflareConfig(
  opts?: ResolveCloudflareConfigOptions,
): Promise<ResolvedCloudflareConfig | null> {
  const requireIntegrationEnabled = opts?.requireIntegrationEnabled !== false;
  const now = Date.now();

  if (requireIntegrationEnabled && cache && now < cache.expires) {
    return cache.value;
  }

  const { data: row } = await supabaseAdmin
    .from("cloudflare_images_settings")
    .select("*")
    .eq("id", CLOUDFLARE_SETTINGS_SINGLETON_ID)
    .maybeSingle();

  const preferDb = row?.prefer_database_over_env !== false;

  let resolved: ResolvedCloudflareConfig | null = null;

  const tryDb = async (): Promise<ResolvedCloudflareConfig | null> => {
    if (!row) return null;
    if (requireIntegrationEnabled && row.enabled !== true) return null;
    return buildFromDatabaseRow(row);
  };

  const tryEnv = (): ResolvedCloudflareConfig | null => {
    if (!envConfigComplete()) return null;
    return buildFromEnv();
  };

  if (preferDb) {
    resolved = await tryDb();
    if (!resolved) resolved = tryEnv();
  } else {
    resolved = tryEnv();
    if (!resolved) resolved = await tryDb();
  }

  if (requireIntegrationEnabled) {
    cache = { value: resolved, expires: now + CACHE_TTL_MS };
  }
  return resolved;
}

/** Sync check: env vars only (no DB); useful for tooling. */
export function isCloudflareEnvConfigured(): boolean {
  return envConfigComplete();
}
