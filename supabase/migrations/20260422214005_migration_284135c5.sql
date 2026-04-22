ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS country char(2);
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS currency char(3) NOT NULL DEFAULT 'USD';
COMMENT ON COLUMN public.clients.country IS 'ISO 3166-1 alpha-2; drives payment gateway selection (MyFatoorah for ME, Razorpay rest)';
COMMENT ON COLUMN public.clients.currency IS 'ISO 4217; default from country at creation, overridable via profile';