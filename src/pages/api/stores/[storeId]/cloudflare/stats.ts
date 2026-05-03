import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { assertStoreAccess } from "@/lib/assert-store-access";
import { getResolvedCloudflareConfig } from "@/lib/cloudflare-images-config.server";
import { normalizeProductImageSrc, productImageStorageKey } from "@/lib/product-image-urls";

/** PostgREST default max rows per request is 1000 — must page or coverage stats are wrong for large stores. */
const PAGE_SIZE = 1000;

async function fetchAllStoreProducts(storeId: string): Promise<{ id: string; images: unknown }[]> {
  const out: { id: string; images: unknown }[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("id, images")
      .eq("store_id", storeId)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const chunk = data || [];
    out.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}

async function fetchAllStoreMirrors(
  storeId: string,
): Promise<Array<{ product_id: string; storage_key: string; status: string; updated_at: string | null }>> {
  const out: Array<{ product_id: string; storage_key: string; status: string; updated_at: string | null }> = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from("product_image_mirrors")
      .select("product_id, storage_key, status, updated_at")
      .eq("store_id", storeId)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const chunk = data || [];
    out.push(...(chunk as typeof out));
    if (chunk.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}

export type StoreCloudflareStats = {
  /** Total gallery entries (including non-HTTP). */
  gallerySlots: number;
  /** HTTPS gallery URLs (same basis as the mirror backfill). */
  httpsImageSlots: number;
  /** Of `httpsImageSlots`, how many have a `ready` mirror row for that image key. */
  slotsWithReadyMirror: number;
  mirrorRows: { pending: number; ready: number; failed: number; deleting: number };
  lastMirrorActivityAt: string | null;
  configResolved: boolean;
  publicFlagOn: boolean;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const storeId = typeof req.query.storeId === "string" ? req.query.storeId : "";
  if (!storeId) return res.status(400).json({ error: "storeId required" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not authenticated" });
  const token = authHeader.slice(7);
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userRes.user) return res.status(401).json({ error: "Invalid token" });

  const gate = await assertStoreAccess(userRes.user.id, storeId);
  if (gate.allowed === false) return res.status(gate.status).json({ error: gate.message });

  const cfg = await getResolvedCloudflareConfig().catch(() => null);

  const products = await fetchAllStoreProducts(storeId);
  let gallerySlots = 0;
  let httpsImageSlots = 0;
  for (const p of products) {
    if (Array.isArray(p.images)) gallerySlots += p.images.length;
  }

  const mirrors = await fetchAllStoreMirrors(storeId);

  const readyKeysByProduct = new Map<string, Set<string>>();
  for (const m of mirrors) {
    if (m.status !== "ready") continue;
    const set = readyKeysByProduct.get(m.product_id as string) ?? new Set();
    set.add(m.storage_key as string);
    readyKeysByProduct.set(m.product_id as string, set);
  }

  let slotsWithReadyMirror = 0;
  for (const p of products) {
    const imgs = p.images as { src?: string }[] | null;
    if (!Array.isArray(imgs)) continue;
    const readySet = readyKeysByProduct.get(p.id as string) ?? new Set();
    for (const im of imgs) {
      const src = im?.src;
      if (!src || !/^https?:\/\//i.test(src)) continue;
      httpsImageSlots++;
      const key = productImageStorageKey(normalizeProductImageSrc(src));
      if (readySet.has(key)) slotsWithReadyMirror++;
    }
  }

  const mirrorRows = { pending: 0, ready: 0, failed: 0, deleting: 0 };
  let lastMirrorActivityAt: string | null = null;
  for (const m of mirrors) {
    const s = (m.status as string) || "";
    if (s === "pending") mirrorRows.pending++;
    else if (s === "ready") mirrorRows.ready++;
    else if (s === "failed") mirrorRows.failed++;
    else if (s === "deleting") mirrorRows.deleting++;
    const u = m.updated_at as string | undefined;
    if (u && (!lastMirrorActivityAt || u > lastMirrorActivityAt)) lastMirrorActivityAt = u;
  }

  const body: StoreCloudflareStats = {
    gallerySlots,
    httpsImageSlots,
    slotsWithReadyMirror,
    mirrorRows,
    lastMirrorActivityAt,
    configResolved: cfg != null,
    publicFlagOn: process.env.NEXT_PUBLIC_CLOUDFLARE_PRODUCT_IMAGES === "true",
  };

  return res.status(200).json(body);
}
