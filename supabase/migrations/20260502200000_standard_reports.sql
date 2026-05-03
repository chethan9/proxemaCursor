-- Platform-wide catalog of curated reports surfaced as "standard reports" in the app (Metabase embeds / HTTPS links).
-- Access only via Next.js API routes (service role); no direct client grants.

create table if not exists public.standard_reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  dashboard_url text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  icon text,
  report_group text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists standard_reports_active_sort_idx
  on public.standard_reports (is_active, sort_order asc);

comment on table public.standard_reports is 'Super-admin curated report definitions for store Reports UI.';
