import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { assertStoreAccess } from "@/lib/assert-store-access";
import { consumeAICredits, getAICreditsState, aiQuotaErrorPayload } from "@/lib/ai-credits.server";
import { renderPromptTemplate } from "@/lib/ai/prompt-render";
import { getAIImageProvider } from "@/lib/ai/providers/registry";
import { getDecryptedProviderApiKey } from "@/services/aiProviderCredentials.server";
import type { TablesInsert } from "@/integrations/supabase/helpers";

type GenerateBody = {
  storeId?: string;
  productId?: string | null;
  featureSlug?: string;
  sources?: Array<{ url: string; role?: string }>;
  userInput?: Record<string, string | number | boolean>;
  outputCount?: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Not authenticated" });
  const token = authHeader.slice(7);
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userRes.user) return res.status(401).json({ error: "Invalid token" });

  const body = req.body as GenerateBody;
  const storeId = typeof body.storeId === "string" ? body.storeId : "";
  const featureSlug = typeof body.featureSlug === "string" ? body.featureSlug : "";
  const sources = Array.isArray(body.sources) ? body.sources : [];

  if (!storeId || !featureSlug || sources.length === 0 || !sources.every((s) => s?.url?.startsWith("http"))) {
    return res.status(400).json({ error: "Invalid body: storeId, featureSlug, sources[].url required" });
  }

  const gate = await assertStoreAccess(userRes.user.id, storeId);
  if (gate.allowed === false) return res.status(gate.status).json({ error: gate.message });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("client_id")
    .eq("id", userRes.user.id)
    .maybeSingle();
  const clientId = profile?.client_id ?? null;
  if (!clientId) return res.status(403).json({ error: "No client context" });

  const { data: feature, error: featErr } = await supabaseAdmin
    .from("ai_features")
    .select("*")
    .eq("slug", featureSlug)
    .eq("is_active", true)
    .maybeSingle();
  if (featErr || !feature) return res.status(404).json({ error: "Feature not found or inactive" });

  const outputCount = Math.min(
    Math.max(1, Number(body.outputCount ?? feature.default_output_count) || 1),
    8
  );
  const creditsNeeded = outputCount * feature.credit_cost_per_output;

  const state = await getAICreditsState(clientId);
  if (!state) return res.status(402).json({ error: "No active subscription", code: "no_subscription" });
  if (state.totalAvailable < creditsNeeded) {
    return res.status(402).json(aiQuotaErrorPayload(state));
  }

  const consumed = await consumeAICredits(clientId, creditsNeeded);
  if (!consumed) return res.status(402).json(aiQuotaErrorPayload(state));

  const providerId = feature.provider as "google_gemini" | "openai_image";
  const apiKey = await getDecryptedProviderApiKey(providerId);
  if (!apiKey) {
    return res.status(503).json({ error: "AI provider not configured", code: "provider_missing" });
  }

  const provider = getAIImageProvider(providerId);
  if (!provider) return res.status(500).json({ error: "Unknown provider" });

  let productName = "";
  if (body.productId) {
    const { data: prod } = await supabaseAdmin
      .from("products")
      .select("name")
      .eq("id", body.productId)
      .eq("store_id", storeId)
      .maybeSingle();
    productName = (prod as { name?: string } | null)?.name ?? "";
  }

  const userInputStr: Record<string, string> = {};
  const rawIn = body.userInput || {};
  for (const [k, v] of Object.entries(rawIn)) {
    userInputStr[k] = v === undefined || v === null ? "" : String(v);
  }

  const urls = sources.map((s) => s.url);
  const prompts: string[] = [];
  for (let i = 0; i < outputCount; i++) {
    prompts.push(
      renderPromptTemplate(feature.prompt_template, {
        product_name: productName,
        user_input: userInputStr,
        index: i + 1,
        total: outputCount,
      })
    );
  }

  const buffers: Buffer[] = [];
  let mimeType = "image/png";
  try {
    for (let i = 0; i < outputCount; i++) {
      const out = await provider.generate(
        {
          prompt: prompts[i] ?? prompts[0],
          sourceImageUrls: urls,
          outputCount: 1,
          model: feature.model,
        },
        apiKey
      );
      buffers.push(...out.buffers);
      mimeType = out.mimeType || "image/png";
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const failRow: TablesInsert<"ai_generations"> = {
      client_id: clientId,
      store_id: storeId,
      product_id: body.productId ?? null,
      feature_id: feature.id,
      actor_user_id: userRes.user.id,
      input_image_urls: urls,
      user_input: userInputStr as unknown as TablesInsert<"ai_generations">["user_input"],
      output_storage_paths: [],
      output_wp_ids: [],
      status: "failed",
      provider: feature.provider,
      model: feature.model,
      prompt_used: prompts.join("\n\n"),
      credits_spent: creditsNeeded,
      error_message: msg,
    };
    await supabaseAdmin.from("ai_generations").insert(failRow);
    return res.status(502).json({ error: msg, code: "generation_failed" });
  }

  const genId = crypto.randomUUID();
  const ext = mimeType.includes("jpeg") ? "jpg" : "png";
  const paths: string[] = [];
  const signed: Array<{ path: string; signedUrl: string; index: number }> = [];

  for (let i = 0; i < buffers.length; i++) {
    const path = `${clientId}/${genId}/${i}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage.from("ai-staging").upload(path, buffers[i], {
      contentType: mimeType,
      upsert: true,
    });
    if (upErr) {
      console.error("[ai/generate] staging upload", upErr);
      return res.status(500).json({ error: "Failed to store generated images" });
    }
    paths.push(path);
    const { data: signedData } = await supabaseAdmin.storage.from("ai-staging").createSignedUrl(path, 3600);
    if (signedData?.signedUrl) {
      signed.push({ path, signedUrl: signedData.signedUrl, index: i });
    }
  }

  const insertRow: TablesInsert<"ai_generations"> = {
    id: genId,
    client_id: clientId,
    store_id: storeId,
    product_id: body.productId ?? null,
    feature_id: feature.id,
    actor_user_id: userRes.user.id,
    input_image_urls: urls,
    user_input: userInputStr as unknown as TablesInsert<"ai_generations">["user_input"],
    output_storage_paths: paths,
    output_wp_ids: [],
    status: "success",
    provider: feature.provider,
    model: feature.model,
    prompt_used: prompts.join("\n\n"),
    credits_spent: creditsNeeded,
  };

  const { error: insErr } = await supabaseAdmin.from("ai_generations").insert(insertRow);
  if (insErr) {
    console.error(insErr);
    return res.status(500).json({ error: "Failed to record generation" });
  }

  return res.status(200).json({
    generationId: genId,
    outputs: signed,
    creditsSpent: creditsNeeded,
    feature: { slug: feature.slug, name: feature.name },
  });
}
