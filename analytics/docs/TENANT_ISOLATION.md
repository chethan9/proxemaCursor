# Tenant isolation (multi-store)

All analytics marts include **`store_id`**. Lightdash must never aggregate across stores for a merchant session.

## Recommended: Lightdash user attributes

1. In Lightdash, define a user attribute (e.g. `store_id`) for **viewer** users.
2. Pass the current store id from your identity provider / embed JWT when the user opens analytics (exact mechanism depends on Lightdash Cloud vs self-hosted and SSO vs embed).
3. Add a **required filter** or SQL template filter on explores so every query includes:

   `store_id = ${lightdash.attributes.store_id}`

   (Use the expression syntax from your Lightdash version’s docs.)

4. Validate with two test stores that neither UI nor exports leak the other store.

## dbt compile-time filter (sanity checks only)

For local validation:

```bash
dbt run --vars '{"store_id":"<uuid>"}'
```

This applies the `store_id_filter` macro in `fct_orders`. It does **not** replace runtime enforcement in Lightdash.

## Stronger isolation

- Postgres **RLS** on analytics views for the BI database role, or
- Separate Lightdash projects per customer (operations-heavy).

Choose based on compliance requirements.
