-- Depends on billing_coupons table created earlier in this batch.

CREATE OR REPLACE FUNCTION public.increment_coupon_redemption_count(coupon_id_in uuid)
 RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  UPDATE public.billing_coupons SET redemptions_count = redemptions_count + 1 WHERE id = coupon_id_in;
$function$;