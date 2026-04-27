-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Payment gateway configurations with encrypted credentials
CREATE TABLE IF NOT EXISTS payment_gateway_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway text NOT NULL CHECK (gateway IN ('myfatoorah', 'razorpay', 'tap')),
  mode text NOT NULL DEFAULT 'test' CHECK (mode IN ('test', 'live')),
  api_key_encrypted text,
  api_secret_encrypted text,
  webhook_secret_encrypted text,
  additional_config jsonb DEFAULT '{}'::jsonb,
  enabled boolean DEFAULT false,
  last_test_at timestamptz,
  last_test_status text,
  last_test_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (gateway, mode)
);

-- Region routing table (country -> gateway priority)
CREATE TABLE IF NOT EXISTS payment_region_routing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  gateway text NOT NULL CHECK (gateway IN ('myfatoorah', 'razorpay', 'tap')),
  priority integer DEFAULT 1,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (country_code, gateway)
);

-- Helper functions for encryption/decryption
CREATE OR REPLACE FUNCTION encrypt_credential(credential text, key_env_var text DEFAULT 'PAYMENT_ENCRYPTION_KEY')
RETURNS text AS $$
BEGIN
  RETURN encode(pgp_sym_encrypt(credential, current_setting(key_env_var, true)), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_credential(encrypted_credential text, key_env_var text DEFAULT 'PAYMENT_ENCRYPTION_KEY')
RETURNS text AS $$
BEGIN
  IF encrypted_credential IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_decrypt(decode(encrypted_credential, 'base64'), current_setting(key_env_var, true));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS policies - admin only
ALTER TABLE payment_gateway_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_region_routing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_gateway_config" ON payment_gateway_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "admin_all_region_routing" ON payment_region_routing
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Default region routing (MENA -> MyFatoorah, rest -> Razorpay)
INSERT INTO payment_region_routing (country_code, gateway, priority) VALUES
  ('KW', 'myfatoorah', 1),
  ('SA', 'myfatoorah', 1),
  ('AE', 'myfatoorah', 1),
  ('BH', 'myfatoorah', 1),
  ('OM', 'myfatoorah', 1),
  ('QA', 'myfatoorah', 1),
  ('JO', 'myfatoorah', 1),
  ('EG', 'myfatoorah', 1),
  ('*', 'razorpay', 1)
ON CONFLICT (country_code, gateway) DO NOTHING;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_payment_gateway_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_gateway_config_updated_at
  BEFORE UPDATE ON payment_gateway_config
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_gateway_config_updated_at();