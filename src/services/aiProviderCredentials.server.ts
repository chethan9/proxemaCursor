import { supabaseAdmin } from "@/integrations/supabase/admin";
import { decryptCredentialWithPaymentKey } from "@/lib/credential-crypto.server";

export async function getDecryptedProviderApiKey(provider: "google_gemini" | "openai_image"): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("ai_provider_credentials")
    .select("api_key_encrypted, is_active")
    .eq("provider", provider)
    .maybeSingle();

  if (error || !data?.is_active || !data.api_key_encrypted) return null;

  const decrypted = await decryptCredentialWithPaymentKey(data.api_key_encrypted);
  if (!decrypted) return null;
  return decrypted;
}
