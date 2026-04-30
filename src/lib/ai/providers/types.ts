export type AIProviderId = "google_gemini" | "openai_image";

export type GenerateImageInput = {
  prompt: string;
  /** Remote URLs — providers fetch and convert */
  sourceImageUrls: string[];
  /** How many distinct images to produce */
  outputCount: number;
  model: string;
};

export type GenerateImageOutput = {
  buffers: Buffer[];
  mimeType: string;
};

export type AIImageProvider = {
  id: AIProviderId;
  generate(input: GenerateImageInput, apiKey: string): Promise<GenerateImageOutput>;
};
