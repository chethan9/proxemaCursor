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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await checkAdminAuth(req);
    if (req.method === "GET") {
      const { data, error } = await supabaseAdmin
        .from("locales")
        .select("*")
        .order("is_default", { ascending: false })
        .order("code");
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ locales: data });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "Unauthorized" || msg === "Admin access required" ? 401 : 500;
    return res.status(status).json({ error: msg });
  }
}