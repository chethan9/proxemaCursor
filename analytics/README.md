# Proxema analytics (dbt + Metabase)

This folder is a **dbt project** that builds tenant-safe views over Supabase Postgres. **Metabase** (or any HTTPS link) is used for BI; the Proxema app embeds Metabase dashboards via **Admin → Standard reports** (signed JWT) on each store’s **Reports** page.

## Prerequisites

- Python **3.11 or 3.12** recommended for local `dbt` (3.14+ may crash on import; CI uses 3.11).
- `pip install dbt-postgres` (or `pip install dbt-core dbt-postgres`)

## Setup

1. Copy `profiles.yml.example` to `profiles.yml` (gitignored).
2. Set environment variables (Supabase **database** credentials — prefer a read-only role / pooler):

   | Variable | Description |
   |----------|-------------|
   | `DBT_PG_HOST` | Postgres host |
   | `DBT_PG_PORT` | Usually `5432` or pooler port |
   | `DBT_PG_USER` | Role with `SELECT` on `public.orders` |
   | `DBT_PG_PASSWORD` | Password |
   | `DBT_PG_DATABASE` | Database name |
   | `DBT_PG_SCHEMA` | Where dbt builds views (default `dbt_analytics`) |
   | `DBT_SOURCE_SCHEMA` | App schema (default `public`) |

3. Install packages and build:

```bash
cd analytics
dbt deps
dbt build
```

Optional single-store compile:

```bash
dbt run --vars '{"store_id":"YOUR-STORE-UUID"}'
```

## Metabase

1. Run Metabase (e.g. [Deploy Metabase on Render](https://render.com/docs/deploy-metabase)) with its **own** small Postgres for Metabase app data (`MB_DB_CONNECTION_URI`).
2. In Metabase **Admin**, add a database connection to the **same** Supabase / Postgres used by dbt (read-capable role; pooler/replica OK). Prefer schema **`dbt_analytics`** or expose those views.
3. Enable **Static embedding** in Metabase and copy the **embedding secret**. Put the **same secret** in the Proxema app as **`METABASE_EMBEDDING_SECRET`** (Vercel).
4. Build dashboards/questions with a **locked parameter** for tenant scope (default slug **`store_id`**, Overridable via **`METABASE_STORE_PARAM_SLUG`** on the app). Full Woo-style report list + Metabase clicks: [`docs/METABASE_WOO_REPORTS_PLAYBOOK.md`](docs/METABASE_WOO_REPORTS_PLAYBOOK.md). Optional native SQL: [`metabase/sql/`](metabase/sql/).
5. Register reports in Proxema **Admin → Standard reports** (Metabase site URL, resource type + id). See [`docs/METABASE_STANDARD_REPORTS.md`](docs/METABASE_STANDARD_REPORTS.md).
6. On **Vercel**, set **`ALLOWED_STANDARD_REPORT_HOSTS`** (comma-separated **hostnames only**, no `https://`) so saved Metabase URLs pass validation. Optional alias: **`METABASE_ALLOWED_HOSTS`** if unset.

Warehouse views live in schema **`dbt_analytics`**. Use local **`dbt build`** or apply the Supabase migration that defines the same views (see repo `supabase/migrations/*dbt_analytics_views*`).

## Grain

See [`docs/GRAIN.md`](docs/GRAIN.md).

## Report catalog (Woo-style)

See [`docs/REPORTS_CATALOG.md`](docs/REPORTS_CATALOG.md) for mapping reports to `fct_*` models and suggested Metabase visualizations.

## Standard reports (app integration)

- Operator guide: [`docs/METABASE_STANDARD_REPORTS.md`](docs/METABASE_STANDARD_REPORTS.md)
- SQL template for bulk inserts: [`docs/standard-reports-insert-template.sql`](docs/standard-reports-insert-template.sql)
