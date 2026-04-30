import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getAICreditsState } from "@/lib/ai-credits.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not authenticated" });
  const token = authHeader.slice(7);
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userRes.user) return res.status(401).json({ error: "Invalid token" });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("client_id")
    .eq("id", userRes.user.id)
    .maybeSingle();
  const clientId = profile?.client_id;
  if (!clientId) return res.status(403).json({ error: "No client" });

  const state = await getAICreditsState(clientId);
  if (!state) return res.status(200).json({ credits: null });

  const { data: feats } = await supabaseAdmin
    .from("ai_features")
    .select("slug, name, credit_cost_per_output")
    .eq("is_active", true);

  const { data: recentPurchases } = await supabaseAdmin
    .from("ai_credit_purchases")
    .select("id, credits, amount_minor, currency, status, gateway, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(15);

  return res.status(200).json({
    credits: {
      monthlyAllowance: state.monthlyAllowance,
      usedThisPeriod: state.usedThisPeriod,
      monthlyRemaining: state.monthlyRemaining,
      topupBalance: state.topupBalance,
      totalAvailable: state.totalAvailable,
      planName: state.planName,
    },
    features: feats ?? [],
    purchases: recentPurchases ?? [],
  });
}
