import { getDecryptedProviderApiKey } from "@/services/aiProviderCredentials.server";

export type ListedAiModel = { id: string };

/** Models known to work with our OpenAI image edits integration when the vendor list filters tightly. */
const OPENAI_IMAGE_FALLBACK_IDS = ["gpt-image-1", "dall-e-2", "dall-e-3"] as const;

/** Default Gemini image model used elsewhere in the app when the API returns nothing unexpected. */
const GEMINI_IMAGE_FALLBACK_IDS = ["gemini-2.5-flash-image-preview"] as const;

async function fetchGeminiImageModelIds(apiKey: string): Promise<string[]> {
  const seen = new Set<string>();
  let pageToken: string | undefined;

  for (;;) {
    const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString());
    const json = (await res.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
      nextPageToken?: string;
      error?: { message?: string };
    };

    if (!res.ok) {
      const msg = json.error?.message || res.statusText;
      throw new Error(`Gemini models: ${msg}`);
    }

    for (const m of json.models ?? []) {
      const name = m.name ?? "";
      const short = name.replace(/^models\//, "");
      if (!short) continue;
      const methods = m.supportedGenerationMethods ?? [];
      if (!methods.includes("generateContent")) continue;
      // Image-capable Gemini models used with generateContent + IMAGE modality
      if (/image/i.test(short)) seen.add(short);
    }

    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }

  const sorted = [...seen].sort();
  if (sorted.length === 0) return [...GEMINI_IMAGE_FALLBACK_IDS];
  return sorted;
}

async function fetchOpenAIImageModelIds(apiKey: string): Promise<string[]> {
  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const json = (await res.json()) as {
    data?: Array<{ id?: string }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    const msg = json.error?.message || res.statusText;
    throw new Error(`OpenAI models: ${msg}`);
  }

  const ids = new Set<string>();
  for (const row of json.data ?? []) {
    const id = row.id;
    if (!id) continue;
    if (/^(dall-e|gpt-image)/i.test(id)) ids.add(id);
  }

  for (const fb of OPENAI_IMAGE_FALLBACK_IDS) ids.add(fb);

  return [...ids].sort();
}

export async function listModelsForAiProvider(
  provider: "google_gemini" | "openai_image"
): Promise<{ models: ListedAiModel[]; error: string | null }> {
  const apiKey = await getDecryptedProviderApiKey(provider);
  if (!apiKey) {
    return { models: [], error: "No active API key configured for this provider in AI settings." };
  }

  try {
    if (provider === "google_gemini") {
      const ids = await fetchGeminiImageModelIds(apiKey);
      return { models: ids.map((id) => ({ id })), error: null };
    }
    const ids = await fetchOpenAIImageModelIds(apiKey);
    return { models: ids.map((id) => ({ id })), error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list models";
    return { models: [], error: message };
  }
}
