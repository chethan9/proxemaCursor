import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { validateCoupon } from "@/services/couponService.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });

  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: auth } } });
  const { data: ud } = await supa.auth.getUser();
  if (!ud?.user) return res.status(401).json({ error: "Unauthorized" });

  const { data: profile } = await supabaseAdmin.from("profiles").select("client_id").eq("id", ud.user.id).single();
  if (!profile?.client_id) return res.status(403).json({ error: "No client" });

  const { code, planId } = req.body as { code: string; planId: string };
  if (!code || !planId) return res.status(400).json({ error: "Missing code or planId" });

  const { data: plan } = await supabaseAdmin.from("plans").select("prices").eq("id", planId).single();
  const { data: client } = await supabaseAdmin.from("clients").select("currency").eq("id", profile.client_id).single();
  const currency = client?.currency || "USD";
  const amt = plan ? (plan.prices as Record<string, number>)[currency] : 0;

  const result = await validateCoupon(code, planId, profile.client_id, amt, currency);
  return res.status(200).json(result);
}