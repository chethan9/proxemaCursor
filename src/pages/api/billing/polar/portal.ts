import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getPolarClient } from "@/lib/payments/polar-client.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });

  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: ud } = await supa.auth.getUser();
  if (!ud?.user) return res.status(401).json({ error: "Unauthorized" });

  const { data: profile } = await supabaseAdmin.from("profiles").select("client_id").eq("id", ud.user.id).maybeSingle();
  const clientId = profile?.client_id as string | undefined;
  if (!clientId) return res.status(400).json({ error: "No client" });

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, gateway, gateway_subscription_ref, status")
    .eq("client_id", clientId)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub || sub.gateway !== "polar") {
    return res.status(400).json({ error: "No Polar-managed subscription" });
  }

  try {
    const polar = await getPolarClient();
    const host = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.host}`;
    const session = await polar.customerSessions.create({
      externalCustomerId: clientId,
      returnUrl: `${host}/billing`,
    });
    return res.status(200).json({ url: session.customerPortalUrl });
  } catch (e) {
    return res.status(502).json({ error: e instanceof Error ? e.message : "Polar portal error" });
  }
}
