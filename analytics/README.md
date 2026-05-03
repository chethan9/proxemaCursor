# Proxema analytics (dbt + Lightdash)

This folder is a **dbt project** that builds tenant-safe views over Supabase Postgres for **Lightdash** explores (metrics and dimensions only in the UI).

## Prerequisites

- Python 3.10+
- `pip install dbt-postgres` (or use `pip install dbt-core dbt-postgres`)

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

## Lightdash

1. Create a Lightdash project connected to **this Git repository** and set the **dbt project subdirectory** to `analytics` (or run `dbt` in CI and point Lightdash at artifacts — follow Lightdash docs for your edition).
2. Use the same Postgres connection as dbt (read replica recommended for production).
3. Configure **row-level access** using `store_id` — see [`docs/TENANT_ISOLATION.md`](docs/TENANT_ISOLATION.md).
4. After dashboards exist, super admins register URLs in **Admin → Standard reports** in the web app (`LIGHTDASH_ALLOWED_HOSTS` must include your Lightdash host).

### Deploy Lightdash on Render (Blueprint)

Host Lightdash **outside** this repo using Lightdash’s official Render stack (Docker + a **small Postgres for Lightdash’s own metadata** — users, saved charts). Your **warehouse** for metrics remains **Supabase** (same DB dbt uses).

1. Open **[lightdash/lightdash-deploy-render](https://github.com/lightdash/lightdash-deploy-render)** and deploy with Render **Blueprint** (“Deploy to Render” / New Blueprint from that repo).
2. Choose workspace (e.g. **proxema**) and region close to Supabase.
3. When `lightdash-server` is healthy, set **`SITE_URL`** on the web service to your public URL (`https://….onrender.com` or your custom domain).
4. In Lightdash: add **warehouse** credentials → Supabase Postgres (read-capable role; pooler/replica OK). Add **Git** → this repository, subdirectory **`analytics`**, branch **`main`**.
5. Enforce multi-store access with **`store_id`** — see [`docs/TENANT_ISOLATION.md`](docs/TENANT_ISOLATION.md).
6. In **Vercel** (Proxema app): set **`LIGHTDASH_ALLOWED_HOSTS`** to your Lightdash hostname (e.g. `your-service.onrender.com`). Then **Admin → Standard reports** can save dashboard links.

## Grain

See [`docs/GRAIN.md`](docs/GRAIN.md).
