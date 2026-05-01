-- Legacy encrypt_credential/decrypt_credential read the key via Postgres current_setting(),
-- which is not set from Vercel/host env — encryption failed at runtime.
-- These variants accept the secret from the application (same value as PAYMENT_ENCRYPTION_KEY).

CREATE OR REPLACE FUNCTION encrypt_credential_with_secret(credential text, encryption_secret text)
RETURNS text AS $$
BEGIN
  IF credential IS NULL THEN
    RETURN NULL;
  END IF;
  IF encryption_secret IS NULL OR length(trim(encryption_secret)) = 0 THEN
    RAISE EXCEPTION 'encryption_secret is required';
  END IF;
  RETURN encode(pgp_sym_encrypt(credential, encryption_secret), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_credential_with_secret(encrypted_credential text, encryption_secret text)
RETURNS text AS $$
BEGIN
  IF encrypted_credential IS NULL OR encrypted_credential = '' THEN
    RETURN NULL;
  END IF;
  IF encryption_secret IS NULL OR length(trim(encryption_secret)) = 0 THEN
    RAISE EXCEPTION 'encryption_secret is required';
  END IF;
  RETURN pgp_sym_decrypt(decode(encrypted_credential, 'base64'), encryption_secret);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.encrypt_credential_with_secret(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_credential_with_secret(text, text) TO service_role;
