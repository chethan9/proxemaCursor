import type { AIImageProvider, GenerateImageInput, GenerateImageOutput } from "./types";

/**
 * OpenAI Images API — edit/variation style generation from a reference image.
 */
export const openaiImageProvider: AIImageProvider = {
  id: "openai_image",

  async generate(input: GenerateImageInput, apiKey: string): Promise<GenerateImageOutput> {
    const mimeOut = "image/png";

    const primaryUrl = input.sourceImageUrls[0];
    if (!primaryUrl) throw new Error("OpenAI image provider requires at least one source image URL");

    const imgRes = await fetch(primaryUrl);
    if (!imgRes.ok) throw new Error("Failed to download source image for OpenAI");
    const blob = await imgRes.blob();
    const mime = blob.type || "image/png";
    const ab = await blob.arrayBuffer();
    const fileBlob = new Blob([ab], { type: mime });

    const form = new FormData();
    form.append("model", input.model || "gpt-image-1");
    form.append("prompt", input.prompt);
    form.append("n", "1");
    const size = input.openAiSize || "1024x1024";
    form.append("size", size);
    form.append("image", fileBlob, "source.png");

    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (json as { error?: { message?: string } })?.error?.message || res.statusText;
      throw new Error(`OpenAI images: ${msg}`);
    }

    const arr = (json as { data?: Array<{ b64_json?: string; url?: string }> }).data;
    const first = arr?.[0];
    let buf: Buffer;
    if (first?.b64_json) {
      buf = Buffer.from(first.b64_json, "base64");
    } else if (first?.url) {
      const r = await fetch(first.url);
      buf = Buffer.from(await r.arrayBuffer());
    } else {
      throw new Error("OpenAI returned no image in response");
    }

    return { buffers: [buf], mimeType: mimeOut };
  },
};
