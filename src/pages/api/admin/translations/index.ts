import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { requireSuperAdmin } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity-log";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

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
          updated_by: auth.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "locale,namespace,key" }
      )
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    await logActivity({
      actor_id: auth.userId,
      action: "translation.updated",
      entity_type: "translation",
      entity_id: data.id,
      before: before || undefined,
      after: data,
      ip: (req.headers["x-forwarded-for"] as string) || null,
      user_agent: req.headers["user-agent"] || null,
    });

    return res.status(200).json({ translation: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}