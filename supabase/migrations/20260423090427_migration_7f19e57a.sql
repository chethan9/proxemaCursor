ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS api_calls_this_period integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION increment_api_call_count(p_client_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE subscriptions
  SET api_calls_this_period = api_calls_this_period + 1
  WHERE client_id = p_client_id
    AND status IN ('trialing', 'active', 'past_due');
END;
$$;

GRANT EXECUTE ON FUNCTION increment_api_call_count(uuid) TO authenticated, service_role;