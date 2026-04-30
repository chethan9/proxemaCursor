import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getResolvedGatewayForCountry } from "@/lib/payments/gateway-routing.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });

  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: ud } = await supa.auth.getUser();
  if (!ud?.user) return res.status(401).json({ error: "Unauthorized" });

  const q = typeof req.query.country === "string" ? req.query.country.trim() : "";
  const { data: profile } = await supabaseAdmin.from("profiles").select("client_id").eq("id", ud.user.id).maybeSingle();
  const clientId = profile?.client_id as string | undefined;

  let country = q || undefined;
  if (!country && clientId) {
    const { data: client } = await supabaseAdmin.from("clients").select("country").eq("id", clientId).maybeSingle();
    country = client?.country || undefined;
  }

  const gateway = await getResolvedGatewayForCountry(country);
  return res.status(200).json({ gateway, country: country || null });
}
