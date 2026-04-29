import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";

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

function setNested(target: Record<string, unknown>, key: string, value: string) {
  const parts = key.split(".");
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    const existing = cursor[p];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
      cursor[p] = {};
    }
    cursor = cursor[p] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await checkAdminAuth(req);
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

    const locale = String(req.query.locale || "");
    const namespace = req.query.namespace ? String(req.query.namespace) : null;
    if (!locale) return res.status(400).json({ error: "locale is required" });

    let query = supabaseAdmin.from("translations").select("namespace,key,value").eq("locale", locale);
    if (namespace) query = query.eq("namespace", namespace);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    if (namespace) {
      const out: Record<string, unknown> = {};
      for (const row of data || []) setNested(out, row.key, row.value);
      return res.status(200).json(out);
    }

    const grouped: Record<string, Record<string, unknown>> = {};
    for (const row of data || []) {
      grouped[row.namespace] = grouped[row.namespace] || {};
      setNested(grouped[row.namespace], row.key, row.value);
    }
    return res.status(200).json(grouped);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "Unauthorized" || msg === "Admin access required" ? 401 : 500;
    return res.status(status).json({ error: msg });
  }
}
