/**
 * Credential encryption via Supabase pgcrypto, using PAYMENT_ENCRYPTION_KEY from the server environment.
 * Postgres session settings are not populated from Vercel env; callers must pass the key explicitly (RPC below).
 */

import { supabaseAdmin } from "@/integrations/supabase/admin";

export function requirePaymentEncryptionKey(): string {
  const k = process.env.PAYMENT_ENCRYPTION_KEY?.trim();
  if (!k) throw new Error("PAYMENT_ENCRYPTION_KEY is not configured on the server");
  return k;
}

export async function encryptCredentialWithPaymentKey(credential: string) {
  const encryption_secret = requirePaymentEncryptionKey();
  return supabaseAdmin.rpc("encrypt_credential_with_secret", {
    credential,
    encryption_secret,
  });
}

/** Decrypt ciphertext produced by encryptCredentialWithPaymentKey / legacy encrypt when keys match. */
export async function decryptCredentialWithPaymentKey(encrypted: string | null | undefined): Promise<string | null> {
  if (encrypted == null || String(encrypted).trim() === "") return null;
  const encryption_secret = process.env.PAYMENT_ENCRYPTION_KEY?.trim();
  if (!encryption_secret) {
    console.warn("[credential-crypto] PAYMENT_ENCRYPTION_KEY missing; cannot decrypt");
    return null;
  }
  const enc = String(encrypted);
  const { data, error } = await supabaseAdmin.rpc("decrypt_credential_with_secret", {
    encrypted_credential: enc,
    encryption_secret,
  });
  if (!error && data != null && typeof data === "string") return data;

  const { data: legacy, error: legacyErr } = await supabaseAdmin.rpc("decrypt_credential", {
    encrypted_credential: enc,
    key_env_var: "PAYMENT_ENCRYPTION_KEY",
  });
  if (!legacyErr && legacy != null && typeof legacy === "string") return legacy;

  return null;
}
