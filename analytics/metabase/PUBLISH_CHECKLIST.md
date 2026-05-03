# Publish Woo sales reports to Metabase + Proxima

## Prerequisites

- Static embedding enabled in Metabase Admin; **Embedding secret** matches env `METABASE_EMBEDDING_SECRET` on the Proxima server.
- Deep-link helper: [DEEP_LINKS.md](./DEEP_LINKS.md).

## A. Create nine saved questions

For each SQL template in `analytics/metabase/sql/` (`01`, `02`, `05`, `07`–`12`):

1. Generate URL: `node scripts/generate-metabase-native-hash.mjs analytics/metabase/sql/<file>.sql <display>`
2. Open URL → enter **Store ID** → **Run** → **Save** as the title used in `public.standard_reports` (see migration seed).
3. **Sharing → Embed → Static embedding** → set **`store_id` = Locked** → **Publish**.

Note the numeric question id from the URL (e.g. `/question/41-...` → **41**).

If your ids differ from **40–48**, update rows in **Admin → Standard reports** (or run SQL `update public.standard_reports set embed_resource_id = … where title = …`).

## B. Bundled dashboard (“Sales reports (Woo)”)

1. **New dashboard** → name **Sales reports (Woo)** → collection **Our analytics**.
2. Add filter **Text** → slug **`store_id`** → label “Store ID”.
3. Add all nine questions as cards; connect each card’s `store_id` template tag to the dashboard filter.
4. **Sharing → Embed → Static embedding** → lock **`store_id`** → **Publish**.
5. Record dashboard id from `/dashboard/<id>-...`. Update `standard_reports` row **Sales reports (Woo)** so `embed_resource_id` matches (seed default **50**).

## C. Smoke test in Proxima

1. Open `/sites/<storeId>/reports`.
2. KPI strip should load (native RPC).
3. Open **Overview** dashboard tile and each **Sales** question tile; iframe should render store-scoped data.
4. **Download CSV** on a question tile should download CSV via signed proxy.
