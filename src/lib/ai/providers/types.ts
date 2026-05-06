export type AIProviderId = "google_gemini" | "openai_image";

export type GenerateImageInput = {
  prompt: string;
  /** Remote URLs — providers fetch and convert */
  sourceImageUrls: string[];
  /** How many distinct images to produce */
  outputCount: number;
  model: string;
  aspectRatio?: string;
  targetWidth?: number;
  targetHeight?: number;
  openAiSize?: "1024x1024" | "1536x1024" | "1024x1536";
};

export type GenerateImageOutput = {
  buffers: Buffer[];
  mimeType: string;
};

export type AIImageProvider = {
  id: AIProviderId;
  generate(input: GenerateImageInput, apiKey: string): Promise<GenerateImageOutput>;
};
