import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const config = {
  api: { bodyParser: false, responseLimit: false },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { storeId } = req.query;
  if (typeof storeId !== "string") return res.status(400).json({ error: "Invalid storeId" });

  const forceRefresh = req.query.refresh === "1";

  const { data: store, error } = await supabaseAdmin
    .from("stores")
    .select("id, url, screenshot_url, screenshot_captured_at")
    .eq("id", storeId)
    .maybeSingle();

  if (error || !store) return res.status(404).json({ error: "Store not found" });
  if (!store.url) return res.status(400).json({ error: "Store has no URL" });

  const capturedAt = store.screenshot_captured_at ? new Date(store.screenshot_captured_at).getTime() : 0;
  const ageMs = Date.now() - capturedAt;
  const fresh = !forceRefresh && store.screenshot_url && capturedAt > 0 && ageMs < SEVEN_DAYS_MS;

  if (fresh) {
    return res.status(200).json({ url: store.screenshot_url, cached: true, ageMs });
  }

  try {
    const origin = new URL(store.url).origin;
    const apiKey = process.env.THUM_API_KEY || process.env.NEXT_PUBLIC_THUM_API_KEY;
    const thumUrl = apiKey
      ? `https://image.thum.io/get/auth/${apiKey}/width/800/png/${origin}`
      : `https://image.thum.io/get/width/800/png/${origin}`;

    const thumCtrl = new AbortController();
    const thumTimeout = setTimeout(() => thumCtrl.abort(), 45_000);
    let buffer: Buffer;
    try {
      const imgRes = await fetch(thumUrl, { signal: thumCtrl.signal });
      if (!imgRes.ok) throw new Error(`thum.io returned ${imgRes.status}`);
      buffer = Buffer.from(await imgRes.arrayBuffer());
    } finally {
      clearTimeout(thumTimeout);
    }

    const path = `${storeId}.png`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("site-screenshots")
      .upload(path, buffer, { contentType: "image/png", upsert: true, cacheControl: "604800" });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

    const { data: pub } = supabaseAdmin.storage.from("site-screenshots").getPublicUrl(path);
    const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

    await supabaseAdmin
      .from("stores")
      .update({ screenshot_url: publicUrl, screenshot_captured_at: new Date().toISOString() })
      .eq("id", storeId);

    return res.status(200).json({ url: publicUrl, cached: false });
  } catch (e) {
    console.error("[screenshot]", storeId, e);
    if (store.screenshot_url) {
      return res.status(200).json({ url: store.screenshot_url, cached: true, stale: true });
    }
    return res.status(500).json({ error: e instanceof Error ? e.message : "Capture failed" });
  }
}