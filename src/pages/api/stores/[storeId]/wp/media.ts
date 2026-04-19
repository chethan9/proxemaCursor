import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import formidable from "formidable";
import fs from "fs";

export const config = { api: { bodyParser: false } };

async function getWpCreds(storeId: string) {
  const { data } = await supabaseAdmin
    .from("stores")
    .select("url, wp_username, wp_app_password")
    .eq("id", storeId)
    .maybeSingle();
  if (!data?.wp_username || !data?.wp_app_password) return null;
  return { url: data.url.replace(/\/$/, ""), user: data.wp_username, pass: data.wp_app_password };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { storeId: raw } = req.query;
  const storeId = Array.isArray(raw) ? raw[0] : raw;
  if (!storeId) return res.status(400).json({ error: "Missing store id" });

  const creds = await getWpCreds(storeId);
  if (!creds) return res.status(412).json({ error: "WordPress credentials not configured", code: "WP_CREDS_MISSING" });

  const authHeader = "Basic " + Buffer.from(`${creds.user}:${creds.pass}`).toString("base64");

  try {
    if (req.method === "GET") {
      const search = (req.query.search as string) || "";
      const page = (req.query.page as string) || "1";
      const per_page = (req.query.per_page as string) || "28";
      const qs = new URLSearchParams({ page, per_page, media_type: "image" });
      if (search) qs.set("search", search);
      const r = await fetch(`${creds.url}/wp-json/wp/v2/media?${qs.toString()}`, {
        headers: { Authorization: authHeader },
      });
      const total = r.headers.get("x-wp-total");
      const totalPages = r.headers.get("x-wp-totalpages");
      const data = await r.json();
      return res.status(r.status).json({ data, total: total ? Number(total) : 0, totalPages: totalPages ? Number(totalPages) : 0 });
    }

    if (req.method === "POST") {
      const form = formidable({ maxFileSize: 20 * 1024 * 1024 });
      const [, files] = await form.parse(req);
      const fileField = files.file;
      const file = Array.isArray(fileField) ? fileField[0] : fileField;
      if (!file) return res.status(400).json({ error: "No file provided" });

      const buffer = fs.readFileSync(file.filepath);
      const filename = file.originalFilename || "upload.jpg";
      const mime = file.mimetype || "image/jpeg";

      const r = await fetch(`${creds.url}/wp-json/wp/v2/media`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": mime,
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
        body: buffer,
      });
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
  }
}