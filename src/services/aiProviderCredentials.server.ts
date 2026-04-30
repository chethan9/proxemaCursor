import { supabaseAdmin } from "@/integrations/supabase/admin";

export async function getDecryptedProviderApiKey(provider: "google_gemini" | "openai_image"): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("ai_provider_credentials")
    .select("api_key_encrypted, is_active")
    .eq("provider", provider)
    .maybeSingle();

  if (error || !data?.is_active || !data.api_key_encrypted) return null;

  const { data: decrypted, error: decErr } = await supabaseAdmin.rpc("decrypt_credential", {
    encrypted_credential: data.api_key_encrypted,
    key_env_var: "PAYMENT_ENCRYPTION_KEY",
  });
  if (decErr || !decrypted) return null;
  return decrypted;
}
