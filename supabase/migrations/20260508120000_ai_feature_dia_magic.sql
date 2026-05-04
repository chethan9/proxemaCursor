-- "Dia Magic" AI feature: invisible-mannequin fashion packshot with color swatch picker.
--
-- Uses a new user_input field type "color_swatch" whose options carry both a
-- prompt value and a hex code so the client can render a real color swatch.

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
  'dia_magic',
  'Dia Magic',
  $desc$Studio invisible-mannequin packshot — sculpted shape, crisp edges, premium finish. Pick a flat background color (white, black, blue, green, purple); garment colors stay faithful to your photo.$desc$,
  5,
  'google_gemini',
  'gemini-2.5-flash-image-preview',
  $prompt$professional studio product photo of a fashion garment, displayed on invisible mannequin, strong structured silhouette, tailored fit, defined waist, sharp seams, crisp edges, firm fabric with body and thickness, no wrinkles, no sagging, no softness, sculpted shape, enhanced shoulder structure, precise symmetry, clean construction, premium luxury finish. Preserve the garment's true colors, fabric, and details exactly as in the source image — do not recolor or repaint the garment.
Background: flat solid {{user_input.background_color}} studio backdrop and sweep — one uniform matte flat color only (no gradient, no vignette, no texture, no pattern, no marble or paper grain). seamless horizon where backdrop meets floor in the same flat color.
soft diffused studio lighting with subtle realistic contact shadow directly touching the base of the garment, studio floor grounding, no floating, high contrast edge definition between garment and background, ultra realistic, high resolution, e-commerce ready, no hanger, no visible mannequin

Product (context only): {{product_name}}$prompt$,
  1,
  true,
  true,
  2,
  $json${
    "fields": [
      {
        "key": "background_color",
        "label": "Background color",
        "type": "color_swatch",
        "options": [
          { "value": "white",  "label": "White",  "hex": "#FFFFFF" },
          { "value": "black",  "label": "Black",  "hex": "#0A0A0A" },
          { "value": "blue",   "label": "Blue",   "hex": "#1E3A8A" },
          { "value": "green",  "label": "Green",  "hex": "#15803D" },
          { "value": "purple", "label": "Purple", "hex": "#6D28D9" }
        ]
      }
    ]
  }$json$::jsonb,
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
