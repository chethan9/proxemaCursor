import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { syncPlanToPolar, syncAllPlansToPolar } from "@/lib/payments/polar-plan-sync.server";
import { getPolarServerEnv } from "@/lib/payments/polar-env.server";

async function requireSuperAdmin(req: NextApiRequest) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = auth.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");
  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin" && profile?.role !== "admin") throw new Error("Admin access required");
  return user;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    await requireSuperAdmin(req);
    const planId = req.query.id as string | undefined;
    if (!planId) return res.status(400).json({ error: "Plan id required" });

    const result = await syncPlanToPolar(planId);
    return res.status(200).json({
      ok: true,
      env: result.env,
      refs: result.refs,
      polarServer: await getPolarServerEnv(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    const code = msg.includes("Unauthorized") ? 401 : msg.includes("Admin") ? 403 : 400;
    return res.status(code).json({ error: msg });
  }
}
