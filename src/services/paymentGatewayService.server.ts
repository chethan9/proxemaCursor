import { supabaseAdmin } from "@/integrations/supabase/admin";
import { decryptCredentialWithPaymentKey, encryptCredentialWithPaymentKey } from "@/lib/credential-crypto.server";
import type { Database } from "@/integrations/supabase/types";

type GatewayConfig = Database["public"]["Tables"]["payment_gateway_config"]["Row"];
type GatewayConfigInsert = Database["public"]["Tables"]["payment_gateway_config"]["Insert"];

export async function listGatewayConfigs() {
  const { data, error } = await supabaseAdmin
    .from("payment_gateway_config")
    .select("*")
    .order("gateway", { ascending: true })
    .order("mode", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getGatewayConfig(gateway: string, mode: "test" | "live") {
  const { data, error } = await supabaseAdmin
    .from("payment_gateway_config")
    .select("*")
    .eq("gateway", gateway)
    .eq("mode", mode)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function upsertGatewayConfig(
  gateway: string,
  mode: "test" | "live",
  credentials: {
    api_key?: string;
    api_secret?: string;
    webhook_secret?: string;
    additional_config?: Record<string, unknown>;
    enabled?: boolean;
  },
) {
  if (!process.env.PAYMENT_ENCRYPTION_KEY?.trim()) throw new Error("PAYMENT_ENCRYPTION_KEY not configured");

  const payload: Partial<GatewayConfigInsert> = {
    gateway,
    mode,
    enabled: credentials.enabled,
    additional_config: credentials.additional_config as any,
  };

  if (credentials.api_key) {
    const { data: encrypted, error } = await encryptCredentialWithPaymentKey(credentials.api_key);
    if (error) throw error;
    payload.api_key_encrypted = encrypted;
  }

  if (credentials.api_secret) {
    const { data: encrypted, error } = await encryptCredentialWithPaymentKey(credentials.api_secret);
    if (error) throw error;
    payload.api_secret_encrypted = encrypted;
  }

  if (credentials.webhook_secret) {
    const { data: encrypted, error } = await encryptCredentialWithPaymentKey(credentials.webhook_secret);
    if (error) throw error;
    payload.webhook_secret_encrypted = encrypted;
  }

  const { data, error } = await supabaseAdmin
    .from("payment_gateway_config")
    .upsert(payload as GatewayConfigInsert, { onConflict: "gateway,mode" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function decryptGatewayCredentials(config: GatewayConfig) {
  const result: {
    api_key?: string;
    api_secret?: string;
    webhook_secret?: string;
  } = {};

  if (config.api_key_encrypted) {
    const data = await decryptCredentialWithPaymentKey(config.api_key_encrypted);
    if (data) result.api_key = data;
  }

  if (config.api_secret_encrypted) {
    const data = await decryptCredentialWithPaymentKey(config.api_secret_encrypted);
    if (data) result.api_secret = data;
  }

  if (config.webhook_secret_encrypted) {
    const data = await decryptCredentialWithPaymentKey(config.webhook_secret_encrypted);
    if (data) result.webhook_secret = data;
  }

  return result;
}

export async function testGatewayConnection(gateway: string, mode: "test" | "live") {
  const config = await getGatewayConfig(gateway, mode);
  if (!config) throw new Error("Gateway config not found");

  const credentials = await decryptGatewayCredentials(config);
  if (!credentials.api_key) throw new Error("API key not configured");

  const testResult: { success: boolean; error?: string } = { success: false };

  try {
    if (gateway === "myfatoorah") {
      const baseUrl = mode === "live" 
        ? "https://api.myfatoorah.com"
        : "https://apitest.myfatoorah.com";
      const response = await fetch(`${baseUrl}/v2/GetCountries`, {
        headers: { Authorization: `Bearer ${credentials.api_key}` },
      });
      testResult.success = response.ok;
      if (!response.ok) testResult.error = await response.text();
    } else if (gateway === "razorpay") {
      const auth = Buffer.from(`${credentials.api_key}:${credentials.api_secret}`).toString("base64");
      const response = await fetch("https://api.razorpay.com/v1/payments?count=1", {
        headers: { Authorization: `Basic ${auth}` },
      });
      testResult.success = response.ok;
      if (!response.ok) testResult.error = await response.text();
    } else if (gateway === "tap") {
      const response = await fetch("https://api.tap.company/v2/charges", {
        method: "GET",
        headers: { Authorization: `Bearer ${credentials.api_secret}` },
      });
      testResult.success = response.ok;
      if (!response.ok) testResult.error = await response.text();
    } else if (gateway === "polar") {
      const base =
        mode === "live" ? "https://api.polar.sh" : "https://sandbox-api.polar.sh";
      const response = await fetch(`${base}/v1/products/?limit=1`, {
        headers: { Authorization: `Bearer ${credentials.api_key}` },
      });
      testResult.success = response.ok;
      if (!response.ok) testResult.error = await response.text();
    }
  } catch (err) {
    testResult.error = err instanceof Error ? err.message : String(err);
  }

  await supabaseAdmin
    .from("payment_gateway_config")
    .update({
      last_test_at: new Date().toISOString(),
      last_test_status: testResult.success ? "success" : "failed",
      last_test_error: testResult.error || null,
    })
    .eq("gateway", gateway)
    .eq("mode", mode);

  return testResult;
}

export async function regenerateWebhookSecret(gateway: string, mode: "test" | "live") {
  const newSecret = `whsec_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
  
  await upsertGatewayConfig(gateway, mode, { webhook_secret: newSecret });
  
  return newSecret;
}

export async function listRegionRouting() {
  const { data, error } = await supabaseAdmin
    .from("payment_region_routing")
    .select("*")
    .order("country_code", { ascending: true })
    .order("priority", { ascending: true });
  if (error) throw error;
  return data;
}

export async function updateRegionRouting(
  country_code: string,
  gateway: string,
  enabled: boolean,
  priority?: number,
) {
  const { data, error } = await supabaseAdmin
    .from("payment_region_routing")
    .upsert(
      { country_code, gateway, enabled, priority: priority ?? 1 },
      { onConflict: "country_code,gateway" },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}