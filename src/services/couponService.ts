import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type BillingCoupon = Tables<"billing_coupons">;

export function computeDiscount(coupon: BillingCoupon, amountMinor: number, currency: string): number {
  if (coupon.type === "percent") return Math.floor((amountMinor * Number(coupon.value)) / 100);
  if (coupon.type === "fixed") {
    if (coupon.currency && coupon.currency !== currency) return 0;
    return Math.min(amountMinor, Number(coupon.value));
  }
  if (coupon.type === "free_months") return amountMinor;
  return 0;
}

export async function listCoupons(): Promise<BillingCoupon[]> {
  const { data, error } = await supabase
    .from("billing_coupons")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}