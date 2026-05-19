import type { NextApiRequest } from "next";
import { z, type ZodTypeAny } from "zod";

/** Default max JSON body size for APIs using the JSON body parser (align with Next `sizeLimit` where set). */
export const MAX_JSON_BODY_BYTES = 1_048_576;

/** Max raw bytes read from streams (webhooks, unparsed bodies). */
export const MAX_WEBHOOK_RAW_BYTES = 524_288;

export { API_RATE_LIMIT_EXCLUDED_PREFIXES } from "@/lib/api-rate-limit-config";

export function assertContentLength(req: NextApiRequest, maxBytes: number): boolean {
  const raw = req.headers["content-length"];
  if (raw === undefined) return true;
  const n = typeof raw === "string" ? parseInt(raw, 10) : parseInt(raw[0]!, 10);
  if (!Number.isFinite(n)) return false;
  return n <= maxBytes;
}

/**
 * Parse `req.body` after validating with Zod. Use on routes with default JSON body parser enabled.
 */
export function parseBodyJson<T extends ZodTypeAny>(
  req: NextApiRequest,
  schema: T,
): { ok: true; data: z.infer<T> } | { ok: false; status: number; message: string } {
  const raw = req.body;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors.join("; ") || "Invalid body";
    return { ok: false, status: 400, message: msg };
  }
  return { ok: true, data: parsed.data };
}
