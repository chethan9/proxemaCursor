import type { NextApiRequest } from "next";
import { supabaseAdmin as supabase } from "@/integrations/supabase/admin";
import crypto from "crypto";

export interface ApiAuthResult {
  valid: boolean;
  clientId?: string;
  tokenId?: string;
  error?: string;
}

export function generateApiToken(): { plain: string; hash: string; prefix: string } {
  const plain = `wsk_${crypto.randomBytes(32).toString("hex")}`;
  const hash = crypto.createHash("sha256").update(plain).digest("hex");
  const prefix = plain.substring(0, 12);
  return { plain, hash, prefix };
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

  // Update last_used_at
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