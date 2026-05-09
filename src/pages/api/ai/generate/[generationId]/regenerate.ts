import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { assertStoreAccess } from "@/lib/assert-store-access";
import { isBillingDevMode } from "@/lib/billing-dev-mode.server";
import { consumeAICredits, getAICreditsState, aiQuotaErrorPayload } from "@/lib/ai-credits.server";
import { composeImageGenerationPrompt, renderPromptTemplate } from "@/lib/ai/prompt-render";
import { getAIImageProvider } from "@/lib/ai/providers/registry";
import { getDecryptedProviderApiKey } from "@/services/aiProviderCredentials.server";
import { resolveImageControls } from "@/lib/ai/image-generation-controls";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not authenticated" });
  const token = authHeader.slice(7);
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userRes.user) return res.status(401).json({ error: "Invalid token" });

  const generationId = typeof req.query.generationId === "string" ? req.query.generationId : "";
  if (!generationId) return res.status(400).json({ error: "Missing generation id" });

  const body = req.body as { storeId?: string; outputIndices?: number[]; additionalPrompt?: string };
  const storeId = typeof body.storeId === "string" ? body.storeId : "";
  if (!storeId) return res.status(400).json({ error: "storeId required" });

  const gate = await assertStoreAccess(userRes.user.id, storeId);
  if (gate.allowed === false) return res.status(gate.status).json({ error: gate.message });

  const { data: profile } = await supabaseAdmin.from("profiles").select("client_id").eq("id", userRes.user.id).maybeSingle();
  const clientId = profile?.client_id;
  if (!clientId) return res.status(403).json({ error: "No client" });

  const { data: gen, error: gErr } = await supabaseAdmin.from("ai_generations").select("*").eq("id", generationId).maybeSingle();
  if (gErr || !gen) return res.status(404).json({ error: "Generation not found" });
  if ((gen as { client_id: string }).client_id !== clientId) return res.status(403).json({ error: "Forbidden" });
  if ((gen as { store_id: string }).store_id !== storeId) return res.status(400).json({ error: "Store mismatch" });

  const { data: feature } = await supabaseAdmin.from("ai_features").select("*").eq("id", (gen as { feature_id: string }).feature_id).maybeSingle();
  if (!feature) return res.status(500).json({ error: "Feature missing" });

  const urls = ((gen as { input_image_urls: string[] }).input_image_urls || []) as string[];
  const userInputRaw = (gen as { user_input: Record<string, string> }).user_input || {};
  const userInputStr: Record<string, string> = {};
  for (const [k, v] of Object.entries(userInputRaw)) {
    userInputStr[k] = String(v ?? "");
  }
  const storedAdditional = (userInputStr.additional_prompt || "").trim();
  const additionalPromptFromBody =
    typeof body.additionalPrompt === "string" ? body.additionalPrompt.trim() : undefined;
  /** Prefer live request text; if omitted, reuse what was stored on the generation. */
  const additionalPrompt =
    additionalPromptFromBody !== undefined ? additionalPromptFromBody : storedAdditional;
  const imageControls = resolveImageControls(userInputStr);

  let productName = "";
  const pid = (gen as { product_id: string | null }).product_id;
  if (pid) {
    const { data: prod } = await supabaseAdmin.from("products").select("name").eq("id", pid).eq("store_id", storeId).maybeSingle();
    productName = (prod as { name?: string } | null)?.name ?? "";
  }

  const paths = ((gen as { output_storage_paths: string[] }).output_storage_paths || []) as string[];
  const indices =
    Array.isArray(body.outputIndices) && body.outputIndices.length > 0
      ? body.outputIndices.filter((i) => i >= 0 && i < paths.length)
      : paths.map((_, i) => i);

  if (indices.length === 0) return res.status(400).json({ error: "Nothing to regenerate" });

  const costEach = Number(feature.credit_cost_per_output) || 1;
  const creditsNeeded = indices.length * costEach;

  const billingDevMode = await isBillingDevMode();
  if (!billingDevMode) {
    const state = await getAICreditsState(clientId);
    if (!state) return res.status(402).json({ error: "No subscription" });
    if (state.totalAvailable < creditsNeeded) return res.status(402).json(aiQuotaErrorPayload(state));

    const consumed = await consumeAICredits(clientId, creditsNeeded);
    if (!consumed) return res.status(402).json(aiQuotaErrorPayload(state));
  }

  const providerId = feature.provider as "google_gemini" | "openai_image";
  const apiKey = await getDecryptedProviderApiKey(providerId);
  if (!apiKey) return res.status(503).json({ error: "AI provider not configured" });

  const provider = getAIImageProvider(providerId);
  if (!provider) return res.status(500).json({ error: "Unknown provider" });

  const total = indices.length;
  const newPaths = [...paths];
  const signed: Array<{ path: string; signedUrl: string; index: number }> = [];

  try {
    for (let j = 0; j < indices.length; j++) {
      const idx = indices[j];
      const prompt = composeImageGenerationPrompt({
        renderedTemplate: renderPromptTemplate(feature.prompt_template, {
          product_name: productName,
          user_input: userInputStr,
          index: idx + 1,
          total,
        }),
        imageInstruction: imageControls.instruction,
        additionalPrompt,
      });
      const out = await provider.generate(
        {
          prompt,
          sourceImageUrls: urls,
          outputCount: 1,
          model: feature.model,
          aspectRatio: imageControls.outputAspectRatio,
          targetWidth: imageControls.width,
          targetHeight: imageControls.height,
          openAiSize: imageControls.openAiSize,
          geminiImage: {
            aspectRatio: imageControls.outputAspectRatio,
            imageSize: imageControls.geminiImageSize,
          },
        },
        apiKey
      );
      const buf = out.buffers[0];
      if (!buf) throw new Error("No buffer");
      const mimeType = out.mimeType || "image/png";
      const ext = mimeType.includes("jpeg") ? "jpg" : "png";
      const path = `${clientId}/${generationId}/${idx}.${ext}`;
      const { error: upErr } = await supabaseAdmin.storage.from("ai-staging").upload(path, buf, {
        contentType: mimeType,
        upsert: true,
      });
      if (upErr) throw upErr;
      newPaths[idx] = path;
      const { data: signedData } = await supabaseAdmin.storage.from("ai-staging").createSignedUrl(path, 3600);
      if (signedData?.signedUrl) signed.push({ path, signedUrl: signedData.signedUrl, index: idx });
    }

    await supabaseAdmin
      .from("ai_generations")
      .update({
        output_storage_paths: newPaths,
        credits_spent: (gen as { credits_spent: number }).credits_spent + creditsNeeded,
        updated_at: new Date().toISOString(),
      })
      .eq("id", generationId);

    return res.status(200).json({ generationId, outputs: signed, creditsSpent: creditsNeeded });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(502).json({ error: msg });
  }
}
