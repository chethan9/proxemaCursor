# Proxema analytics (dbt)

This folder is a **dbt project** that builds tenant-safe views over Supabase Postgres in schema **`dbt_analytics`**. Connect any BI tool (or ad-hoc SQL) to those views using a read-capable database role.

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

Warehouse views live in schema **`dbt_analytics`**. Use local **`dbt build`** or apply the Supabase migration that defines the same views (see repo `supabase/migrations/*dbt_analytics_views*`).

## Grain

See [`docs/GRAIN.md`](docs/GRAIN.md).
