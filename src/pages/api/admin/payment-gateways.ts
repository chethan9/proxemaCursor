import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { createClient } from "@supabase/supabase-js";
import { clearGatewayConfigCache } from "@/lib/payments/config";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: ud } = await sb.auth.getUser();
  if (!ud?.user) return res.status(401).json({ error: "Unauthorized" });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", ud.user.id)
    .maybeSingle();
  if (!profile || profile.role !== "admin") return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("payment_gateway_settings")
      .select("*")
      .order("gateway_name");
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ items: data || [] });
  }

  if (req.method === "PUT") {
    const { gateway_name, enabled, mode, publishable_key, secret_key, webhook_secret, country_overrides, extra_config } = req.body || {};
    if (!gateway_name) return res.status(400).json({ error: "gateway_name required" });
    if (!["myfatoorah", "razorpay", "tap"].includes(gateway_name)) {
      return res.status(400).json({ error: "Invalid gateway_name" });
    }

    const update: Record<string, unknown> = { updated_by: ud.user.id };
    if (typeof enabled === "boolean") update.enabled = enabled;
    if (mode === "test" || mode === "live") update.mode = mode;
    if (typeof publishable_key === "string") update.publishable_key = publishable_key || null;
    if (typeof secret_key === "string" && secret_key !== "********") update.secret_key = secret_key || null;
    if (typeof webhook_secret === "string" && webhook_secret !== "********") update.webhook_secret = webhook_secret || null;
    if (Array.isArray(country_overrides)) update.country_overrides = country_overrides.map((c: string) => c.toUpperCase());
    if (extra_config && typeof extra_config === "object") update.extra_config = extra_config;

    const { data, error } = await supabaseAdmin
      .from("payment_gateway_settings")
      .update(update as never)
      .eq("gateway_name", gateway_name)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    clearGatewayConfigCache(gateway_name);
    return res.status(200).json(data);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
