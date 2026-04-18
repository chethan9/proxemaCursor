import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { storeId, changeId } = req.query;
  if (typeof storeId !== "string" || typeof changeId !== "string") {
    return res.status(400).json({ error: "storeId and changeId required" });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: change, error: fetchErr } = await (supabaseAdmin as any)
    .from("entity_changes")
    .select("*")
    .eq("id", changeId)
    .eq("store_id", storeId)
    .single();

  if (fetchErr || !change) {
    return res.status(404).json({ error: "Change record not found" });
  }
  if (change.status !== "failed" || !change.retry_payload) {
    return res.status(400).json({ error: "Only failed changes with retry payload can be retried" });
  }

  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers.host;
  const baseUrl = `${proto}://${host}`;

  const endpoint =
    change.entity_type === "product"
      ? `${baseUrl}/api/stores/${storeId}/products/${change.entity_id}`
      : change.entity_type === "order"
      ? `${baseUrl}/api/stores/${storeId}/orders/${change.entity_id}`
      : null;

  if (!endpoint) {
    return res.status(400).json({ error: `Retry not supported for ${change.entity_type}` });
  }

  try {
    const upstream = await fetch(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(change.retry_payload),
    });
    const body = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json(body);
    }
    // Mark original change as retried (keep history, update status)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from("entity_changes")
      .update({ status: "retried" })
      .eq("id", changeId);

    return res.status(200).json({ success: true, result: body });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: "Retry failed", message });
  }
}