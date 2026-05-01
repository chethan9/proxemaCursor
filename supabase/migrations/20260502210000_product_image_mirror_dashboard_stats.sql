-- Dashboard aggregates for admin Cloudflare Images mirror monitoring (service_role only).

CREATE OR REPLACE FUNCTION public.get_product_image_mirror_dashboard_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'counts', jsonb_build_object(
      'total_rows', (SELECT COUNT(*)::bigint FROM product_image_mirrors),
      'ready', (SELECT COUNT(*)::bigint FROM product_image_mirrors WHERE status = 'ready'),
      'pending', (SELECT COUNT(*)::bigint FROM product_image_mirrors WHERE status = 'pending'),
      'failed', (SELECT COUNT(*)::bigint FROM product_image_mirrors WHERE status = 'failed'),
      'deleting', (SELECT COUNT(*)::bigint FROM product_image_mirrors WHERE status = 'deleting'),
      'distinct_cf_images', (
        SELECT COUNT(DISTINCT cf_image_id)::bigint
        FROM product_image_mirrors
        WHERE status = 'ready' AND cf_image_id IS NOT NULL
      ),
      'repair_queue', (
        SELECT COUNT(*)::bigint FROM product_image_mirrors WHERE status IN ('pending', 'failed')
      )
    ),
    'by_source', COALESCE(
      (
        SELECT jsonb_object_agg(source_kind, c)
        FROM (
          SELECT source_kind, COUNT(*)::bigint AS c
          FROM product_image_mirrors
          GROUP BY source_kind
        ) x
      ),
      '{}'::jsonb
    ),
    'recent_failures', COALESCE(
      (
        SELECT jsonb_agg(q.obj ORDER BY q.sort_ts DESC NULLS LAST)
        FROM (
          SELECT
            jsonb_build_object(
              'id', m.id,
              'store_id', m.store_id,
              'product_id', m.product_id,
              'error', LEFT(COALESCE(m.error, ''), 320),
              'updated_at', m.updated_at,
              'source_kind', m.source_kind,
              'store_name', s.name,
              'store_url', s.url
            ) AS obj,
            m.updated_at AS sort_ts
          FROM product_image_mirrors m
          LEFT JOIN stores s ON s.id = m.store_id
          WHERE m.status = 'failed'
          ORDER BY m.updated_at DESC NULLS LAST
          LIMIT 15
        ) q
      ),
      '[]'::jsonb
    ),
    'top_pending_by_store', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'store_id', t.store_id,
            'store_name', t.store_name,
            'store_url', t.store_url,
            'pending_count', t.pending_count
          )
          ORDER BY t.pending_count DESC
        )
        FROM (
          SELECT
            m.store_id,
            s.name AS store_name,
            s.url AS store_url,
            COUNT(*)::bigint AS pending_count
          FROM product_image_mirrors m
          JOIN stores s ON s.id = m.store_id
          WHERE m.status = 'pending'
          GROUP BY m.store_id, s.name, s.url
          ORDER BY pending_count DESC
          LIMIT 10
        ) t
      ),
      '[]'::jsonb
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_product_image_mirror_dashboard_stats() TO service_role;
