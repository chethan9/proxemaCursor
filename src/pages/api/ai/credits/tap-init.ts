import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });

  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: ud } = await supa.auth.getUser();
  if (!ud?.user) return res.status(401).json({ error: "Unauthorized" });

  const { purchaseId } = req.body as { purchaseId?: string };
  if (!purchaseId) return res.status(400).json({ error: "purchaseId required" });

  const { data: purchase } = await supabaseAdmin
    .from("ai_credit_purchases")
    .select("id, client_id, status, gateway")
    .eq("id", purchaseId)
    .maybeSingle();

  if (!purchase || purchase.status !== "pending") return res.status(404).json({ error: "Purchase not found" });

  const { data: profile } = await supabaseAdmin.from("profiles").select("client_id, email, full_name").eq("id", ud.user.id).single();
  if (profile?.client_id !== purchase.client_id) return res.status(403).json({ error: "Forbidden" });

  const publishableKey = process.env.TAP_PUBLIC_KEY;
  if (!publishableKey) return res.status(503).json({ error: "Tap not configured" });

  return res.status(200).json({
    publishableKey,
    purchaseId: purchase.id,
    customerEmail: profile?.email || ud.user.email || "",
    customerName: profile?.full_name || "",
  });
}
