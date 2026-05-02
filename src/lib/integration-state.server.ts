import crypto from "crypto";

export type IntegrationKind = "wp";

export type SignedIntegrationPayload = {
  v: 1;
  kind: IntegrationKind;
  userId: string;
  storeId: string;
  returnTo: string | null;
  exp: number;
};

function getSigningKey(): string {
  const explicit = process.env.INTEGRATION_STATE_SECRET?.trim();
  if (explicit) return explicit;
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (sr) return crypto.createHash("sha256").update(sr, "utf8").digest("hex").slice(0, 48);
  throw new Error("INTEGRATION_STATE_SECRET or SUPABASE_SERVICE_ROLE_KEY required for integration state signing");
}

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Signed token: base64url(payload).base64url(hmac) */
export function signIntegrationPayload(payload: Omit<SignedIntegrationPayload, "v">): string {
  const full: SignedIntegrationPayload = { v: 1, ...payload };
  const body = Buffer.from(JSON.stringify(full), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", getSigningKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyIntegrationToken(token: string): SignedIntegrationPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  try {
    const expected = crypto.createHmac("sha256", getSigningKey()).update(body).digest("base64url");
    if (!timingSafeEqual(sig, expected)) return null;
    const json = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SignedIntegrationPayload;
    if (json.v !== 1 || typeof json.exp !== "number") return null;
    if (Date.now() > json.exp) return null;
    if (json.kind !== "wp") return null;
    if (!json.userId || !json.storeId) return null;
    return json;
  } catch {
    return null;
  }
}

/** Default TTL for WP authorize-application redirect (ms). */
export const WP_STATE_TTL_MS = 20 * 60 * 1000;
