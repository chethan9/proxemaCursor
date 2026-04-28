import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { logActivity } from "@/lib/activity-log";

async function checkAdminAuth(req: NextApiRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = authHeader.substring(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "super_admin") throw new Error("Admin access required");
  return user;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await checkAdminAuth(req);
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
        action: patch.is_default !== undefined ? "locale.set_default" : "locale.enabled_changed",
        entityType: "locale",
        entityId: code,
        before: (before || undefined) as Record<string, unknown> | undefined,
        after: data as Record<string, unknown>,
        req,
      });

      return res.status(200).json({ locale: data });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "Unauthorized" || msg === "Admin access required" ? 401 : 500;
    return res.status(status).json({ error: msg });
  }
}