import type { GeminiImageParams, OpenAiImageSizeParam } from "../image-generation-controls";

export type { GeminiImageParams, OpenAiImageSizeParam };

export type AIProviderId = "google_gemini" | "openai_image";

export type GenerateImageInput = {
  prompt: string;
  /** Remote URLs — providers fetch and convert */
  sourceImageUrls: string[];
  /** How many distinct images to produce */
  outputCount: number;
  model: string;
  /** Effective output aspect label (aligned with width/height / Gemini config). */
  aspectRatio?: string;
  targetWidth?: number;
  targetHeight?: number;
  openAiSize?: OpenAiImageSizeParam;
  /** Gemini native image generation — keeps prompt geometry consistent with API constraints. */
  geminiImage?: GeminiImageParams;
};

export type GenerateImageOutput = {
  buffers: Buffer[];
  mimeType: string;
};

export type AIImageProvider = {
  id: AIProviderId;
  generate(input: GenerateImageInput, apiKey: string): Promise<GenerateImageOutput>;
};
