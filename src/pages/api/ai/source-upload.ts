import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { assertStoreAccess } from "@/lib/assert-store-access";

export const config = { api: { bodyParser: false } };

function getBearer(req: NextApiRequest): string | null {
  const authHeader = req.headers.authorization;
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  return bearer || (req.cookies?.["sb-access-token"] as string | undefined) || null;
}

/** Upload a reference image for AI generation; returns a short-lived signed URL the generate API can fetch. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = getBearer(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) return res.status(401).json({ error: "Unauthorized" });

  const { data: profile } = await supabaseAdmin.from("profiles").select("client_id").eq("id", userData.user.id).maybeSingle();
  const clientId = profile?.client_id as string | undefined;
  if (!clientId) return res.status(403).json({ error: "No client workspace" });

  const form = formidable({ maxFileSize: 12 * 1024 * 1024 });
  let fields: formidable.Fields;
  let files: formidable.Files;
  try {
    [fields, files] = await form.parse(req);
  } catch {
    return res.status(400).json({ error: "Invalid upload" });
  }

  const storeField = fields.storeId;
  const storeId = (Array.isArray(storeField) ? storeField[0] : storeField) as string | undefined;
  if (!storeId?.trim()) return res.status(400).json({ error: "storeId required" });

  const gate = await assertStoreAccess(userData.user.id, storeId.trim());
  if (gate.allowed === false) return res.status(gate.status).json({ error: gate.message });

  const fileField = files.file;
  const file = Array.isArray(fileField) ? fileField[0] : fileField;
  if (!file) return res.status(400).json({ error: "Missing file" });

  try {
    const buf = fs.readFileSync(file.filepath);
    const mime = file.mimetype || "image/jpeg";
    const ext =
      mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : mime.includes("gif") ? "gif" : mime.includes("svg") ? "svg" : "jpg";
    const path = `source-inputs/${clientId}/${randomUUID()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage.from("ai-staging").upload(path, buf, {
      contentType: mime,
      upsert: false,
    });
    fs.unlinkSync(file.filepath);
    if (upErr) return res.status(500).json({ error: upErr.message });

    const { data: signedData } = await supabaseAdmin.storage.from("ai-staging").createSignedUrl(path, 3600);
    if (!signedData?.signedUrl) return res.status(500).json({ error: "Could not sign URL" });
    return res.status(200).json({ url: signedData.signedUrl, path });
  } catch (e) {
    try {
      fs.unlinkSync(file.filepath);
    } catch {
      /* ignore */
    }
    const msg = e instanceof Error ? e.message : "Upload failed";
    return res.status(500).json({ error: msg });
  }
}
