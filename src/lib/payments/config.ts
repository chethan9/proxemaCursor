import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { GatewayName } from "./types";

export type GatewaySettings = {
  gateway_name: GatewayName;
  enabled: boolean;
  mode: "test" | "live";
  publishable_key: string | null;
  secret_key: string | null;
  webhook_secret: string | null;
  extra_config: Record<string, unknown> | null;
  country_overrides: string[] | null;
};

const cache = new Map<string, { value: GatewaySettings | null; ts: number }>();
const TTL_MS = 30_000;

export async function loadGatewayConfig(name: GatewayName): Promise<GatewaySettings | null> {
  const hit = cache.get(name);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.value;
  const { data } = await supabaseAdmin
    .from("payment_gateway_settings")
    .select("gateway_name, enabled, mode, publishable_key, secret_key, webhook_secret, extra_config, country_overrides")
    .eq("gateway_name", name)
    .maybeSingle();
  const value = (data as GatewaySettings | null) || null;
  cache.set(name, { value, ts: Date.now() });
  return value;
}

export function clearGatewayConfigCache(name?: GatewayName) {
  if (name) cache.delete(name); else cache.clear();
}

export async function getEffectiveSecret(name: GatewayName, envVar: string): Promise<string> {
  const cfg = await loadGatewayConfig(name);
  if (cfg?.enabled && cfg.secret_key) return cfg.secret_key;
  return process.env[envVar] || "";
}

export async function getEffectivePublishable(name: GatewayName, envVar: string): Promise<string> {
  const cfg = await loadGatewayConfig(name);
  if (cfg?.enabled && cfg.publishable_key) return cfg.publishable_key;
  return process.env[envVar] || "";
}

export async function getEffectiveWebhookSecret(name: GatewayName, envVar: string): Promise<string> {
  const cfg = await loadGatewayConfig(name);
  if (cfg?.enabled && cfg.webhook_secret) return cfg.webhook_secret;
  return process.env[envVar] || "";
}

export async function loadCountryOverrides(): Promise<Record<string, GatewayName>> {
  const { data } = await supabaseAdmin
    .from("payment_gateway_settings")
    .select("gateway_name, country_overrides, enabled")
    .eq("enabled", true);
  const overrides: Record<string, GatewayName> = {};
  for (const s of (data || []) as Array<{ gateway_name: string; country_overrides: string[] | null }>) {
    if (!s.country_overrides) continue;
    for (const c of s.country_overrides) overrides[c.toUpperCase()] = s.gateway_name as GatewayName;
  }
  return overrides;
}
