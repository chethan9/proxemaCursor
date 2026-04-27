import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import {
  listGatewayConfigs,
  upsertGatewayConfig,
  testGatewayConnection,
  regenerateWebhookSecret,
  listRegionRouting,
  updateRegionRouting,
} from "@/services/paymentGatewayService.server";
import { logActivity } from "@/lib/activity-log";

async function checkAdminAuth(req: NextApiRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authHeader.substring(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) throw new Error("Unauthorized");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Admin access required");
  return user;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = await checkAdminAuth(req);

    if (req.method === "GET") {
      const { action } = req.query;
      if (action === "routing") {
        const routing = await listRegionRouting();
        return res.json(routing);
      }
      const configs = await listGatewayConfigs();
      const masked = configs.map((c) => ({
        ...c,
        api_key_encrypted: c.api_key_encrypted ? "***" : null,
        api_secret_encrypted: c.api_secret_encrypted ? "***" : null,
        webhook_secret_encrypted: c.webhook_secret_encrypted ? "***" : null,
      }));
      return res.json(masked);
    }

    if (req.method === "POST") {
      const { action, gateway, mode, credentials, country_code, enabled, priority } = req.body;

      if (action === "test") {
        const result = await testGatewayConnection(gateway, mode);
        await logActivity({
          action: "payment_gateway.test_connection",
          entityType: "payment_gateway",
          entityId: `${gateway}_${mode}`,
          metadata: { gateway, mode, success: result.success },
        });
        return res.json(result);
      }

      if (action === "regenerate_webhook") {
        const newSecret = await regenerateWebhookSecret(gateway, mode);
        await logActivity({
          action: "payment_gateway.regenerate_webhook",
          entityType: "payment_gateway",
          entityId: `${gateway}_${mode}`,
          metadata: { gateway, mode },
        });
        return res.json({ webhook_secret: newSecret });
      }

      if (action === "update_routing") {
        const result = await updateRegionRouting(country_code, gateway, enabled, priority);
        await logActivity({
          action: "payment_gateway.update_routing",
          entityType: "payment_region_routing",
          entityId: result.id,
          metadata: { country_code, gateway, enabled, priority },
        });
        return res.json(result);
      }

      const existing = await supabaseAdmin
        .from("payment_gateway_config")
        .select("*")
        .eq("gateway", gateway)
        .eq("mode", mode)
        .single();

      const config = await upsertGatewayConfig(gateway, mode, credentials);
      
      await logActivity({
        action: existing.data ? "payment_gateway.update" : "payment_gateway.create",
        entityType: "payment_gateway",
        entityId: config.id,
        metadata: {
          gateway,
          mode,
          enabled: credentials.enabled,
          fields_updated: Object.keys(credentials),
        },
      });

      return res.json({ ...config, api_key_encrypted: "***", api_secret_encrypted: "***", webhook_secret_encrypted: "***" });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Payment gateway API error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
}