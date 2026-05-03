# Metabase + Standard reports (Proxema)

Store-facing **Reports** load **Metabase static embeds**: the Next.js API signs a short-lived JWT with the same secret configured in Metabase **Admin → Embedding**.

## Render hosting (proxema workspace)

Infrastructure on **Render** (team **proxema**):

| Resource | Purpose |
|----------|---------|
| PostgreSQL **`metabase-app-db`** | Metabase’s **application** database (metadata). [Dashboard](https://dashboard.render.com/d/dpg-d7rcvpbt6lks73fp4uo0-a) |
| Web service **`metabase-server`** | Docker image from [render-examples/metabase](https://github.com/render-examples/metabase). URL: `https://metabase-server-ninq.onrender.com` |

**Instance RAM:** Metabase needs **more than 512 MiB**. Render’s **Starter** web tier (~512 MiB) triggers **`Out of memory (used over 512Mi)`** and deploy failures. In **`metabase-server`** → **Settings**, upgrade the instance to **Standard** (2 GB RAM) or higher ([Render Metabase guide](https://render.com/docs/deploy-metabase) recommends ≥ 1 GB).

**Environment (web service):**

| Variable | Notes |
|----------|--------|
| `MB_JETTY_PORT` | Must match Render’s HTTP port ( **`10000`** for this service). Without it, Metabase listens on **3000** and Render reports “no open ports”. |
| `JAVA_TOOL_OPTIONS` | Optional tuning for small instances (e.g. `-XX:MaxRAMPercentage=52`). After upgrading RAM, you can relax this. |
| `MB_DB_CONNECTION_URI` | **Required for production:** Internal Database URL from **`metabase-app-db`** (or use **Link database**). Without it, Metabase falls back to embedded H2 and still uses significant memory at startup. |

**Before Metabase will start reliably:** set **`MB_DB_CONNECTION_URI`** as above. **`MB_ENCRYPTION_SECRET_KEY`** should already be set on the web service; rotate it in Render if you did not create the service yourself.

**Proxema app:** add host **`metabase-server-ninq.onrender.com`** to **`ALLOWED_STANDARD_REPORT_HOSTS`** when referencing this instance in **Admin → Standard reports**.

## Metabase setup (once)

1. Connect Metabase to Postgres (Supabase) and prefer models in schema **`dbt_analytics`** (`fct_orders`, `fct_order_lines`, etc.).
2. Create a dashboard or saved question. Add a **locked filter** / parameter for **`store_id`** (UUID text) matching your charts’ `store_id` field.
3. **Admin → Embedding** → enable static embedding, copy the **embedding secret**.

## Proxema app env (Vercel / server)

| Variable | Required | Description |
|----------|----------|-------------|
| `METABASE_EMBEDDING_SECRET` | Yes | Must match Metabase embedding secret (server-only). |
| `ALLOWED_STANDARD_REPORT_HOSTS` | Yes | Comma-separated hostnames (no protocol) allowed when saving Metabase site URLs or external link URLs in **Admin → Standard reports**. Optional alias **`METABASE_ALLOWED_HOSTS`** if unset. |
| `METABASE_STORE_PARAM_SLUG` | No | Locked parameter name for tenant id (default `store_id`). Must match the Metabase dashboard/question locked parameter slug. |
| `METABASE_EMBED_TTL_SECONDS` | No | JWT lifetime for embed tokens (default `600`). |

Do **not** expose `METABASE_EMBEDDING_SECRET` to the browser.

## Admin → Standard reports

- **Provider: Metabase (embedded)** — set **Metabase site URL** (`https://your-metabase.example.com`), **resource type** (`dashboard` or `question`), **resource id** (numeric id from Metabase URL). Optional **reference URL** opens the native Metabase UI. Optional **locked params** JSON merges with `store_id` for the JWT.
- **Provider: External HTTPS link** — legacy `dashboard_url` only (same host allowlist).

## Prepare your first reports (end-to-end)

1. **One warehouse connection in Metabase** — **Admin → Databases:** keep a single **proxema** (Supabase) entry; remove duplicates to avoid double sync.
2. **Build dashboards in Metabase** — Start from [`REPORTS_CATALOG.md`](./REPORTS_CATALOG.md). Practical first dashboard:
   - **Sales over time:** model **`dbt_analytics.fct_orders`**, time on **`order_created_at`**, sum **`total_revenue`** (and optionally **`order_count`**).
   - **Orders by status:** same model, dimension **`status`**, metric **`order_count`**.
   - Add a **dashboard filter** (text or field filter) wired to **`store_id`**, set **Locked** for embedding, slug **`store_id`** (unless you override `METABASE_STORE_PARAM_SLUG` in Proxema).
3. **Note the numeric dashboard id** — Open the dashboard; URL looks like `/dashboard/42` → **`42`** is `embed_resource_id`.
4. **Static embedding** — **Admin → Embedding:** enable, copy **embedding secret** → set **`METABASE_EMBEDDING_SECRET`** on Vercel (same value).
5. **Proxema env** — Set **`ALLOWED_STANDARD_REPORT_HOSTS`** to your Metabase hostname only (e.g. `metabase-server-ninq.onrender.com`), no `https://`.
6. **Register in Proxema** — **Admin → Standard reports** → add row: **Metabase site URL** = `https://<your-host>` (no trailing slash issues), **resource type** = `dashboard`, **resource id** = numeric id, **Provider** = Metabase.
7. **Verify in app** — Open a site → **Reports** → open the report; iframe should load with only that store’s rows (JWT locks **`store_id`**).

Bulk SQL inserts (advanced): [`standard-reports-insert-template.sql`](./standard-reports-insert-template.sql).

## Troubleshooting

| Issue | Check |
|-------|--------|
| 503 “METABASE_EMBEDDING_SECRET is not configured” | Set secret on Proxema server env. |
| Metabase shows “Invalid signature” | Secret mismatch between Metabase and Proxema. |
| Wrong store data | Locked parameter slug must match `METABASE_STORE_PARAM_SLUG` and Metabase field. |
| iframe blank / blocked | Metabase must allow embedding; check Metabase **Admin → Embedding** and browser console. |
| Site never loads / deploy fails, logs show **512Mi** or **Java heap space** | Upgrade **`metabase-server`** to **≥ 2 GB** RAM on Render; set **`MB_JETTY_PORT=10000`**; add **`MB_DB_CONNECTION_URI`**. |
