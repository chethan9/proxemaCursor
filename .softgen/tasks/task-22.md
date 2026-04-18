---
title: Payment method registry + orders column fix
status: in_progress
priority: high
type: feature
tags: [orders, settings, admin]
created_by: agent
created_at: 2026-04-18T09:35:00Z
position: 22
---

## Notes
- Fallback logic for orders payment column: title → method → —
- New table `payment_methods`: key (unique, matches Woo `payment_method`), label, description, icon_url
- Super admin settings page: `/settings/payment-methods` with list + CRUD dialog
- Orders tab renders icon (if registered) + label, or raw method string as fallback
- Registry is global (not per-store) since payment gateway keys are standardized

## Checklist
- [ ] Create payment_methods table with RLS (super_admin only writes, all auth users read)
- [ ] Create paymentMethodService.ts with list/create/update/delete
- [ ] Create /settings/payment-methods.tsx page (table + add/edit dialog with icon URL field)
- [ ] Add link in settings index + sidebar
- [ ] Fix orders payment column fallback in OrdersTab.tsx
- [ ] Load registry in OrdersTab, render icon + label in payment/payment_method cells