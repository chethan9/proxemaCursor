---
title: Customer module fixes
status: todo
priority: medium
type: bug
tags: [customers]
created_by: agent
created_at: 2026-04-24
position: 189
---

## Notes
Five related bugs in the Customer module:

- **Px-36:** Searching by `@username` returns no results; search by name works. The service must include `username` in the ILIKE OR-clause.
- **Px-37:** Search bar placeholder is cut off — letter "c" of "city…" is partially visible. Shorten the placeholder.
- **Px-39:** "Reset" button in Customize Columns popover does nothing.
- **Px-40:** Edit Customer with empty billing/shipping shows the raw technical error `WooCommerce PUT customer/30 failed: 400` instead of a friendly validation message.
- **Px-50:** Delete customer action triggers a native browser confirm / WooCommerce redirect rather than a styled in-app confirmation dialog.

Affected files: `src/services/customerService.ts` (search), `src/pages/sites/[id]/customers.tsx` (search bar placeholder + Reset button + column preferences), `src/pages/sites/[id]/customers/[customerId].tsx` (Edit save error handling), customer delete handler (wherever it lives — verify before edit).

## Checklist
- [ ] Customer search: include `username` column in the ILIKE filter; strip leading `@` from the search term before matching
- [ ] Shorten search placeholder (e.g. "Search customers…" or "Search name, email, phone…") so full text is visible at default widths
- [ ] Implement Reset in Customize Columns: restores default column visibility + order, persists via view preferences
- [ ] Edit Customer: catch Woo 400 response, parse message, show user-friendly toast ("Billing address is required" or the Woo message cleaned up) instead of the raw "WooCommerce PUT customer/30 failed: 400"
- [ ] Delete customer: replace native confirm with a shadcn AlertDialog ("Delete customer? This cannot be undone.")
- [ ] AlertDialog must be non-dismissable on outside click (only Cancel / Delete buttons close)

## Acceptance
- Searching `@priya` returns the customer with username "priya"
- Placeholder text is fully visible in the search bar
- Reset button restores default column visibility
- Saving Edit Customer with missing address shows a clean validation message, no `WooCommerce PUT ...` text
- Delete action shows an in-app confirmation dialog