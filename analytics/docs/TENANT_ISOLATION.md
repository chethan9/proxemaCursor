# Tenant isolation (multi-store)

All analytics marts include **`store_id`**. Any BI query must filter by the correct store so merchants never see another tenant’s data.

## dbt compile-time filter (sanity checks only)

For local validation:

```bash
dbt run --vars '{"store_id":"<uuid>"}'
```

This applies the `store_id_filter` macro where models use it. This does **not** replace enforcing `store_id` in your BI tool or SQL sessions.

## Stronger isolation

- Postgres **RLS** on analytics views for the BI database role, or
- Separate collections / workspaces per customer (operations-heavy).

Choose based on compliance requirements.
