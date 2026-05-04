-- Two AI image features: ecommerce catalog polish + premium white-background packshot.

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
  'ecommerce_catalog_polish',
  'E-commerce catalog polish',
  'Enhance lighting and color, straighten framing for marketplace tiles, complementary backdrop with soft shadows.',
  55,
  'google_gemini',
  'gemini-2.5-flash-image-preview',
  'Professional ecommerce catalog transformation of the source photo. Correct perspective and viewing angle so the product reads upright and square on the canvas as standard marketplace tiles expect. Adjust brightness, exposure, and white balance for accurate color correction without altering branding hues. Refine contrast subtly for a crisp premium catalog feel. Crop or pad framing so composition feels intentional for PDP thumbnails and grids. Place the product on a complementary subtle studio background style: {{user_input.background}} — smooth gradient or muted tone that supports the product without distraction. Add realistic soft diffused shadows beneath and behind the product for depth. Preserve exact product silhouette, labels, logos, packaging geometry, and printed colors — only polish photography; never redesign the item. Product: {{product_name}}.',
  1,
  true,
  true,
  2,
  '{"fields":[{"key":"background","label":"Background mood","type":"select","options":["soft neutral gray studio","warm beige gradient","cool minimal tint","subtle pastel wash","light marble texture"]}]}'::jsonb,
  true,
  true
),
(
  'premium_white_background',
  'Premium white background',
  'Pure white seamless backdrop with premium color correction for a luxury packshot.',
  60,
  'google_gemini',
  'gemini-2.5-flash-image-preview',
  'High-end commercial packshot. Replace the background with clean pure white (#FFFFFF) seamless studio paper with a smooth horizon. Edge the product with a natural crisp cutout; no busy props. Apply professional color correction: neutralize color casts, match true product colors, refine highlights and midtones for a luxury catalog look. Add subtle clarity on texture where appropriate; do not invent or replace labels or logos. Ground contact shadow style: {{user_input.shadow}} on white only; keep shadow believable and minimal color spill. Product: {{product_name}}.',
  1,
  true,
  true,
  2,
  '{"fields":[{"key":"shadow","label":"Contact shadow","type":"select","options":["soft natural","very subtle","defined studio"]}]}'::jsonb,
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
