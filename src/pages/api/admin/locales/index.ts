import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { requireSuperAdmin } from "@/lib/api-auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireSuperAdmin(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

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
}