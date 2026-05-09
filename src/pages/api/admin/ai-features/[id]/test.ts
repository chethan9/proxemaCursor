import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { resolveUserFromRequest } from "@/lib/server-auth";
import { getAIImageProvider } from "@/lib/ai/providers/registry";
import { getDecryptedProviderApiKey } from "@/services/aiProviderCredentials.server";
import { renderPromptTemplate } from "@/lib/ai/prompt-render";
import { resolveImageControls } from "@/lib/ai/image-generation-controls";

/** Smoke-test generation (0 credits). Uses optional sample image URL or placeholder fetch. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const me = await resolveUserFromRequest(req);
  if (!me?.userId || me.role !== "super_admin") {
    return res.status(403).json({ error: "Super admin only" });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const id = typeof req.query.id === "string" ? req.query.id : "";
  if (!id) return res.status(400).json({ error: "Missing id" });

  const body = req.body as { sampleImageUrl?: string; userInput?: Record<string, string | number | boolean> };
  const sampleUrl =
    typeof body.sampleImageUrl === "string" && body.sampleImageUrl.startsWith("http")
      ? body.sampleImageUrl
      : "https://picsum.photos/512/512";

  const { data: feature, error } = await supabaseAdmin.from("ai_features").select("*").eq("id", id).maybeSingle();
  if (error || !feature) return res.status(404).json({ error: "Feature not found" });

  const providerId = feature.provider as "google_gemini" | "openai_image";
  const apiKey = await getDecryptedProviderApiKey(providerId);
  if (!apiKey) return res.status(503).json({ error: "Provider API key not configured" });

  const provider = getAIImageProvider(providerId);
  if (!provider) return res.status(500).json({ error: "Unknown provider" });

  const prompt = renderPromptTemplate(feature.prompt_template, {
    product_name: "Test product",
    user_input: Object.fromEntries(
      Object.entries(body.userInput || {}).map(([k, v]) => [k, String(v ?? "")])
    ),
    index: 1,
    total: 1,
  });
  const controls = resolveImageControls(
    Object.fromEntries(Object.entries(body.userInput || {}).map(([k, v]) => [k, String(v ?? "")]))
  );

  try {
    const out = await provider.generate(
      {
        prompt: `${prompt}\n${controls.instruction}`,
        sourceImageUrls: [sampleUrl],
        outputCount: 1,
        model: feature.model,
        aspectRatio: controls.outputAspectRatio,
        targetWidth: controls.width,
        targetHeight: controls.height,
        openAiSize: controls.openAiSize,
        geminiImage: {
          aspectRatio: controls.outputAspectRatio,
          imageSize: controls.geminiImageSize,
        },
      },
      apiKey
    );
    const buf = out.buffers[0];
    if (!buf) throw new Error("No image returned");

    const path = `test/${me.userId}/${Date.now()}.png`;
    await supabaseAdmin.storage.from("ai-staging").upload(path, buf, {
      contentType: out.mimeType || "image/png",
      upsert: true,
    });
    const { data: signed } = await supabaseAdmin.storage.from("ai-staging").createSignedUrl(path, 600);

    return res.status(200).json({ ok: true, previewUrl: signed?.signedUrl ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(502).json({ error: msg });
  }
}
