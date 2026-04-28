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
  try {
    const user = await checkAdminAuth(req);
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
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin.from("translations").upsert(rows, { onConflict: "locale,namespace,key" });
    if (error) return res.status(500).json({ error: error.message });

    await logActivity({
      action: "translation.bulk_imported",
      entityType: "locale",
      entityId: locale,
      after: { namespace, count: rows.length },
      req,
    });

    return res.status(200).json({ count: rows.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "Unauthorized" || msg === "Admin access required" ? 401 : 500;
    return res.status(status).json({ error: msg });
  }
}