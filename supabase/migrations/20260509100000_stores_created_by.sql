-- Who created the store (used to scope site-preferences onboarding wizard to creator).
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.stores.created_by IS 'Auth user who created this store; site preferences wizard shows only to this user (unless legacy null — see app logic).';
