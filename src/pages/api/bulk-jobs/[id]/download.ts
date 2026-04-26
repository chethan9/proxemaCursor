import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: "Missing job id" });

  // Verify caller via Supabase session token
  const authHeader = req.headers.authorization;
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = bearer || (req.cookies?.["sb-access-token"] as string | undefined) || null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: "Unauthorized" });

  const { data: job, error: jobErr } = await supabaseAdmin
    .from("bulk_jobs")
    .select("id, store_id, job_type, status, payload, user_id")
    .eq("id", id)
    .maybeSingle();
  if (jobErr || !job) return res.status(404).json({ error: "Job not found" });
  if (job.job_type !== "print_invoices_bulk") return res.status(400).json({ error: "Not a print job" });
  if (job.status !== "completed") return res.status(400).json({ error: "Job not completed" });

  // Authorization: user must own the job OR have access to its store
  if (job.user_id && job.user_id !== userData.user.id) {
    const { data: storeAccess } = await supabaseAdmin
      .from("stores")
      .select("client_id, clients!inner(user_id)")
      .eq("id", job.store_id)
      .maybeSingle();
    const ownerId = (storeAccess as { clients?: { user_id?: string } } | null)?.clients?.user_id;
    if (ownerId !== userData.user.id) return res.status(403).json({ error: "Forbidden" });
  }

  const payload = job.payload as { artifact_path?: string; output_mode?: string; artifact_deleted?: boolean } | null;
  if (payload?.artifact_deleted === true) {
    return res.status(410).json({ error: "Invoice archive expired (auto-deleted after 7 days)" });
  }
  const path = payload?.artifact_path;
  if (!path) return res.status(404).json({ error: "Artifact missing or expired" });

  const { data: signed, error: signErr } = await supabaseAdmin.storage
    .from("bulk-invoices")
    .createSignedUrl(path, 60 * 10, { download: true });
  if (signErr || !signed?.signedUrl) {
    console.error("[bulk-invoices download]", signErr);
    return res.status(500).json({ error: "Could not sign download URL" });
  }

  res.redirect(307, signed.signedUrl);
}