import { getDecryptedProviderApiKey } from "@/services/aiProviderCredentials.server";

/**
 * OpenAI API key for chat completions — prefers configured provider credential, then env.
 */
export async function getAssistantOpenAIApiKey(): Promise<string | null> {
  const fromDb = await getDecryptedProviderApiKey("openai_image");
  if (fromDb) return fromDb;
  const env = process.env.ASSISTANT_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  return env?.trim() || null;
}

export function getAssistantModelId(): string {
  return process.env.ASSISTANT_OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

/** Used by UI to pick avatar badge (OpenAI/GPT-style vs other providers). */
export type AssistantLlmKind = "openai" | "other";

export function getAssistantLlmKind(): AssistantLlmKind {
  const id = getAssistantModelId().toLowerCase();
  if (
    id.startsWith("gpt-") ||
    /^o\d/i.test(id) ||
    id.includes("openai") ||
    id.includes("chatgpt")
  ) {
    return "openai";
  }
  return "other";
}
