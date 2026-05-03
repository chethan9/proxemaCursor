-- Template: bulk-insert Standard reports (super admin / SQL editor).
-- Prefer **Admin → Standard reports** in the app so URLs are validated against ALLOWED_STANDARD_REPORT_HOSTS.
--
-- Schema after migration `20260504100000_standard_reports_metabase_embed.sql`:
--   provider = 'metabase' | 'link'
--   Metabase rows require: metabase_site_url, embed_resource_type, embed_resource_id
--   Link rows require: dashboard_url
--
-- Run against your Supabase project (public.standard_reports).

/*
-- Example: Metabase embedded dashboard (resource id from Metabase URL / Admin)
insert into public.standard_reports (
  title,
  description,
  provider,
  metabase_site_url,
  embed_resource_type,
  embed_resource_id,
  locked_params,
  dashboard_url,
  sort_order,
  is_active,
  icon,
  report_group
)
values
  (
    'Sales overview',
    'Revenue and AOV — see REPORTS_CATALOG.md',
    'metabase',
    'https://YOUR_METABASE_HOST',
    'dashboard',
    12,
    '{}'::jsonb,
    null,
    10,
    true,
    'BarChart3',
    'Sales'
  );

-- Example: legacy external HTTPS link
insert into public.standard_reports (
  title, description, provider, dashboard_url, metabase_site_url, embed_resource_type, embed_resource_id, locked_params,
  sort_order, is_active, icon, report_group
)
values
  (
    'External report',
    'Opens in a new tab',
    'link',
    'https://trusted-host.example.com/path',
    null,
    null,
    null,
    '{}'::jsonb,
    20,
    true,
    'LineChart',
    'Other'
  );
*/

-- Icon names must exist in ICON_MAP (see src/lib/menu-registry.ts), e.g. BarChart3, LineChart, Package.
