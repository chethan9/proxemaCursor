import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import {
  CLOUDFLARE_SETTINGS_SINGLETON_ID,
  getResolvedCloudflareConfig,
  invalidateCloudflareConfigCache,
  isCloudflareEnvConfigured,
} from "@/lib/cloudflare-images-config.server";
import { testCloudflareImagesConnection } from "@/lib/cloudflare-images.server";
import { resolveUserFromRequest } from "@/lib/server-auth";
import { logActivity } from "@/lib/activity-log";
import { encryptCredentialWithPaymentKey } from "@/lib/credential-crypto.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const me = await resolveUserFromRequest(req);
  if (!me?.userId || me.role !== "super_admin") {
    return res.status(403).json({ error: "Super admin only" });
  }

  if (req.method === "GET") {
    const { data: row, error } = await supabaseAdmin
      .from("cloudflare_images_settings")
      .select("*")
      .eq("id", CLOUDFLARE_SETTINGS_SINGLETON_ID)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });

    const resolved = await getResolvedCloudflareConfig();

    return res.status(200).json({
      row: row
        ? {
            enabled: row.enabled,
            prefer_database_over_env: row.prefer_database_over_env,
            account_id: row.account_id,
            images_account_hash: row.images_account_hash,
            api_token_configured: Boolean(row.api_token_encrypted),
            variant_thumb: row.variant_thumb,
            variant_card: row.variant_card,
            variant_edit: row.variant_edit,
            variant_zoom: row.variant_zoom,
            mirror_metrics_enabled: row.mirror_metrics_enabled,
            repair_batch_size: row.repair_batch_size,
            updated_at: row.updated_at,
          }
        : null,
      resolvedSource: resolved?.source ?? null,
      resolvedActive: resolved != null,
      envFallbackAvailable: isCloudflareEnvConfigured(),
    });
  }

  if (req.method === "PUT" || req.method === "POST") {
    const body = req.body as {
      action?: string;
      enabled?: boolean;
      prefer_database_over_env?: boolean;
      account_id?: string | null;
      images_account_hash?: string | null;
      api_token?: string | null;
      variant_thumb?: string | null;
      variant_card?: string | null;
      variant_edit?: string | null;
      variant_zoom?: string | null;
      mirror_metrics_enabled?: boolean;
      repair_batch_size?: number | null;
    };

    if (body.action === "test") {
      const cfg = await getResolvedCloudflareConfig({ requireIntegrationEnabled: false });
      if (!cfg) {
        const envOk = isCloudflareEnvConfigured();
        return res.status(400).json({
          error: "No usable Cloudflare Images credentials (database or environment)",
          hint:
            "Database: save account ID, hash, and API token (encryption needs PAYMENT_ENCRYPTION_KEY on Vercel). " +
            "If mirroring is still toggled off, that only blocks uploads — test uses saved credentials. " +
            (envOk ?
              ""
            : "Environment fallback needs CLOUDFLARE_PRODUCT_IMAGES_ENABLED=true plus CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_IMAGES_ACCOUNT_HASH."),
        });
      }
      const test = await testCloudflareImagesConnection(cfg);
      await logActivity({
        action: "admin.cloudflare_images.test",
        entityType: "cloudflare_images_settings",
        entityId: CLOUDFLARE_SETTINGS_SINGLETON_ID,
        actorType: "admin",
        metadata: { module: "admin", ok: test.ok, source: cfg.source },
        req,
      });
      return res.status(200).json(test);
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: me.userId,
    };

    if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
    if (typeof body.prefer_database_over_env === "boolean") patch.prefer_database_over_env = body.prefer_database_over_env;
    if (body.account_id !== undefined) patch.account_id = body.account_id?.trim() || null;
    if (body.images_account_hash !== undefined) patch.images_account_hash = body.images_account_hash?.trim() || null;
    if (body.variant_thumb !== undefined) patch.variant_thumb = body.variant_thumb?.trim() || "thumb";
    if (body.variant_card !== undefined) patch.variant_card = body.variant_card?.trim() || "card";
    if (body.variant_edit !== undefined) patch.variant_edit = body.variant_edit?.trim() || "edit";
    if (body.variant_zoom !== undefined) patch.variant_zoom = body.variant_zoom?.trim() || "zoom";
    if (typeof body.mirror_metrics_enabled === "boolean") patch.mirror_metrics_enabled = body.mirror_metrics_enabled;
    if (body.repair_batch_size !== undefined) {
      patch.repair_batch_size =
        body.repair_batch_size == null
          ? null
          : Math.min(500, Math.max(10, Number(body.repair_batch_size)));
    }

    if (body.api_token != null && String(body.api_token).trim()) {
      try {
        const { data: enc, error: encErr } = await encryptCredentialWithPaymentKey(String(body.api_token).trim());
        if (encErr || enc == null) {
          return res.status(500).json({
            error:
              encErr?.message ||
              "Encrypt failed — ensure PAYMENT_ENCRYPTION_KEY is set in Vercel (same key used for payment credentials).",
          });
        }
        patch.api_token_encrypted = enc;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Encrypt failed";
        return res.status(500).json({
          error:
            msg.includes("PAYMENT_ENCRYPTION_KEY") ?
              "Server missing PAYMENT_ENCRYPTION_KEY — add it to Vercel environment variables, then redeploy."
            : msg,
        });
      }
    }

    const { error: upErr } = await supabaseAdmin
      .from("cloudflare_images_settings")
      .update(patch as never)
      .eq("id", CLOUDFLARE_SETTINGS_SINGLETON_ID);

    if (upErr) return res.status(500).json({ error: upErr.message });

    invalidateCloudflareConfigCache();

    await logActivity({
      action: "admin.cloudflare_images.updated",
      entityType: "cloudflare_images_settings",
      entityId: CLOUDFLARE_SETTINGS_SINGLETON_ID,
      actorType: "admin",
      metadata: {
        module: "admin",
        keys: Object.keys(patch).filter((k) => k !== "updated_at" && k !== "updated_by"),
      },
      req,
    });

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
