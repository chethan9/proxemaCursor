import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { requireSuperAdmin } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity-log";

function flatten(obj: Record<string, unknown>, prefix = "", out: { key: string; value: string }[] = []): { key: string; value: string }[] {
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flatten(v as Record<string, unknown>, full, out);
    } else if (typeof v === "string") {
      out.push({ key: full, value: v });
    }
  }
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { locale, namespace, json } = req.body as { locale: string; namespace: string; json: Record<string, unknown> };
  if (!locale || !namespace || !json) return res.status(400).json({ error: "locale, namespace, json required" });

  const flat = flatten(json);
  if (flat.length === 0) return res.status(200).json({ count: 0 });

  const rows = flat.map((f) => ({
    locale,
    namespace,
    key: f.key,
    value: f.value,
    needs_review: false,
    updated_by: auth.userId,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabaseAdmin.from("translations").upsert(rows, { onConflict: "locale,namespace,key" });
  if (error) return res.status(500).json({ error: error.message });

  await logActivity({
    actor_id: auth.userId,
    action: "translation.bulk_imported",
    entity_type: "locale",
    entity_id: locale,
    after: { namespace, count: rows.length },
    ip: (req.headers["x-forwarded-for"] as string) || null,
    user_agent: req.headers["user-agent"] || null,
  });

  return res.status(200).json({ count: rows.length });
}