import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AppSettings {
  billingEnforcementEnabled: boolean;
  quotaGraceDays: number;
  /** Super-admin only: relaxes all plan/subscription gates and quota limits for QA */
  billingDevMode: boolean;
}

const DEFAULTS: AppSettings = {
  billingEnforcementEnabled: true,
  quotaGraceDays: 7,
  billingDevMode: false,
};

async function fetchAppSettings(): Promise<AppSettings> {
  const { data } = await supabase
    .from("app_settings")
    .select("billing_enforcement_enabled, quota_grace_days, billing_dev_mode")
    .eq("id", "global")
    .maybeSingle();
  if (!data) return DEFAULTS;
  return {
    billingEnforcementEnabled: data.billing_enforcement_enabled ?? DEFAULTS.billingEnforcementEnabled,
    quotaGraceDays: data.quota_grace_days ?? DEFAULTS.quotaGraceDays,
    billingDevMode: data.billing_dev_mode ?? DEFAULTS.billingDevMode,
  };
}

export function useAppSettings() {
  const q = useQuery({
    queryKey: ["app-settings", "global"],
    queryFn: fetchAppSettings,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
  return {
    settings: q.data ?? DEFAULTS,
    isLoading: q.isLoading,
    refetch: q.refetch,
  };
}
