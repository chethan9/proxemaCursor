---
title: Downloads page per site (invoices, reports, exports)
status: done
priority: high
type: feature
tags: [downloads, ui, site-page]
created_by: agent
created_at: 2026-04-26
position: 231
---

## Notes

Add a new "Downloads" page at `/sites/[id]/downloads` — a single place for the user to find every generated file for that site (bulk invoice archives, future single-order invoices, future reports/exports). Inspired by the Downloads UI screenshot: top stat cards by file type, then a searchable/filterable table with download + preview actions.

**Where the files live today:**
- `bulk_jobs` rows with `job_type = 'print_invoices_bulk'` and `payload.artifact_path` set → file in private storage bucket `bulk-invoices`. This is the only generator right now.
- The download endpoint already exists: `src/pages/api/bulk-jobs/[id]/download.ts` — returns a signed URL.
- Future generators (single-order invoice, packing slips, reports) will land in the same bulk-jobs table or extensions of it; the page must be designed to absorb them without rework.

**Sidebar placement:**
- Add a new `site-downloads` entry in `SITE_MENU_REGISTRY` (`src/lib/menu-registry.ts`) with path `/downloads`, icon `Download` (add to `ICON_MAP` if not already there — actually use `FileDown` or `Inbox` — pick one already in lucide-react v0.474; `Download` is safe), `defaultGroup: "Main"`, `defaultOrder: 6` so it appears directly below Tags (which is order 5).
- Create the route file `src/pages/sites/[id]/downloads.tsx` using `SiteLayout`.

**Page content (one screen, no tabs):**
1. **Header bar:** "Downloads" title + subtitle "All generated documents and reports for {site name}". Right side: search input (filters file name / order ref / customer name), a Filters popover (file type checkboxes + date range), and an "Export list" button (downloads a CSV manifest of currently-filtered rows — NOT the files themselves; "Export All" from the screenshot is misleading at scale, replace with this).
2. **Stat cards row (5 cards, responsive grid):** All Files · Invoices · Packing Slips · Credit Notes · Reports. Each shows count + "Total files" caption. Counts come from filtered set. For now Packing Slips / Credit Notes / Reports will be `0` placeholders since we don't generate them yet — show them anyway so the layout is stable when those generators ship.
3. **Files table** with columns: checkbox · File name (with file-type icon) · Type (colored badge: Invoice = blue, Packing Slip = green, Credit Note = amber, Report = purple) · Order/Ref (job id short or order number for single-order in future) · Customer (blank for bulk) · Date generated · Size (formatted KB/MB — fetch via storage `list` or store in `payload.artifact_size_bytes` going forward) · Actions (download icon, preview-in-new-tab icon, overflow menu with "Copy link", "Delete").
4. **Bulk actions bar** when rows checked: Download all (zip them server-side OR just fire each download), Delete selected (requires confirm; only allowed for completed jobs).
5. **Pagination:** standard, 20/50/100 rows per page, total count.

**Data layer:**
- New service file `src/services/downloadsService.ts` — function `listSiteDownloads(storeId, { search, types, dateFrom, dateTo, page, pageSize })` → queries `bulk_jobs` where `store_id = storeId AND status = 'completed' AND payload->>'artifact_path' IS NOT NULL AND COALESCE((payload->>'artifact_deleted')::bool, false) = false`. Returns shape `{ rows: DownloadFile[], total: number }` where `DownloadFile = { id, type: 'invoice'|'packing_slip'|'credit_note'|'report', file_name, order_ref, customer_name, generated_at, size_bytes, artifact_path, source: 'bulk_job', source_id }`. Designed so future single-order or report rows from other tables can union into the same shape.
- Hook `useSiteDownloads(storeId, filters)` in `src/hooks/queries/`.
- File size: try to read from `payload.artifact_size_bytes` first; if missing, fall back to a one-time storage HEAD via the existing admin route (don't block list render — show "—" until size resolves).

**Empty/loading/error states:**
- Loading: skeleton rows + skeleton cards.
- Empty (no downloads ever): friendly empty state with `EmptyIllustrations` + caption "No documents generated yet. Generate invoices from the Orders page to see them here."
- Filtered-empty: "No files match these filters" with a Reset button.

**Wiring with existing features:**
- Bulk Jobs page (`src/pages/sites/[id]/bulk-jobs.tsx`) and the BulkJobsToast already show inline download buttons — keep them, but add a "View all in Downloads" link/button.
- When task-230's auto-cleanup runs and sets `payload.artifact_deleted = true`, those rows must NOT appear here (the service filter excludes them).
- Hook into the existing realtime subscription in `useStoreBulkJobs` so the page auto-refreshes when a new artifact lands.

**Permissions:**
- Reuse `PERMISSIONS.SITES_VIEW` for now. No separate permission needed.

**Out of scope:**
- Generating new types of files (single-order invoice, packing slip, credit note, reports) — those land in their own tasks. The page must just be ready to render them.
- Per-row size-on-disk audit; trust `payload.artifact_size_bytes` and skip if missing.

## Checklist

- [ ] Add `site-downloads` entry to `SITE_MENU_REGISTRY` with path `/downloads`, icon `Download`, group `Main`, order 6
- [ ] Verify `Download` (or `FileDown`) icon is registered in `ICON_MAP` in `src/lib/menu-registry.ts`; add if missing
- [ ] Create `src/services/downloadsService.ts` with `listSiteDownloads` returning unified `DownloadFile` rows from `bulk_jobs` (extensible to future sources)
- [ ] Create `src/hooks/queries/useSiteDownloads.ts` wrapping `listSiteDownloads` with filter-aware query key + realtime invalidation on `bulk_jobs` changes
- [ ] Create page `src/pages/sites/[id]/downloads.tsx` using `SiteLayout`
- [ ] Header: title, subtitle with site name, search input, filters popover (type checkboxes + date range), "Export list" CSV button
- [ ] 5 stat cards (All / Invoices / Packing Slips / Credit Notes / Reports) showing counts of currently-filtered rows
- [ ] Files table with columns: checkbox, file name + type icon, type badge (color per type), order/ref, customer, date generated, size, actions
- [ ] Action buttons per row: Download (calls existing `/api/bulk-jobs/[id]/download`), Preview (opens in new tab), overflow menu with Copy link + Delete
- [ ] Bulk select bar: Download selected, Delete selected (with confirm dialog)
- [ ] Pagination: 20/50/100 per page, total count, page navigation
- [ ] Loading skeleton + empty state (with `EmptyIllustrations`) + filtered-empty state with Reset
- [ ] Add "View all in Downloads" link on Bulk Jobs page and BulkJobsToast pointing to the new page
- [ ] When `payload.artifact_deleted = true` (from task-230 cleanup), rows are excluded from the list
- [ ] Realtime: page updates when a new bulk job artifact lands or status changes

## Acceptance

- Sidebar shows a new "Downloads" item directly below Tags in the Main group.
- Visiting `/sites/{id}/downloads` lists every completed `print_invoices_bulk` job for that site with file name, type badge, date, and a working download button.
- Searching by order ref or customer narrows the rows; filtering by type updates both the table and the stat-card counts.
- Deleted/expired artifacts (per task-230) are not shown.
- The page renders an empty state with illustration when the site has never generated a file.