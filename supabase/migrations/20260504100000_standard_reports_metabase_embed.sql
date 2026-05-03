-- Extend standard_reports for Metabase signed embedding + optional legacy external links.

alter table public.standard_reports
  add column if not exists provider text not null default 'link'
    check (provider in ('metabase', 'link'));

alter table public.standard_reports
  add column if not exists metabase_site_url text;

alter table public.standard_reports
  add column if not exists embed_resource_type text
    check (embed_resource_type is null or embed_resource_type in ('dashboard', 'question'));

alter table public.standard_reports
  add column if not exists embed_resource_id bigint;

alter table public.standard_reports
  add column if not exists locked_params jsonb not null default '{}'::jsonb;

-- dashboard_url is optional for metabase rows (used as optional "open in Metabase" reference link).
alter table public.standard_reports
  alter column dashboard_url drop not null;

comment on column public.standard_reports.provider is 'metabase = signed embed; link = open dashboard_url in new tab.';
comment on column public.standard_reports.metabase_site_url is 'Public Metabase origin for JWT embed (must match allowlisted host), e.g. https://metabase.example.com';
comment on column public.standard_reports.embed_resource_type is 'Metabase static embed resource type.';
comment on column public.standard_reports.embed_resource_id is 'Metabase dashboard or question id.';
comment on column public.standard_reports.locked_params is 'Additional JWT locked params merged with store_id for embedding.';
comment on table public.standard_reports is 'Super-admin curated reports: Metabase embeds or legacy HTTPS links for store Reports UI.';

alter table public.standard_reports drop constraint if exists standard_reports_provider_payload_check;

alter table public.standard_reports
  add constraint standard_reports_provider_payload_check check (
    (
      provider = 'metabase'
      and metabase_site_url is not null
      and embed_resource_type is not null
      and embed_resource_id is not null
    )
    or (
      provider = 'link'
      and dashboard_url is not null
    )
  );
