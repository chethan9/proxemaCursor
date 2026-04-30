import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { isAdminRole, resolveUserFromRequest } from "@/lib/server-auth";
import { logActivity } from "@/lib/activity-log";

type Action = "approve" | "reject" | "mark_paid";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const me = await resolveUserFromRequest(req);
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  if (!isAdminRole(me.role)) return res.status(403).json({ error: "Forbidden" });

  const id = String(req.query.id || "");
  if (!id) return res.status(400).json({ error: "Missing id" });

  const action = String(req.body?.action || "") as Action;
  if (!["approve", "reject", "mark_paid"].includes(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }

  const { data: existing, error: getErr } = await supabaseAdmin
    .from("referral_payout_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (getErr) return res.status(500).json({ error: getErr.message });
  if (!existing) return res.status(404).json({ error: "Not found" });

  const adminNotes = req.body?.admin_notes ? String(req.body.admin_notes).slice(0, 2000) : null;
  const reason = req.body?.reason ? String(req.body.reason).slice(0, 1000) : null;
  const reference = req.body?.paid_reference ? String(req.body.paid_reference).slice(0, 500) : null;
  const nowIso = new Date().toISOString();

  if (action === "approve") {
    if (existing.status !== "pending") {
      return res.status(409).json({ error: `Cannot approve a ${existing.status} request` });
    }
    const { data, error } = await supabaseAdmin
      .from("referral_payout_requests")
      .update({
        status: "approved",
        reviewed_by: me.userId,
        reviewed_at: nowIso,
        admin_notes: adminNotes,
      })
      .eq("id", id)
      .eq("status", "pending")
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    await logActivity({
      action: "referral.payout.approved",
      entityType: "referral_payout_request",
      entityId: id,
      clientId: existing.referrer_client_id,
      metadata: { admin_notes: adminNotes, amount_minor: existing.amount_minor, currency: existing.currency },
      actorType: "admin",
      req,
    });
    return res.status(200).json({ payout: data });
  }

  if (action === "reject") {
    if (!["pending", "approved"].includes(existing.status)) {
      return res.status(409).json({ error: `Cannot reject a ${existing.status} request` });
    }
    const { data, error } = await supabaseAdmin
      .from("referral_payout_requests")
      .update({
        status: "rejected",
        reviewed_by: me.userId,
        reviewed_at: nowIso,
        rejected_reason: reason,
        admin_notes: adminNotes,
      })
      .eq("id", id)
      .in("status", ["pending", "approved"])
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    await logActivity({
      action: "referral.payout.rejected",
      entityType: "referral_payout_request",
      entityId: id,
      clientId: existing.referrer_client_id,
      metadata: { reason, admin_notes: adminNotes, amount_minor: existing.amount_minor, currency: existing.currency },
      actorType: "admin",
      req,
    });
    return res.status(200).json({ payout: data });
  }

  if (action === "mark_paid") {
    if (existing.status !== "approved" && existing.status !== "pending") {
      return res.status(409).json({ error: `Cannot mark a ${existing.status} request as paid` });
    }
    if (!reference) {
      return res.status(400).json({ error: "paid_reference is required" });
    }

    const { data: updated, error: updErr } = await supabaseAdmin
      .from("referral_payout_requests")
      .update({
        status: "paid",
        paid_by: me.userId,
        paid_at: nowIso,
        paid_reference: reference,
        admin_notes: adminNotes,
        reviewed_by: existing.reviewed_by ?? me.userId,
        reviewed_at: existing.reviewed_at ?? nowIso,
      })
      .eq("id", id)
      .in("status", ["pending", "approved"])
      .select("*")
      .single();
    if (updErr) return res.status(500).json({ error: updErr.message });

    const debitRow = {
      referrer_client_id: existing.referrer_client_id,
      attribution_id: null,
      event_type: "payout_debit" as const,
      amount_minor: -Math.abs(existing.amount_minor),
      currency: existing.currency,
      status: "posted" as const,
      source: "admin_payout",
      source_ref: `payout:${id}`,
      payout_request_id: id,
      reason: "Payout marked as paid",
      metadata: {
        paid_reference: reference,
        admin_notes: adminNotes,
      },
      actor_user_id: me.userId,
    };
    const { error: debitErr } = await supabaseAdmin
      .from("referral_events")
      .insert(debitRow as never);
    if (debitErr && debitErr.code !== "23505") {
      // We've updated payout state but debit insert failed: surface so admin can retry.
      return res.status(500).json({ error: debitErr.message });
    }

    await logActivity({
      action: "referral.payout.paid",
      entityType: "referral_payout_request",
      entityId: id,
      clientId: existing.referrer_client_id,
      metadata: {
        paid_reference: reference,
        amount_minor: existing.amount_minor,
        currency: existing.currency,
        admin_notes: adminNotes,
      },
      actorType: "admin",
      req,
    });

    return res.status(200).json({ payout: updated });
  }

  return res.status(400).json({ error: "Unhandled action" });
}
