import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { Json } from "@/integrations/supabase/database.types";
import { getStoreCreds, wooRequest } from "@/lib/woo-client";
import { logActivity } from "@/lib/activity-log";
import { buildFieldDiffs, capFieldDiffs } from "@/lib/audit/diff-engine";
import { authorizeCronOrStoreMember } from "@/lib/authorize-cron-or-store.server";
import { normalizeCustomerWooPatch } from "@/lib/customer-woo-patch";
import { isValidEmail } from "@/lib/email-validation";
import { WooApiError } from "@/lib/sync-error";

function toJson<T>(obj: T): Json {
  return JSON.parse(JSON.stringify(obj)) as Json;
}

interface WooCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  role: string;
  billing: Record<string, unknown>;
  shipping: Record<string, unknown>;
  avatar_url: string;
  is_paying_customer: boolean;
  date_created: string;
  date_modified: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { storeId, customerId } = req.query as { storeId: string; customerId: string };

  const { data: cust, error: custErr } = await supabaseAdmin
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .eq("store_id", storeId)
    .single();
  if (custErr || !cust) return res.status(404).json({ error: "Customer not found" });

  if (req.method === "GET") {
    return res.status(200).json(cust);
  }

  const store = await getStoreCreds(storeId);
  if (!store) return res.status(400).json({ error: "Store not connected" });

  if (req.method === "PUT") {
    const gate = await authorizeCronOrStoreMember(req, storeId);
    if (gate.ok === false) return res.status(gate.status).json({ error: gate.message });
    const patch = req.body as {
      first_name?: string;
      last_name?: string;
      email?: string;
      username?: string;
      billing?: Record<string, unknown>;
      shipping?: Record<string, unknown>;
    };
    if (!cust.woo_id) return res.status(400).json({ error: "Customer has no Woo ID" });
    if (patch.email != null && patch.email.trim() !== "" && !isValidEmail(patch.email)) {
      return res.status(400).json({ error: "Invalid email address", message: "Account email is not valid." });
    }
    const wooPatch = normalizeCustomerWooPatch(patch);
    try {
      const wooData = await wooRequest<WooCustomer>(store, "PUT", `customers/${cust.woo_id}`, wooPatch);
      const dbPatch = {
        first_name: wooData.first_name ?? patch.first_name ?? cust.first_name,
        last_name: wooData.last_name ?? patch.last_name ?? cust.last_name,
        email: wooData.email ?? patch.email ?? cust.email,
        username: wooData.username ?? patch.username ?? cust.username,
        billing: toJson(wooData.billing ?? patch.billing ?? cust.billing ?? {}),
        shipping: toJson(wooData.shipping ?? patch.shipping ?? cust.shipping ?? {}),
        raw_data: toJson(wooData),
        synced_at: new Date().toISOString(),
      };
      const { data: updated, error: upErr } = await supabaseAdmin
        .from("customers")
        .update(dbPatch)
        .eq("id", customerId)
        .select("*")
        .single();
      if (upErr) return res.status(500).json({ error: upErr.message });
      void logActivity({
        action: "customer.update",
        entityType: "customer",
        entityId: customerId,
        before: cust as Record<string, unknown>,
        after: updated as Record<string, unknown>,
        fieldDiffs: capFieldDiffs(
          buildFieldDiffs(cust as Record<string, unknown>, updated as Record<string, unknown>)
        ),
        metadata: { module: "sites", woo_id: cust.woo_id, store_id: storeId },
        req,
      });
      return res.status(200).json(updated);
    } catch (e) {
      if (e instanceof WooApiError && e.context.status === 400) {
        return res.status(400).json({ error: "WooCommerce rejected the update", message: e.message });
      }
      const err = e as { message?: string };
      return res.status(502).json({ error: "Woo update failed", message: err.message });
    }
  }

  if (req.method === "DELETE") {
    if (!cust.woo_id) {
      await supabaseAdmin.from("customers").delete().eq("id", customerId);
      void logActivity({
        action: "customer.delete",
        entityType: "customer",
        entityId: customerId,
        before: cust as Record<string, unknown>,
        metadata: { module: "sites", store_id: storeId },
        req,
      });
      return res.status(200).json({ ok: true });
    }
    try {
      await wooRequest(store, "DELETE", `customers/${cust.woo_id}?force=true`);
      await supabaseAdmin.from("customers").delete().eq("id", customerId);
      void logActivity({
        action: "customer.delete",
        entityType: "customer",
        entityId: customerId,
        before: cust as Record<string, unknown>,
        metadata: { module: "sites", woo_id: cust.woo_id, store_id: storeId },
        req,
      });
      return res.status(200).json({ ok: true });
    } catch (e) {
      const err = e as { message?: string };
      return res.status(502).json({ error: "Woo delete failed", message: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}