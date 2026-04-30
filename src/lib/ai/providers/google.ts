import type { AIImageProvider, GenerateImageInput, GenerateImageOutput } from "./types";

async function fetchAsBase64(url: string): Promise<{ mime: string; data: string }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch image: ${url.slice(0, 80)}`);
  const mime = r.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  const buf = Buffer.from(await r.arrayBuffer());
  return { mime, data: buf.toString("base64") };
}

/**
 * Gemini native image generation (Nano Banana / Flash Image).
 * @see https://ai.google.dev/gemini-api/docs/image-generation
 */
export const googleGeminiProvider: AIImageProvider = {
  id: "google_gemini",

  async generate(input: GenerateImageInput, apiKey: string): Promise<GenerateImageOutput> {
    const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [];
    for (const url of input.sourceImageUrls.slice(0, 8)) {
      const { mime, data } = await fetchAsBase64(url);
      parts.push({ inline_data: { mime_type: mime, data } });
    }
    parts.push({ text: input.prompt });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const mimeOut = "image/png";
    const body = {
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        temperature: 0.45,
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (json as { error?: { message?: string } })?.error?.message || res.statusText;
      throw new Error(`Gemini: ${msg}`);
    }

    const candidates = (json as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } }> } }> }).candidates;
    const candParts = candidates?.[0]?.content?.parts ?? [];
    let found: Buffer | null = null;
    for (const p of candParts) {
      const inline = (p as { inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } }).inlineData
        || (p as { inline_data?: { mime_type?: string; data?: string } }).inline_data;
      const b64 = inline?.data;
      if (b64) {
        found = Buffer.from(b64, "base64");
        break;
      }
    }
    if (!found) {
      const textPart = candParts.find((p) => "text" in p && (p as { text?: string }).text);
      const t = textPart && "text" in textPart ? (textPart as { text: string }).text : JSON.stringify(json).slice(0, 500);
      throw new Error(`Gemini returned no image data: ${t}`);
    }

    return { buffers: [found], mimeType: mimeOut };
  },
};
