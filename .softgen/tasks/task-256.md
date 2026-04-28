---
title: Expand i18n namespaces and wire t() into UI
status: todo
priority: high
type: feature
tags: [i18n, ui]
created_by: agent
created_at: 2026-04-28
position: 256
---

## Notes
common.json now translated across all 10 locales. Next: create per-namespace JSON files (auth, sites, products, orders, billing, admin, settings) for `en` first, then translate. Replace hardcoded strings in components with `useTranslation()` + `t()` calls. Prioritize high-traffic surfaces: AppSidebar, AuthGuard pages (login/signup), site nav, billing.

## Checklist
- [ ] Create en/auth.json with login/signup/forgot/reset/confirm strings, wire into src/pages/auth/*.tsx
- [ ] Create en/sites.json (site nav, home stats, banners), wire into SiteSidebar + home.tsx
- [ ] Create en/products.json (table headers, edit form labels, validation), wire into ProductsTab + product-edit/*
- [ ] Create en/orders.json (statuses, columns, detail labels), wire into OrdersTab + orders/[orderId].tsx
- [ ] Create en/billing.json (plan card, usage meter, checkout), wire into billing/* pages
- [ ] Create en/admin.json (activity, payment gateways/logs), wire into admin/* pages
- [ ] Create en/settings.json (profile, theme, users, roles, branding, plans, subscriptions), wire into settings/* pages
- [ ] Translate each new namespace into ar, es, fr, de, pt, hi, zh, ja, ru
- [ ] Replace hardcoded strings in AppSidebar.tsx with t("nav.*") from common
- [ ] Smoke test: switch to ar, verify RTL + Arabic strings render across all surfaces

## Acceptance
- Switching locale updates copy across sidebar, auth pages, and at least one site surface
- No raw English bleed-through on translated pages when locale ≠ en