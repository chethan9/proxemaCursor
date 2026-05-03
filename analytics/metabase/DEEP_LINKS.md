# Metabase deep links (proxema DB id `3`)

Run from repo root to regenerate:

```bash
node scripts/generate-metabase-native-hash.mjs analytics/metabase/sql/<file>.sql [line|bar|table]
```

Open each URL while logged into Metabase, set **Store ID**, **Run**, **Save** into **Our analytics**, then **Sharing → Static embedding → Lock `store_id` → Publish**.

| Report | SQL file | Display hint |
| --- | --- | --- |
| Total sales over time | `01_total_sales_over_time.sql` | line |
| Sales by product | `02_sales_by_product.sql` | bar |
| Average order value over time | `05_aov_over_time.sql` | line |
| Sales by product variant | `07_sales_by_variant.sql` | bar (switch to row chart in UI) |
| Sales by category | `08_sales_by_category.sql` | bar or pie |
| Sales by coupon | `09_sales_by_coupon.sql` | bar |
| Sales by customer | `10_sales_by_customer.sql` | table |
| Sales by billing location | `11_sales_by_billing_location.sql` | table |
| Sales by payment method | `12_sales_by_payment_method.sql` | bar or donut |

After saving, Metabase assigns question ids. Update **Proxima Admin → Standard reports** (or DB seed) so `embed_resource_id` matches **your** Metabase question/dashboard ids. Repo defaults assume questions **40–48** and bundled dashboard **50**.
