import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { assertStoreAccess } from "@/lib/assert-store-access";
import { uploadImageBufferToWp } from "@/lib/wp-upload-media.server";

type Placement = { outputIndex: number; applyAs: "main" | "gallery_append" | "gallery_replace"; galleryIndex?: number };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not authenticated" });
  const token = authHeader.slice(7);
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userRes.user) return res.status(401).json({ error: "Invalid token" });

  const generationId = typeof req.query.generationId === "string" ? req.query.generationId : "";
  if (!generationId) return res.status(400).json({ error: "Missing generation id" });

  const body = req.body as { storeId?: string; placements?: Placement[] };
  const storeId = typeof body.storeId === "string" ? body.storeId : "";
  const placements = Array.isArray(body.placements) ? body.placements : [];
  if (!storeId || placements.length === 0) return res.status(400).json({ error: "storeId and placements required" });

  const gate = await assertStoreAccess(userRes.user.id, storeId);
  if (gate.allowed === false) return res.status(gate.status).json({ error: gate.message });

  const { data: profile } = await supabaseAdmin.from("profiles").select("client_id").eq("id", userRes.user.id).maybeSingle();
  const clientId = profile?.client_id;
  if (!clientId) return res.status(403).json({ error: "No client" });

  const { data: gen, error } = await supabaseAdmin
    .from("ai_generations")
    .select("id, client_id, store_id, output_storage_paths, status")
    .eq("id", generationId)
    .maybeSingle();
  if (error || !gen) return res.status(404).json({ error: "Generation not found" });
  if (gen.client_id !== clientId || gen.store_id !== storeId) return res.status(403).json({ error: "Forbidden" });

  const paths = (gen.output_storage_paths || []) as string[];
  const results: Array<{
    outputIndex: number;
    applyAs: Placement["applyAs"];
    galleryIndex?: number;
    media: { id: number; source_url: string; thumbnail_url: string; alt: string };
  }> = [];

  for (const p of placements) {
    const path = paths[p.outputIndex];
    if (!path) continue;
    const { data: file } = await supabaseAdmin.storage.from("ai-staging").download(path);
    if (!file) continue;
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = path.endsWith(".jpg") ? "jpg" : "png";
    const mime = ext === "jpg" ? "image/jpeg" : "image/png";
    const up = await uploadImageBufferToWp(storeId, buf, `ai-${generationId}-${p.outputIndex}.${ext}`, mime);
    if (!up.ok) {
      return res.status(502).json({ error: "error" in up ? up.error : "Upload failed", partial: results });
    }
    results.push({
      outputIndex: p.outputIndex,
      applyAs: p.applyAs,
      galleryIndex: p.galleryIndex ?? undefined,
      media: {
        id: up.media.id,
        source_url: up.media.source_url,
        thumbnail_url: up.media.thumbnail_url,
        alt: up.media.alt || "",
      },
    });
  }

  const wpIds = results.map((r) => r.media.id);
  await supabaseAdmin
    .from("ai_generations")
    .update({
      status: "approved",
      output_wp_ids: wpIds,
      updated_at: new Date().toISOString(),
    })
    .eq("id", generationId);

  if (paths.length > 0) {
    await supabaseAdmin.storage.from("ai-staging").remove(paths);
  }

  return res.status(200).json({ results });
}
