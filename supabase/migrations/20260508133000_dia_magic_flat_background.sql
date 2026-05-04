-- Dia Magic: colors apply to flat studio BACKGROUND only; garment stays true to source.

UPDATE public.ai_features
SET
  description = $desc$Studio invisible-mannequin packshot — sculpted silhouette, crisp edges, premium finish. Pick a flat background color (white, black, blue, green, purple); garment colors stay faithful to your photo.$desc$,
  prompt_template = $prompt$professional studio product photo of a fashion garment, displayed on invisible mannequin, strong structured silhouette, tailored fit, defined waist, sharp seams, crisp edges, firm fabric with body and thickness, no wrinkles, no sagging, no softness, sculpted shape, enhanced shoulder structure, precise symmetry, clean construction, premium luxury finish. Preserve the garment's true colors, fabric, and details exactly as in the source image — do not recolor or repaint the garment.
Background: flat solid {{user_input.background_color}} studio backdrop and sweep — one uniform matte flat color only (no gradient, no vignette, no texture, no pattern, no marble or paper grain). seamless horizon where backdrop meets floor in the same flat color.
soft diffused studio lighting with subtle realistic contact shadow directly touching the base of the garment, studio floor grounding, no floating, high contrast edge definition between garment and background, ultra realistic, high resolution, e-commerce ready, no hanger, no visible mannequin

Product (context only): {{product_name}}$prompt$,
  user_input_schema = $json${
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
  updated_at = now()
WHERE slug = 'dia_magic';
