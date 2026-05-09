import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { assertStoreAccess } from "@/lib/assert-store-access";
import { normalizeProductImageSrc, productImageStorageKey } from "@/lib/product-image-urls";
import { hostAllowedForStore, resolveImageUrl } from "@/lib/store-image-url";

function getBearer(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization;
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  return bearer || (req.cookies?.["sb-access-token"] as string | undefined) || null;
}

function pickMirrorUrl(entry: unknown, fallback: string): string {
  if (!entry || typeof entry !== "object") return fallback;
  const o = entry as Record<string, unknown>;
  const thumb = typeof o.thumb === "string" ? o.thumb.trim() : "";
  const card = typeof o.card === "string" ? o.card.trim() : "";
  return thumb || card || fallback;
}

/**
 * JSON: { url } — prefers Cloudflare Images `thumb`, then `card`, else the canonical source URL.
 * Used by the assistant UI (fetch + Bearer); returned URLs are typically public CDNs.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = getBearer(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: "Unauthorized" });

  const { storeId: rawSid } = req.query;
  const storeId = Array.isArray(rawSid) ? rawSid[0] : rawSid;
  if (!storeId || typeof storeId !== "string") return res.status(400).json({ error: "Missing store id" });

  const gate = await assertStoreAccess(userData.user.id, storeId);
  if (gate.allowed === false) return res.status(gate.status).json({ error: gate.message });

  const rawUrlParam = typeof req.query.url === "string" ? req.query.url.trim() : "";
  if (!rawUrlParam) return res.status(400).json({ error: "Missing url" });

  const { data: storeRow } = await supabaseAdmin.from("stores").select("url").eq("id", storeId).maybeSingle();
  const storeUrl = storeRow?.url as string | undefined;

  const resolvedHref = resolveImageUrl(rawUrlParam, storeUrl);
  if (!resolvedHref) {
    return res.status(400).json({ error: "Invalid or unresolved url" });
  }

  let target: URL;
  try {
    target = new URL(resolvedHref);
  } catch {
    return res.status(400).json({ error: "Invalid url" });
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return res.status(400).json({ error: "Only http(s) URLs allowed" });
  }

  if (!hostAllowedForStore(target.hostname, storeUrl)) {
    return res.status(403).json({ error: "URL host not allowed for this store" });
  }

  const normalized = normalizeProductImageSrc(resolvedHref);
  const key = productImageStorageKey(normalized);

  const { data: entry, error: rpcErr } = await supabaseAdmin.rpc("assistant_resolve_mirror_entry", {
    p_store_id: storeId,
    p_key: key,
  });

  if (rpcErr) {
    console.error("[resolved-product-thumb]", rpcErr);
    return res.status(200).json({ url: resolvedHref });
  }

  const url = pickMirrorUrl(entry, resolvedHref);
  return res.status(200).json({ url });
}
