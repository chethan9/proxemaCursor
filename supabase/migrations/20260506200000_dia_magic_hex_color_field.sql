-- Dia Magic: drive background from CSS hex in prompts (not color names); UI uses presets + custom picker.

UPDATE public.ai_features
SET
  description = $desc$Studio invisible-mannequin packshot — sculpted silhouette, crisp edges. Choose background as white, black, orange, or any custom color (hex). Garment colors stay faithful to your photo.$desc$,
  prompt_template = $prompt$professional studio product photo of a fashion garment, displayed on invisible mannequin, strong structured silhouette, tailored fit, defined waist, sharp seams, crisp edges, firm fabric with body and thickness, no wrinkles, no sagging, no softness, sculpted shape, enhanced shoulder structure, precise symmetry, clean construction, premium luxury finish. Preserve the garment's true colors, fabric, and details exactly as in the source image — do not recolor or repaint the garment.

BACKGROUND COLOR (CRITICAL): The entire visible studio cyclorama, backdrop, and floor sweep must be ONE uniform flat matte color. Use exactly this CSS hexadecimal value for both wall and floor: {{user_input.background_color}}. Match this hex precisely — no gradients, no vignettes, no texture, no pattern. Do not substitute light grey, off-white, cream, or any other color unless that color IS the specified hex (e.g. #FFFFFF for white). Seamless horizon where backdrop meets floor in the same hex.

soft diffused studio lighting with subtle realistic contact shadow directly touching the base of the garment, studio floor grounding, no floating, high contrast edge definition between garment and background, ultra realistic, high resolution, e-commerce ready, no hanger, no visible mannequin

Product (context only): {{product_name}}$prompt$,
  user_input_schema = $json${
    "fields": [
      {
        "key": "background_color",
        "label": "Background color",
        "type": "hex_color",
        "default": "#FFFFFF",
        "presets": [
          { "hex": "#FFFFFF", "label": "White" },
          { "hex": "#000000", "label": "Black" },
          { "hex": "#EA580C", "label": "Orange" }
        ]
      }
    ]
  }$json$::jsonb,
  updated_at = now()
WHERE slug = 'dia_magic';
