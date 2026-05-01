import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";

/** Active AI features for product editor menu (authenticated). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not authenticated" });
  const token = authHeader.slice(7);
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userRes.user) return res.status(401).json({ error: "Invalid token" });

  const { data, error } = await supabaseAdmin
    .from("ai_features")
    .select(
      "id, slug, name, description, provider, model, default_output_count, supports_main, supports_gallery, credit_cost_per_output, user_input_schema, sort_order, requires_source_image"
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ features: data ?? [] });
}
