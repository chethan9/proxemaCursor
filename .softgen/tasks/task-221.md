---
title: Production wiring — invoice + pickslip download on order pages, default template selection
status: done
priority: high
type: feature
tags: [templates, integration, orders, pdf-download]
created_by: agent
created_at: 2026-04-26T13:15:00Z
position: 221
---

## Notes
Depends on tasks 218-220. Final step — wire templates into actual workflows so users can download invoices and print pick slips for real orders. No email transport in this round (deferred per scope).

**Default template per type per client:** in templates list (task-218), each client picks one Invoice template and one Pick-Slip template as their default. Stored as `client_settings.default_invoice_template_id` and `default_pickslip_template_id`. Falls back to the "Classic" / "Standard Warehouse" sample if not set.

**Order detail page integration:** on the existing order detail page, add two action buttons — "Download Invoice" and "Print Pick Slip". Each uses the client's default template (or shows a dropdown to pick a different one if they have multiple). Clicking calls the render API from task-220, gets back a PDF blob, triggers browser download with filename `invoice-{order_number}.pdf` or `pickslip-{order_number}.pdf`.

**Bulk download:** on orders list, multi-select rows then "Download Invoices" or "Download Pick Slips" — generates a single zipped archive of all PDFs (or merged single PDF for pick slips since warehouse staff print in batches). Use `archiver` for zip, `pdf-lib` to merge.

**Print pickslip view:** clicking "Print Pick Slip" optionally opens a printable HTML view (browser print dialog) instead of PDF — same template rendered to HTML, opens in new tab with print stylesheet auto-triggering. Toggle in template settings: `print_mode: pdf | html`.

**Render audit log:** task-218 created the table, this task adds an admin viewer at /admin/template-renders showing all renders across clients (filterable by client, template, entity, date) with links to download the rendered output (stored in Supabase Storage `template-renders` bucket with 30-day retention).

**My Templates settings page** integration: on /settings/branding (or new /settings/templates), show "Default Invoice Template" and "Default Pick Slip Template" dropdowns listing this client's available templates (samples + their custom ones).

## Checklist
- [ ] Add default_invoice_template_id and default_pickslip_template_id columns to client settings, with migration and service methods
- [ ] Templates settings page section: two dropdowns for default invoice/pickslip template per client, preview thumbnail on selection, "Manage templates" link to templates list
- [ ] Order detail page: "Download Invoice" + "Print Pick Slip" buttons using client default, with template-picker dropdown if client has 2+ custom templates of that type
- [ ] PDF download flow: button click → render API call → blob download with filename `invoice-{order_number}.pdf` / `pickslip-{order_number}.pdf` → toast on success/error
- [ ] Optional HTML print mode for pickslip: opens new tab with rendered HTML + auto-triggered window.print() and print-only stylesheet, controlled by `print_mode` flag in template settings
- [ ] Bulk action on orders list: multi-select → "Download Invoices" (zipped) and "Download Pick Slips" (merged single PDF for batch printing), progress toast for jobs over 10 orders
- [ ] Storage bucket `template-renders` with 30-day retention policy, RLS for client-scoped reads
- [ ] Admin render audit viewer at /admin/template-renders: filterable list (client, template, entity, date range), download link per render, total render count + size metrics

## Acceptance
- A user opens any order, clicks "Download Invoice", and gets a PDF using their default invoice template populated with that order's real data
- Switching the default invoice template in settings changes what "Download Invoice" produces on the next click
- Selecting 5 orders and clicking "Download Pick Slips" produces a single 5-page PDF ready for warehouse printing
- Admin can audit every PDF rendered across all clients in the last 30 days