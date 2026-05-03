-- Schema where dbt builds staging/marts for Lightdash (see analytics/profiles.yml.example).
create schema if not exists dbt_analytics;

comment on schema dbt_analytics is 'dbt output schema for proxema_analytics project (Lightdash).';

grant usage on schema dbt_analytics to postgres;
grant create on schema dbt_analytics to postgres;
