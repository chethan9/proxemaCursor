import type { NextApiRequest, NextApiResponse } from "next";
import type { TablesInsert } from "@/integrations/supabase/helpers";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { resolveUserFromRequest, isAdminRole } from "@/lib/server-auth";
import { invalidateAppSettingsCache } from "@/lib/app-settings.server";
import { logActivity } from "@/lib/activity-log";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const me = await resolveUserFromRequest(req);
  if (!me?.userId || !isAdminRole(me.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  if (req.method === "GET") {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("billing_enforcement_enabled, quota_grace_days")
      .eq("id", "global")
      .maybeSingle();
    return res.status(200).json({
      billingEnforcementEnabled: data?.billing_enforcement_enabled ?? true,
      quotaGraceDays: data?.quota_grace_days ?? 7,
    });
  }

  if (req.method === "POST") {
    const { billingEnforcementEnabled, quotaGraceDays } = req.body as {
      billingEnforcementEnabled?: boolean;
      quotaGraceDays?: number;
    };

    const updates: TablesInsert<"app_settings"> = { id: "global", updated_at: new Date().toISOString() };
    if (typeof billingEnforcementEnabled === "boolean") {
      updates.billing_enforcement_enabled = billingEnforcementEnabled;
    }
    if (typeof quotaGraceDays === "number" && Number.isFinite(quotaGraceDays) && quotaGraceDays >= 0 && quotaGraceDays <= 60) {
      updates.quota_grace_days = Math.round(quotaGraceDays);
    }

    const { data: before } = await supabaseAdmin
      .from("app_settings")
      .select("billing_enforcement_enabled, quota_grace_days")
      .eq("id", "global")
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert(updates, { onConflict: "id" });
    if (error) return res.status(500).json({ error: error.message });

    invalidateAppSettingsCache();

    await logActivity({
      action: "admin.billing_settings.updated",
      entityType: "app_settings",
      entityId: "global",
      actorType: "admin",
      before: (before as Record<string, unknown> | null) ?? null,
      after: updates as Record<string, unknown>,
      req,
    });

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
