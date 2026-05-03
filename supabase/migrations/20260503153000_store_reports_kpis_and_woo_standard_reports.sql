-- Native KPIs for Reports tab + Woo-style Metabase standard report catalog.
-- Metabase embed_resource_id values must match published questions/dashboard in your Metabase instance
-- (defaults assume questions 40–48 and dashboard 50; adjust in Admin → Standard reports if yours differ).

create or replace function public.store_reports_kpis(p_store_id text, p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      date_trunc('second', now() at time zone 'utc') as end_at,
      date_trunc(
        'second',
        (now() at time zone 'utc') - make_interval(
          days => greatest(1, least(coalesce(p_days, 30), 366))
        )
      ) as start_at
  ),
  o as (
    select fo.*
    from dbt_analytics.fct_orders as fo
    cross join bounds as b
    where fo.store_id = p_store_id
      and fo.order_created_at >= b.start_at
      and fo.order_created_at <= b.end_at
  ),
  excl as (
    select *
    from o
    where lower(coalesce(status, '')) not in ('cancelled', 'failed', 'canceled')
  )
  select jsonb_build_object(
    'windowDays', coalesce(p_days, 30),
    'startsAt', (select start_at from bounds),
    'endsAt', (select end_at from bounds),
    'grossSales', coalesce((select sum(order_subtotal) from excl), 0),
    'discounts', coalesce((select sum(discount_total) from excl), 0),
    'netSales', coalesce((select sum(order_subtotal - discount_total) from excl), 0),
    'taxes', coalesce((select sum(order_tax) from excl), 0),
    'shipping', coalesce((select sum(shipping_total) from excl), 0),
    'totalSales', coalesce((select sum(order_total) from excl), 0),
    'ordersCount', coalesce((select count(*)::bigint from excl), 0::bigint),
    'refundsCount', coalesce(
      (select count(*)::bigint from o where lower(coalesce(status, '')) like '%refund%'),
      0::bigint
    ),
    'aov',
      coalesce(
        (select
          case
            when count(*) = 0 then 0::numeric
            else round(sum(order_total) / nullif(count(*), 0), 4)
          end
        from excl),
        0::numeric
      )
  );
$$;

comment on function public.store_reports_kpis(text, integer) is
  'Last-N-day order KPIs from dbt_analytics.fct_orders for the Reports tab (service-role API only).';

revoke all on function public.store_reports_kpis(text, integer) from public;
grant execute on function public.store_reports_kpis(text, integer) to service_role;

-- Drop older duplicates for the same Metabase resource so the unique constraint can be applied.
delete from public.standard_reports a
using public.standard_reports b
where a.ctid < b.ctid
  and a.provider = 'metabase'
  and b.provider = 'metabase'
  and a.embed_resource_type is not distinct from b.embed_resource_type
  and a.embed_resource_id is not distinct from b.embed_resource_id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'standard_reports_metabase_embed_key'
  ) then
    alter table public.standard_reports
      add constraint standard_reports_metabase_embed_key
      unique (provider, embed_resource_type, embed_resource_id);
  end if;
end $$;

update public.standard_reports
set is_active = false, updated_at = now()
where title = 'E-commerce Insights';

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
    'Sales reports (Woo)',
    'All nine sales charts in one Metabase dashboard (locked store scope).',
    'metabase',
    'https://metabase-server-ninq.onrender.com',
    'dashboard',
    50,
    '{}'::jsonb,
    'https://metabase-server-ninq.onrender.com/dashboard/50-sales-reports-woo',
    1,
    true,
    'BarChart3',
    'Overview'
  ),
  (
    'Total sales over time (Woo)',
    'Daily gross, discounts, tax, shipping, and total sales from dbt_analytics.fct_orders.',
    'metabase',
    'https://metabase-server-ninq.onrender.com',
    'question',
    40,
    '{}'::jsonb,
    'https://metabase-server-ninq.onrender.com/question/40-total-sales-over-time-woo',
    10,
    true,
    'LineChart',
    'Sales'
  ),
  (
    'Sales by product (Woo)',
    'Units and revenue by product from dbt_analytics.fct_order_lines.',
    'metabase',
    'https://metabase-server-ninq.onrender.com',
    'question',
    41,
    '{}'::jsonb,
    'https://metabase-server-ninq.onrender.com/question/41-sales-by-product-woo',
    20,
    true,
    'BarChart3',
    'Sales'
  ),
  (
    'Average order value over time (Woo)',
    'Mean order_total by day from dbt_analytics.fct_orders.',
    'metabase',
    'https://metabase-server-ninq.onrender.com',
    'question',
    42,
    '{}'::jsonb,
    'https://metabase-server-ninq.onrender.com/question/42-average-order-value-over-time-woo',
    30,
    true,
    'LineChart',
    'Sales'
  ),
  (
    'Sales by product variant (Woo)',
    'Revenue and units by variation label from dbt_analytics.fct_order_lines.',
    'metabase',
    'https://metabase-server-ninq.onrender.com',
    'question',
    43,
    '{}'::jsonb,
    'https://metabase-server-ninq.onrender.com/question/43-sales-by-product-variant-woo',
    40,
    true,
    'Layers',
    'Sales'
  ),
  (
    'Sales by category (Woo)',
    'Primary category rollup from dbt_analytics.fct_order_lines.',
    'metabase',
    'https://metabase-server-ninq.onrender.com',
    'question',
    44,
    '{}'::jsonb,
    'https://metabase-server-ninq.onrender.com/question/44-sales-by-category-woo',
    50,
    true,
    'PieChart',
    'Sales'
  ),
  (
    'Sales by coupon (Woo)',
    'Coupon discount totals from dbt_analytics.fct_coupon_lines.',
    'metabase',
    'https://metabase-server-ninq.onrender.com',
    'question',
    45,
    '{}'::jsonb,
    'https://metabase-server-ninq.onrender.com/question/45-sales-by-coupon-woo',
    60,
    true,
    'Ticket',
    'Sales'
  ),
  (
    'Sales by customer (Woo)',
    'Top customers by spend from dbt_analytics.fct_orders.',
    'metabase',
    'https://metabase-server-ninq.onrender.com',
    'question',
    46,
    '{}'::jsonb,
    'https://metabase-server-ninq.onrender.com/question/46-sales-by-customer-woo',
    70,
    true,
    'Users',
    'Sales'
  ),
  (
    'Sales by billing location (Woo)',
    'Orders and revenue by billing country / state / city.',
    'metabase',
    'https://metabase-server-ninq.onrender.com',
    'question',
    47,
    '{}'::jsonb,
    'https://metabase-server-ninq.onrender.com/question/47-sales-by-billing-location-woo',
    80,
    true,
    'Globe',
    'Sales'
  ),
  (
    'Sales by payment method (Woo)',
    'Revenue by payment gateway from dbt_analytics.fct_orders.',
    'metabase',
    'https://metabase-server-ninq.onrender.com',
    'question',
    48,
    '{}'::jsonb,
    'https://metabase-server-ninq.onrender.com/question/48-sales-by-payment-method-woo',
    90,
    true,
    'CreditCard',
    'Sales'
  )
on conflict (provider, embed_resource_type, embed_resource_id)
do update set
  title = excluded.title,
  description = excluded.description,
  metabase_site_url = excluded.metabase_site_url,
  locked_params = excluded.locked_params,
  dashboard_url = excluded.dashboard_url,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  icon = excluded.icon,
  report_group = excluded.report_group,
  updated_at = now();
