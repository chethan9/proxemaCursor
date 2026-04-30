-- Tap routes subscriptions via payment_region_routing and subscriptions.gateway; enum must include tap.
ALTER TYPE public.billing_gateway ADD VALUE IF NOT EXISTS 'tap';
