# Tenant isolation (multi-store)

All analytics marts include **`store_id`**. Metabase must never show another store’s rows for a merchant session.

## Recommended: locked `store_id` in Metabase + Proxema JWT

1. In Metabase, add a **locked filter / parameter** on embedded dashboards (field slug matching **`METABASE_STORE_PARAM_SLUG`** in Proxema, default **`store_id`**).
2. Proxema mints embed JWTs server-side and passes **`store_id`** for the **current store** in the token `params` (merged with optional `locked_params` from **Admin → Standard reports**).
3. Validate with two test stores that neither embedded iframe nor exports leak the other store.

See [`METABASE_STANDARD_REPORTS.md`](./METABASE_STANDARD_REPORTS.md) for env vars.

## dbt compile-time filter (sanity checks only)

For local validation:

```bash
dbt run --vars '{"store_id":"<uuid>"}'
```

This applies the `store_id_filter` macro in `fct_orders`. It does **not** replace runtime enforcement in Metabase.

## Stronger isolation

- Postgres **RLS** on analytics views for the BI database role, or
- Separate Metabase collections / duplicate dashboards per customer (operations-heavy).

Choose based on compliance requirements.
