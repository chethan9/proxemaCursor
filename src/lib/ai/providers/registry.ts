import type { AIImageProvider, AIProviderId } from "./types";
import { googleGeminiProvider } from "./google";
import { openaiImageProvider } from "./openai";

const map: Record<AIProviderId, AIImageProvider> = {
  google_gemini: googleGeminiProvider,
  openai_image: openaiImageProvider,
};

export function getAIImageProvider(id: string): AIImageProvider | null {
  if (id === "google_gemini") return googleGeminiProvider;
  if (id === "openai_image") return openaiImageProvider;
  return map[id as AIProviderId] ?? null;
}
