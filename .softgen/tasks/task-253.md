---
title: i18n string extraction pass 2 — sites + explore + product editor
status: todo
priority: high
type: chore
tags: [i18n, strings]
created_by: agent
created_at: 2026-04-28T03:30:00Z
position: 253
---

## Notes

Depends on Task 252. Largest string pass:

- `src/pages/sites/[id]/*` (home, products, orders, customers, downloads, brands, bulk-jobs, settings, products/edit, products/new, orders/[id], customers/[id])
- `src/components/explore/*` (ProductsTab, OrdersTab, TaxonomyTab, ProductRowExpanded, OrderRowExpanded, etc.)
- `src/components/product-edit/*` (BasicEditor, AdvancedShell, all tabs, variants editor, ImagePickerDialog)
- `src/components/site/*` (StatStrip, SalesTrendCard, RecentOrdersCard, etc.)
- `src/components/project/*` (SitesTable, AddSiteDialog, etc.)
- `src/pages/projects/*`, `/clients/*`, `/explore/*`, `/sync-runs`, `/webhooks/*`, `/api-management`, `/templates/*`, `/billing/*`, `/pricing.tsx`

Strings → `public/locales/en/{sites,products,orders,billing}.json`. AI translate. Largest pass — may need to be split further mid-execution.

## Checklist

- [ ] sites/[id]/* pages → sites.json + products.json + orders.json
- [ ] explore tabs → respective namespaces
- [ ] product editor → products.json
- [ ] projects/clients/sync-runs/webhooks/api-management → common.json or sites.json
- [ ] templates/billing/pricing → billing.json
- [ ] AI-translate to 9 languages

## Acceptance

- Switching locale translates ALL user-facing pages (no English bleed-through outside admin)