import type { NextApiRequest } from "next";
import { supabaseAdmin as supabase } from "@/integrations/supabase/admin";
import crypto from "crypto";

export { generateApiToken } from "./api-token";

export interface ApiAuthResult {
  valid: boolean;
  clientId?: string;
  tokenId?: string;
  error?: string;
  quotaExceeded?: boolean;
  currentUsage?: number;
  limit?: number;
}

async function checkApiQuota(clientId: string): Promise<{ ok: boolean; limit: number; current: number }> {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_id, api_calls_this_period")
    .eq("client_id", clientId)
    .in("status", ["trialing", "active", "past_due"])
    .maybeSingle();

  const s = sub as { plan_id?: string; api_calls_this_period?: number } | null;
  if (!s?.plan_id) return { ok: true, limit: 0, current: 0 };

  const { data: plan } = await supabase.from("plans").select("max_api_calls_per_month").eq("id", s.plan_id).maybeSingle();
  const limit = (plan as { max_api_calls_per_month?: number } | null)?.max_api_calls_per_month || 0;
  const current = s.api_calls_this_period || 0;

  return { ok: limit === 0 || current < limit, limit, current };
}

export async function authenticateRequest(req: NextApiRequest): Promise<ApiAuthResult> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return { valid: false, error: "Missing or invalid Authorization header" };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token.startsWith("wsk_")) {
    return { valid: false, error: "Invalid token format" };
  }

  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const { data: apiToken, error } = await supabase
    .from("api_tokens")
    .select("id, client_id, revoked_at, expires_at")
    .eq("token_hash", hash)
    .maybeSingle();

  if (error || !apiToken) return { valid: false, error: "Invalid token" };
  if (apiToken.revoked_at) return { valid: false, error: "Token revoked" };
  if (apiToken.expires_at && new Date(apiToken.expires_at) < new Date()) {
    return { valid: false, error: "Token expired" };
  }

  const quota = await checkApiQuota(apiToken.client_id);
  if (!quota.ok) {
    return {
      valid: false,
      error: `Monthly API quota exceeded (${quota.current}/${quota.limit}). Upgrade your plan at /pricing.`,
      quotaExceeded: true,
      currentUsage: quota.current,
      limit: quota.limit,
    };
  }

  // Fire and forget counter + last_used_at
  void supabase.rpc("increment_api_call_count", { p_client_id: apiToken.client_id });
  await supabase.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", apiToken.id);

  return { valid: true, clientId: apiToken.client_id, tokenId: apiToken.id };
}

export async function logApiRequest(
  tokenId: string | undefined,
  clientId: string | undefined,
  req: NextApiRequest,
  statusCode: number,
  responseTimeMs: number
): Promise<void> {
  try {
    await supabase.from("api_request_logs").insert({
      token_id: tokenId || null,
      client_id: clientId || null,
      endpoint: req.url || "",
      method: req.method || "GET",
      status_code: statusCode,
      response_time_ms: responseTimeMs,
      ip_address: (req.headers["x-forwarded-for"] as string)?.split(",")[0] || null,
      user_agent: req.headers["user-agent"] || null,
    });
  } catch {
    // Ignore logging errors
  }
}