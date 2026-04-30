import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { GatewayName } from "@/lib/payments/types";
import { resolveGatewayFromRouting, type PaymentRegionRoutingRow } from "@/lib/payments/routing";

let cache: { rows: PaymentRegionRoutingRow[]; at: number } | null = null;
const TTL_MS = 60_000;

export async function loadPaymentRegionRoutingRows(): Promise<PaymentRegionRoutingRow[]> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.rows;

  const { data, error } = await supabaseAdmin
    .from("payment_region_routing")
    .select("country_code, gateway, enabled, priority");

  if (error) throw error;
  const rows = (data || []) as PaymentRegionRoutingRow[];
  cache = { rows, at: now };
  return rows;
}

export function invalidatePaymentRoutingCache(): void {
  cache = null;
}

export async function getResolvedGatewayForCountry(country: string | null | undefined): Promise<GatewayName> {
  try {
    const rows = await loadPaymentRegionRoutingRows();
    return resolveGatewayFromRouting(country, rows);
  } catch {
    return resolveGatewayFromRouting(country, []);
  }
}
