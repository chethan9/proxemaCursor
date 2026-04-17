import { supabase } from "@/integrations/supabase/client";

export interface ApiKey {
  id: string;
  client_id: string | null;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit: number;
  allowed_origins: string[] | null;
  is_active: boolean;
  created_at: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  clients?: { name: string } | null;
}

export interface ApiCallLog {
  id: string;
  api_key_id: string | null;
  method: string | null;
  path: string | null;
  status_code: number | null;
  response_time_ms: number | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string | null;
}

function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "wsk_";
  for (let i = 0; i < 48; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function createApiKey(params: {
  clientId: string;
  name: string;
  scopes?: string[];
  rateLimit?: number;
  allowedOrigins?: string[];
  expiresAt?: string | null;
}): Promise<{ key: ApiKey; plainTextKey: string } | null> {
  const plainTextKey = generateApiKey();
  const keyHash = await hashKey(plainTextKey);
  const keyPrefix = plainTextKey.substring(0, 12);

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      client_id: params.clientId,
      name: params.name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes: params.scopes || ["read"],
      rate_limit: params.rateLimit || 1000,
      allowed_origins: params.allowedOrigins || null,
      expires_at: params.expiresAt || null,
    })
    .select()
    .single();

  if (error || !data) return null;
  return { key: data as ApiKey, plainTextKey };
}

export async function getApiKeys(clientId?: string): Promise<ApiKey[]> {
  let query = supabase
    .from("api_keys")
    .select("*, clients(name)")
    .order("created_at", { ascending: false });

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data } = await query;
  return (data || []) as ApiKey[];
}

export async function revokeApiKey(keyId: string): Promise<boolean> {
  const { error } = await supabase
    .from("api_keys")
    .update({ is_active: false })
    .eq("id", keyId);
  return !error;
}

export async function deleteApiKey(keyId: string): Promise<boolean> {
  const { error } = await supabase
    .from("api_keys")
    .delete()
    .eq("id", keyId);
  return !error;
}

export async function getApiCallLogs(params?: {
  apiKeyId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: ApiCallLog[]; total: number }> {
  const limit = params?.limit || 50;
  const offset = params?.offset || 0;

  let query = supabase
    .from("api_call_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params?.apiKeyId) {
    query = query.eq("api_key_id", params.apiKeyId);
  }

  const { data, count } = await query;
  return { logs: (data || []) as ApiCallLog[], total: count || 0 };
}

export async function getApiKeyStats(keyId: string): Promise<{
  totalCalls: number;
  last24h: number;
  avgResponseTime: number;
  errorRate: number;
}> {
  const { count: totalCalls } = await supabase
    .from("api_call_logs")
    .select("*", { count: "exact", head: true })
    .eq("api_key_id", keyId);

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentLogs, count: last24h } = await supabase
    .from("api_call_logs")
    .select("response_time_ms, status_code", { count: "exact" })
    .eq("api_key_id", keyId)
    .gte("created_at", dayAgo);

  const logs = recentLogs || [];
  const avgResponseTime = logs.length
    ? logs.reduce((s, l) => s + (l.response_time_ms || 0), 0) / logs.length
    : 0;
  const errors = logs.filter(l => (l.status_code || 0) >= 400).length;
  const errorRate = logs.length ? (errors / logs.length) * 100 : 0;

  return {
    totalCalls: totalCalls || 0,
    last24h: last24h || 0,
    avgResponseTime: Math.round(avgResponseTime),
    errorRate: Math.round(errorRate * 10) / 10,
  };
}