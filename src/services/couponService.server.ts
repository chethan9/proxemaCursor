import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { Tables } from "@/integrations/supabase/helpers";
import { computeDiscount } from "./couponService";

export type BillingCoupon = Tables<"billing_coupons">;

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  coupon?: BillingCoupon;
  discountMinor?: number;
}

export async function validateCoupon(
  code: string,
  planId: string,
  clientId: string,
  amountMinor: number,
  currency: string
): Promise<ValidationResult> {
  const { data: coupon } = await supabaseAdmin
    .from("billing_coupons")
    .select("*")
    .ilike("code", code.trim())
    .maybeSingle();
  if (!coupon) return { valid: false, reason: "Code not found" };
  if (!coupon.is_active) return { valid: false, reason: "Coupon inactive" };
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date())
    return { valid: false, reason: "Coupon expired" };
  if (coupon.max_redemptions != null && coupon.redemptions_count >= coupon.max_redemptions)
    return { valid: false, reason: "Coupon exhausted" };
  if (coupon.plan_ids && coupon.plan_ids.length > 0 && !coupon.plan_ids.includes(planId))
    return { valid: false, reason: "Not valid for this plan" };

  const { data: prior } = await supabaseAdmin
    .from("coupon_redemptions")
    .select("id")
    .eq("coupon_id", coupon.id)
    .eq("client_id", clientId)
    .maybeSingle();
  if (prior) return { valid: false, reason: "Already redeemed" };

  const discountMinor = computeDiscount(coupon, amountMinor, currency);
  return { valid: true, coupon, discountMinor };
}