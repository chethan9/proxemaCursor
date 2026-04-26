---
title: Bulk print invoices from orders list
status: done
priority: high
type: feature
tags: [orders, templates, bulk-jobs, pdf]
created_by: agent
created_at: 2026-04-26
position: 223
---

## Notes

Add multi-select to the orders explorer and let users batch-print invoices for the selected orders. The job runs through the existing bulk-jobs infrastructure (`bulk_jobs` table + `/api/cron/process-bulk-jobs`) so it survives reloads, shows progress in `BulkJobsToast`, and is auditable.

Surfaces touched:
- `src/components/explore/OrdersTab.tsx` — row checkboxes, header "select all on page" checkbox, selection count + clear, bulk action bar, "Print invoices" button.
- `src/pages/api/cron/process-bulk-jobs.ts` — new job kind `print_invoices_bulk` that resolves each order, renders the chosen template (default or user-picked) via the existing template render pipeline, and produces the output artifact(s).
- `src/lib/templates/render-pdf.tsx` / `src/lib/templates/render-html.ts` — reuse existing renderers; add a helper that merges N PDFs into one when "single file" mode is chosen, or zips N PDFs when "multi-file" mode is chosen.
- `src/services/bulkJobService.ts` — typed enqueue helper for the new job kind with payload `{ store_id, order_ids, template_id, output: "single-pdf" | "zip" }`.
- New API route `/api/bulk-jobs/[id]/download` — streams the produced artifact (single PDF or ZIP) from Supabase Storage with a signed URL; deletes after first download or after 24h.
- Supabase Storage bucket `bulk-invoices/` (private) — stores produced artifacts keyed by `client_id/job_id.{pdf|zip}`.
- `src/components/BulkJobsToast.tsx` — when a `print_invoices_bulk` job completes, show a "Download" action that hits the new download endpoint.

Output modes:
- **Single PDF** — concatenate all order invoices into one PDF (cover page optional, page breaks between orders). Uses `pdf-lib` to merge.
- **ZIP of PDFs** — one PDF per order, named `invoice-{order_number}.pdf`, packed into a single zip.

Permissions / quotas:
- Reuse existing per-client bulk-job concurrency limit; cap selection at 500 orders per batch (configurable, soft cap with confirmation above 100).
- Activity log entry `orders.bulk_invoice_printed` with order count, template, output mode, job id.

UX details:
- Selection persists across pagination but shows "X selected across N pages" hint.
- Bulk action bar appears as a sticky bar above the table when ≥1 row selected (mirror existing `BulkActionBar.tsx` pattern).
- Print invoices button opens a small dialog: template picker (defaults to the site/client default), output mode radio (Single PDF / ZIP of PDFs), confirm + cancel.
- Toast on enqueue: "Generating X invoices… Download will appear when ready". `BulkJobsToast` shows progress and final download link.

## Checklist

- [x] Row-level checkbox column in orders explorer with header "select all on current page" and tri-state behavior.
- [x] Selection state hook tracking selected order ids across pagination, with "Clear selection" and "X selected" indicator.
- [x] Sticky bulk action bar above the table when ≥1 row selected, with "Print invoices" primary button and a count badge.
- [x] Print invoices dialog: template picker (defaults to client default for type=invoice), output mode radio (Single PDF / ZIP of PDFs), confirm + cancel, soft warning above 100 orders.
- [x] New bulk-job kind `print_invoices_bulk` enqueued with `{ store_id, order_ids, template_id, output_mode }` payload.
- [x] Worker handler resolves orders, renders each invoice via the existing template pipeline, merges to single PDF (pdf-lib) or zips per-order PDFs (jszip).
- [x] Produced artifact uploaded to private `bulk-invoices` storage bucket keyed by `client_id/job_id.{pdf|zip}`.
- [x] `/api/bulk-jobs/[id]/download` endpoint returns a signed URL and serves the artifact; auto-cleanup after 24h.
- [x] `BulkJobsToast` shows Download action when a print job completes.
- [x] Activity log entry `orders.bulk_invoice_printed` with order count, template name, output mode, job id.
- [x] Hard cap of 500 orders per batch, soft confirmation above 100.

## Acceptance

- A user can select multiple orders in the explorer, click "Print invoices", choose Single PDF or ZIP, and receive a downloadable artifact with one invoice per selected order.
- The job runs in the background via bulk-jobs and is visible in the existing bulk-jobs toast and `bulk-jobs` page; closing the tab does not cancel it.
- The default template auto-selects in the dialog and matches the site's configured default invoice template.