-- Free-form user prompt drives generation; still uses reference image (Gemini).

INSERT INTO public.ai_features (
  slug,
  name,
  description,
  sort_order,
  provider,
  model,
  prompt_template,
  default_output_count,
  supports_main,
  supports_gallery,
  credit_cost_per_output,
  user_input_schema,
  requires_source_image,
  is_active
)
VALUES
(
  'custom_prompt',
  'Custom prompt',
  $desc$You write the instructions; the model edits the product image to match. Use Apply to push results to the product.$desc$,
  70,
  'google_gemini',
  'gemini-2.5-flash-image-preview',
  $prompt${{user_input.prompt}}

Product name (context only): {{product_name}}

Execute the user instructions above. Output a photorealistic, ecommerce-ready image. Preserve true product identity, logos, labels, and geometry unless the instructions explicitly ask to change them.$prompt$,
  1,
  true,
  true,
  2,
  $json${"fields":[{"key":"prompt","label":"Your prompt","type":"textarea","placeholder":"Describe the edit: style, background, lighting, angle, retouching…"}]}$json$::jsonb,
  true,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  provider = EXCLUDED.provider,
  model = EXCLUDED.model,
  prompt_template = EXCLUDED.prompt_template,
  default_output_count = EXCLUDED.default_output_count,
  supports_main = EXCLUDED.supports_main,
  supports_gallery = EXCLUDED.supports_gallery,
  credit_cost_per_output = EXCLUDED.credit_cost_per_output,
  user_input_schema = EXCLUDED.user_input_schema,
  requires_source_image = EXCLUDED.requires_source_image,
  is_active = EXCLUDED.is_active,
  updated_at = now();
