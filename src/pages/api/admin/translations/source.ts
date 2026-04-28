import type { NextApiRequest, NextApiResponse } from "next";
import { promises as fs } from "fs";
import path from "path";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { NAMESPACES } from "@/lib/i18n";

async function checkAdminAuth(req: NextApiRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = authHeader.substring(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "super_admin") throw new Error("Admin access required");
}

function flatten(obj: Record<string, unknown>, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flatten(v as Record<string, unknown>, key, out);
    } else if (typeof v === "string") {
      out[key] = v;
    }
  }
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await checkAdminAuth(req);
    const locale = String(req.query.locale || "en");
    const namespace = req.query.namespace ? String(req.query.namespace) : null;

    const namespaces = namespace ? [namespace] : [...NAMESPACES];
    const result: Record<string, Record<string, string>> = {};

    for (const ns of namespaces) {
      try {
        const filePath = path.join(process.cwd(), "public", "locales", locale, `${ns}.json`);
        const txt = await fs.readFile(filePath, "utf-8");
        result[ns] = flatten(JSON.parse(txt));
      } catch {
        result[ns] = {};
      }
    }

    return res.status(200).json({ source: result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "Unauthorized" || msg === "Admin access required" ? 401 : 500;
    return res.status(status).json({ error: msg });
  }
}