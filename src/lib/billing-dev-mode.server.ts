import { supabaseAdmin } from "@/integrations/supabase/admin";

/** When true (Admin → Billing settings), subscription/credit enforcement is relaxed platform-wide. */
export async function isBillingDevMode(): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("billing_dev_mode")
    .eq("id", "global")
    .maybeSingle();
  return data?.billing_dev_mode ?? false;
}
