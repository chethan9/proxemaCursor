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
    const user = await checkAdminAuth(req);

    if (req.method === "GET") {
      const locale = String(req.query.locale || "");
      const namespace = req.query.namespace ? String(req.query.namespace) : null;
      if (!locale) return res.status(400).json({ error: "locale is required" });

      let query = supabaseAdmin.from("translations").select("*").eq("locale", locale);
      if (namespace) query = query.eq("namespace", namespace);
      const { data, error } = await query.order("namespace").order("key");
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ translations: data });
    }

    if (req.method === "POST") {
      const body = req.body as { locale: string; namespace: string; key: string; value: string; needs_review?: boolean };
      if (!body.locale || !body.namespace || !body.key) {
        return res.status(400).json({ error: "locale, namespace, key required" });
      }

      const { data: before } = await supabaseAdmin
        .from("translations")
        .select("*")
        .eq("locale", body.locale)
        .eq("namespace", body.namespace)
        .eq("key", body.key)
        .maybeSingle();

      const { data, error } = await supabaseAdmin
        .from("translations")
        .upsert(
          {
            locale: body.locale,
            namespace: body.namespace,
            key: body.key,
            value: body.value,
            needs_review: body.needs_review ?? false,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "locale,namespace,key" }
        )
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });

      await logActivity({
        action: "translation.updated",
        entityType: "translation",
        entityId: data.id,
        before: (before || undefined) as Record<string, unknown> | undefined,
        after: data as Record<string, unknown>,
        req,
      });

      return res.status(200).json({ translation: data });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "Unauthorized" || msg === "Admin access required" ? 401 : 500;
    return res.status(status).json({ error: msg });
  }
}