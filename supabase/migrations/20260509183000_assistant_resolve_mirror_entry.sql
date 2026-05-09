-- Lookup Cloudflare mirror variants (thumb first) for a normalized product image key within a store.

CREATE OR REPLACE FUNCTION public.assistant_resolve_mirror_entry(p_store_id uuid, p_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT pr.image_mirror_urls -> p_key
  FROM public.products pr
  WHERE pr.store_id = p_store_id
    AND pr.image_mirror_urls IS NOT NULL
    AND jsonb_typeof(pr.image_mirror_urls) = 'object'
    AND pr.image_mirror_urls ? p_key
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.assistant_resolve_mirror_entry(uuid, text)
  IS 'Returns image_mirror_urls entry for storage key (thumb/card/edit/zoom) when mirrored for assistant UI.';

GRANT EXECUTE ON FUNCTION public.assistant_resolve_mirror_entry(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_resolve_mirror_entry(uuid, text) TO service_role;
