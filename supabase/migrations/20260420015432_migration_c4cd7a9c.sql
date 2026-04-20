CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('celebration','announcement','ad','milestone','info','warning')),
  title text NOT NULL,
  body text,
  cta_label text,
  cta_url text,
  image_url text,
  lottie_url text,
  priority int NOT NULL DEFAULT 50,
  shown_at timestamptz,
  dismissed_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unshown ON public.user_notifications (user_id, shown_at) WHERE shown_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_notifications_broadcast ON public.user_notifications (created_at DESC) WHERE user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_notifications_created ON public.user_notifications (created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_or_broadcast" ON public.user_notifications
  FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "update_own" ON public.user_notifications
  FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "insert_own" ON public.user_notifications
  FOR INSERT WITH CHECK (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;