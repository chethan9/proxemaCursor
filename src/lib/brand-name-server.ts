import { supabaseAdmin } from "@/integrations/supabase/admin";
import { DEFAULT_BRAND_NAME } from "@/lib/brand-constants";
import { buildWooUserAgentFromBrand } from "@/lib/sync-error";

let cache: { name: string; at: number } | null = null;
const TTL_MS = 60_000;

export async function getBrandNameCached(): Promise<string> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.name;
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("brand_name")
      .eq("id", "global")
      .maybeSingle();
    const name = (data?.brand_name as string | undefined)?.trim() || DEFAULT_BRAND_NAME;
    cache = { name, at: now };
    return name;
  } catch {
    return DEFAULT_BRAND_NAME;
  }
}

/** WooCommerce / WordPress outbound requests — uses branding from `app_settings`. */
export async function getWooUserAgent(): Promise<string> {
  const brand = await getBrandNameCached();
  return buildWooUserAgentFromBrand(brand);
}
