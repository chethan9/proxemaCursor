-- Toggle whether product AI generation must have at least one reference image (per feature).
ALTER TABLE public.ai_features
  ADD COLUMN IF NOT EXISTS requires_source_image boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.ai_features.requires_source_image IS
  'When true, the product AI dialog requires a source image. When false, text-only generation is allowed where the provider supports it (Gemini); OpenAI image edits still require an image.';
