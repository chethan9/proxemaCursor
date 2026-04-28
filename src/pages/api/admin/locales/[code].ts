import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { requireSuperAdmin } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity-log";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const code = String(req.query.code || "");

  if (req.method === "PATCH") {
    const patch = req.body as { enabled?: boolean; is_default?: boolean; name?: string; native_name?: string; dir?: "ltr" | "rtl" };

    if (patch.is_default === true) {
      await supabaseAdmin.from("locales").update({ is_default: false }).neq("code", code);
    }

    const { data: before } = await supabaseAdmin.from("locales").select("*").eq("code", code).single();
    const { data, error } = await supabaseAdmin
      .from("locales")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("code", code)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    await logActivity({
      actor_id: auth.userId,
      action: patch.is_default !== undefined ? "locale.set_default" : "locale.enabled_changed",
      entity_type: "locale",
      entity_id: code,
      before: before || undefined,
      after: data,
      ip: (req.headers["x-forwarded-for"] as string) || null,
      user_agent: req.headers["user-agent"] || null,
    });

    return res.status(200).json({ locale: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}