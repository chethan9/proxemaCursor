import { supabaseAdmin } from "@/integrations/supabase/admin";

export interface AppSettingsServer {
  billingEnforcementEnabled: boolean;
  quotaGraceDays: number;
}

const DEFAULTS: AppSettingsServer = {
  billingEnforcementEnabled: true,
  quotaGraceDays: 7,
};

let cache: { value: AppSettingsServer; ts: number } | null = null;
const TTL_MS = 30_000;

export async function getAppSettings(): Promise<AppSettingsServer> {
  if (cache && Date.now() - cache.ts < TTL_MS) return cache.value;
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("billing_enforcement_enabled, quota_grace_days")
    .eq("id", "global")
    .maybeSingle();
  const value: AppSettingsServer = data
    ? {
        billingEnforcementEnabled: data.billing_enforcement_enabled ?? DEFAULTS.billingEnforcementEnabled,
        quotaGraceDays: data.quota_grace_days ?? DEFAULTS.quotaGraceDays,
      }
    : DEFAULTS;
  cache = { value, ts: Date.now() };
  return value;
}

export function invalidateAppSettingsCache() {
  cache = null;
}
