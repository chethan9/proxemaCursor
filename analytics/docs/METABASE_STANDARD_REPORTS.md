# Metabase + Standard reports (Proxema)

Store-facing **Reports** load **Metabase static embeds**: the Next.js API signs a short-lived JWT with the same secret configured in Metabase **Admin → Embedding**.

## Render hosting (proxema workspace)

Infrastructure on **Render** (team **proxema**):

| Resource | Purpose |
|----------|---------|
| PostgreSQL **`metabase-app-db`** | Metabase’s **application** database (metadata). [Dashboard](https://dashboard.render.com/d/dpg-d7rcvpbt6lks73fp4uo0-a) |
| Web service **`metabase-server`** | Docker image from [render-examples/metabase](https://github.com/render-examples/metabase). URL: `https://metabase-server-ninq.onrender.com` |

**Before Metabase will start:** open **`metabase-server`** → **Environment** and set **`MB_DB_CONNECTION_URI`** to the **Internal Database URL** from **`metabase-app-db`** (database → **Connect** → copy internal URI). You can also use Render’s **Link database** flow to inject this variable. **`MB_ENCRYPTION_SECRET_KEY`** should already be set on the web service; rotate it in Render if you did not create the service yourself.

**Cutover:** after Metabase is healthy and static embedding is configured, suspend or remove the legacy **`lightdash-server`** service ([settings](https://dashboard.render.com/web/srv-d7r8ouf7f7vs73cqsql0/settings)).

**Proxema app:** add host **`metabase-server-ninq.onrender.com`** to **`ALLOWED_STANDARD_REPORT_HOSTS`** when referencing this instance in **Admin → Standard reports**.

## Metabase setup (once)

1. Connect Metabase to Postgres (Supabase) and prefer models in schema **`dbt_analytics`** (`fct_orders`, `fct_order_lines`, etc.).
2. Create a dashboard or saved question. Add a **locked filter** / parameter for **`store_id`** (UUID text) matching your charts’ `store_id` field.
3. **Admin → Embedding** → enable static embedding, copy the **embedding secret**.

## Proxema app env (Vercel / server)

| Variable | Required | Description |
|----------|----------|-------------|
| `METABASE_EMBEDDING_SECRET` | Yes | Must match Metabase embedding secret (server-only). |
| `ALLOWED_STANDARD_REPORT_HOSTS` | Yes | Comma-separated hostnames (no protocol) allowed when saving Metabase site URLs or external link URLs in **Admin → Standard reports**. Legacy `LIGHTDASH_ALLOWED_HOSTS` / `METABASE_ALLOWED_HOSTS` are still honored if unset. |
| `METABASE_STORE_PARAM_SLUG` | No | Locked parameter name for tenant id (default `store_id`). Must match the Metabase dashboard/question locked parameter slug. |
| `METABASE_EMBED_TTL_SECONDS` | No | JWT lifetime for embed tokens (default `600`). |

Do **not** expose `METABASE_EMBEDDING_SECRET` to the browser.

## Admin → Standard reports

- **Provider: Metabase (embedded)** — set **Metabase site URL** (`https://your-metabase.example.com`), **resource type** (`dashboard` or `question`), **resource id** (numeric id from Metabase URL). Optional **reference URL** opens the native Metabase UI. Optional **locked params** JSON merges with `store_id` for the JWT.
- **Provider: External HTTPS link** — legacy `dashboard_url` only (same host allowlist).

## Troubleshooting

| Issue | Check |
|-------|--------|
| 503 “METABASE_EMBEDDING_SECRET is not configured” | Set secret on Proxema server env. |
| Metabase shows “Invalid signature” | Secret mismatch between Metabase and Proxema. |
| Wrong store data | Locked parameter slug must match `METABASE_STORE_PARAM_SLUG` and Metabase field. |
| iframe blank / blocked | Metabase must allow embedding; check Metabase **Admin → Embedding** and browser console. |
