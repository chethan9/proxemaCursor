---
title: Replace template builder with maily.to + Puppeteer PDF
status: done
priority: high
type: feature
tags: [templates, refactor, pdf, editor]
created_by: agent
created_at: 2026-04-26
position: 228
---

## Notes

Pivoted from EmailBuilder.js to **maily.to/core** (Tiptap-based, MIT) — same block-based approach with simpler integration into our existing Next.js + Tailwind stack. All custom WooCommerce blocks built as Tiptap node extensions.

**Completed:**
- maily.to/core editor integrated at `/templates/[id]` (lazy-loaded via `next/dynamic`)
- 7 custom WooCommerce Tiptap nodes: OrderItemsTable, TotalsBlock, AddressBlock, Barcode, QrCode, SignatureLine, PageBreak
- `WooBlocksToolbar` above editor for one-click block insertion
- Server-side `render-custom-nodes.ts` walks the JSON document, replaces custom nodes with rendered HTML using `bwip-js` (barcodes) and `qrcode` (QR images)
- `render-html.ts` invokes maily render with the pre-processed config
- `render-pdf.ts` uses `puppeteer-core` + `@sparticuz/chromium` (prod) / system Chrome (dev) for HTML→PDF
- `/api/templates/[id]/render` swapped to new pipeline (preserves all query params)
- SQL migration: TRUNCATE `template_versions`, `templates` — user-approved fresh start, all samples + user templates wiped
- Templates index empty state already handles zero-templates per tab (existing implementation)
- Quick-print buttons on orders list gracefully handle missing default templates (task-227)

## Acceptance

- [x] Editor loads with custom WooCommerce blocks alongside maily defaults
- [x] Custom blocks save and round-trip through DB
- [x] Render endpoint produces HTML and PDF with real barcode/QR images
- [x] All old templates wiped — users start fresh

