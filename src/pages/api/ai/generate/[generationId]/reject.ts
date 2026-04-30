import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not authenticated" });
  const token = authHeader.slice(7);
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userRes.user) return res.status(401).json({ error: "Invalid token" });

  const generationId = typeof req.query.generationId === "string" ? req.query.generationId : "";
  if (!generationId) return res.status(400).json({ error: "Missing generation id" });

  const { data: profile } = await supabaseAdmin.from("profiles").select("client_id").eq("id", userRes.user.id).maybeSingle();
  const clientId = profile?.client_id;
  if (!clientId) return res.status(403).json({ error: "No client" });

  const { data: gen, error } = await supabaseAdmin
    .from("ai_generations")
    .select("id, client_id, output_storage_paths")
    .eq("id", generationId)
    .maybeSingle();
  if (error || !gen) return res.status(404).json({ error: "Generation not found" });
  if (gen.client_id !== clientId) return res.status(403).json({ error: "Forbidden" });

  const paths = gen.output_storage_paths || [];
  if (paths.length > 0) {
    await supabaseAdmin.storage.from("ai-staging").remove(paths);
  }

  await supabaseAdmin
    .from("ai_generations")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", generationId);

  return res.status(200).json({ ok: true });
}
