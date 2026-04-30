import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { resolveUserFromRequest } from "@/lib/server-auth";
import { logActivity } from "@/lib/activity-log";

const PROVIDERS = ["google_gemini", "openai_image"] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const me = await resolveUserFromRequest(req);
  if (!me?.userId || me.role !== "super_admin") {
    return res.status(403).json({ error: "Super admin only" });
  }

  if (req.method === "GET") {
    const { data: rows } = await supabaseAdmin.from("ai_provider_credentials").select("provider, is_active, updated_at, extra");
    const map: Record<string, { configured: boolean; isActive: boolean; updatedAt: string | null }> = {};
    for (const p of PROVIDERS) {
      const r = (rows || []).find((x) => x.provider === p);
      map[p] = {
        configured: Boolean(r && (r as { is_active?: boolean }).is_active !== false),
        isActive: Boolean((r as { is_active?: boolean } | undefined)?.is_active),
        updatedAt: (r as { updated_at?: string } | null)?.updated_at ?? null,
      };
    }
    return res.status(200).json({ providers: map });
  }

  if (req.method === "POST" || req.method === "PUT") {
    const body = req.body as {
      googleGeminiApiKey?: string;
      openaiApiKey?: string;
      google_gemini?: { apiKey?: string; isActive?: boolean };
      openai_image?: { apiKey?: string; isActive?: boolean };
    };

    const updates: Array<{ provider: string; key?: string; isActive?: boolean }> = [];
    if (body.googleGeminiApiKey?.trim()) updates.push({ provider: "google_gemini", key: body.googleGeminiApiKey.trim() });
    if (body.openaiApiKey?.trim()) updates.push({ provider: "openai_image", key: body.openaiApiKey.trim() });
    if (body.google_gemini?.apiKey?.trim()) updates.push({ provider: "google_gemini", key: body.google_gemini.apiKey.trim() });
    if (body.openai_image?.apiKey?.trim()) updates.push({ provider: "openai_image", key: body.openai_image.apiKey.trim() });

    for (const u of updates) {
      const { data: enc, error: encErr } = await supabaseAdmin.rpc("encrypt_credential", {
        credential: u.key!,
        key_env_var: "PAYMENT_ENCRYPTION_KEY",
      });
      if (encErr || enc == null) return res.status(500).json({ error: encErr?.message || "Encrypt failed" });

      const { error } = await supabaseAdmin.from("ai_provider_credentials").upsert(
        {
          provider: u.provider,
          api_key_encrypted: enc,
          is_active: true,
          updated_by: me.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "provider" }
      );
      if (error) return res.status(500).json({ error: error.message });
    }

    await logActivity({
      action: "admin.ai_settings.updated",
      entityType: "ai_provider_credentials",
      entityId: "global",
      actorType: "admin",
      metadata: { module: "admin", providers: updates.map((x) => x.provider) },
      req,
    });

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
