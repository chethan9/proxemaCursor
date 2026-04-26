---
title: PDF compression + 1-week auto-cleanup for bulk invoices
status: done
priority: high
type: feature
tags: [pdf, storage, cron]
created_by: agent
created_at: 2026-04-26
position: 230
---

## Notes

Two related cleanup wins for the bulk-invoices feature:

**(1) Reduce generated PDF size.** Current pipeline: `renderHtmlToPdf` (puppeteer-core, headless Chrome) → per-order PDFs → `pdf-lib` merge for single-pdf, or JSZip for zip. Output PDFs are bigger than they need to be. Two layers to attack:
- **Render-time** in `src/lib/templates/render-pdf.ts`: keep `printBackground: true` only when template needs it; let templates opt out via a config flag. Use `preferCSSPageSize: true` to drop redundant CSS frame data. Disable `tagged` PDF generation. Set viewport to a sane size before `setContent` so puppeteer doesn't embed retina-scale assets.
- **Post-process** in `src/lib/templates/render-pdf.ts` (new helper) and `src/pages/api/cron/process-bulk-jobs.ts` (`finalizeBulkInvoiceArtifact`): when merging via `pdf-lib`, call `PDFDocument.save({ useObjectStreams: true, addDefaultPage: false })` (object streams reduce file size). Optionally pass merged buffer through a second compression pass: try `pdf-lib`'s `save` with `objectsPerTick` tuning, or shell out to `gs` (Ghostscript) only if available — Ghostscript is NOT on Vercel by default, so don't depend on it. Keep `pdf-lib`-only path as the production option.
- Add a payload flag `compress: boolean` (default `true`) so we can toggle if a customer reports rendering issues.
- Acceptance metric: target ≥30% size reduction on a 10-order single-PDF compared to current output.

**(2) Auto-delete bulk-invoice artifacts after 7 days.** Storage bucket `bulk-invoices` (private). Files are scoped under `{client_id|store-{store_id}}/{job_id}.{pdf|zip}` plus optional `parts/` leftovers if a job failed mid-finalize.
- Add cron endpoint `src/pages/api/cron/cleanup-bulk-invoices.ts` (Vercel cron, daily) that:
  - Lists all `bulk_jobs` rows with `job_type = "print_invoices_bulk"` AND `completed_at < now() - 7 days` AND `payload->>'artifact_path' IS NOT NULL`.
  - For each, removes the artifact file + any leftover `parts/` folder from the `bulk-invoices` bucket via service role.
  - Updates the row: clears `payload.artifact_path`, sets new flag `payload.artifact_deleted = true` so the UI knows the file is gone.
  - Also cleans orphan `parts/` folders for `failed`/`cancelled` jobs older than 7 days.
- Register the cron in `vercel.json` — daily at e.g. `0 3 * * *`.
- Update `src/pages/api/bulk-jobs/[id]/download.ts` to return a clear 410 Gone with message "Invoice archive expired (auto-deleted after 7 days)" when `artifact_deleted` is true.
- Update `src/components/BulkJobsToast.tsx` and `src/pages/sites/[id]/bulk-jobs.tsx` to show a "Expired" state instead of a download button for jobs with `artifact_deleted = true`.

**Out of scope:** changing retention from 7 days (hard-coded for now), per-tenant retention overrides, manual delete UI.

## Checklist

- [ ] Add `compress` flag to bulk job payload type (`BulkJobPayload` in `src/services/bulkJobService.ts`); default `true` in `PrintInvoicesDialog`
- [ ] Render-time tweaks in `renderHtmlToPdf`: `preferCSSPageSize: true`, set viewport before `setContent`, allow `printBackground` override via opts
- [ ] Post-merge compression in `finalizeBulkInvoiceArtifact`: use `PDFDocument.save({ useObjectStreams: true })` for the merged single-PDF path
- [ ] Measure: log byte size of single-PDF output before/after for a 10-order test job; verify ≥30% reduction
- [ ] Create cron endpoint `src/pages/api/cron/cleanup-bulk-invoices.ts` that deletes artifacts + clears `payload.artifact_path` for `print_invoices_bulk` jobs older than 7 days, sets `payload.artifact_deleted = true`
- [ ] Cron also removes leftover `parts/` folders from `failed`/`cancelled` print jobs older than 7 days
- [ ] Register daily cron schedule in `vercel.json`
- [ ] Update `src/pages/api/bulk-jobs/[id]/download.ts` to return 410 Gone with explicit message when `artifact_deleted = true`
- [ ] Update `BulkJobsToast.tsx` and `src/pages/sites/[id]/bulk-jobs.tsx` to show "Expired" state for deleted artifacts (no download button, info tooltip)
- [ ] Manual end-to-end test: queue a print job, verify smaller file size, simulate `completed_at` 8 days ago, run cron once, verify file gone + UI shows expired

## Acceptance

- A merged 10-order single-PDF is at least 30% smaller than before, validated by logged byte counts.
- Running the cleanup cron deletes artifacts whose jobs completed > 7 days ago and the bulk-jobs UI shows "Expired" instead of a broken download link.
- Jobs newer than 7 days still download successfully.