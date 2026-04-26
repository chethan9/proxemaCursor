---
title: PDF + HTML renderers and variable interpolation engine
status: todo
priority: high
type: feature
tags: [templates, render, pdf, react-pdf]
created_by: agent
created_at: 2026-04-26T13:10:00Z
position: 220
---

## Notes
Depends on task-218 (block model + variables) and task-219 (builder produces documents). Implements the actual rendering pipeline: block tree → output. Two renderers initially, both consuming the same document.

Renderer registry pattern: a map of `output_format → renderer function`. First entries: `pdf` (server-side), `html` (browser, used by builder preview). Future entries (`email-html`, `print-html`) plug in without changing the document model. Each renderer implements `(document, data, styles) => output`.

**Variable interpolation engine** (shared by all renderers): walk text nodes in the document, find `{{path.to.value}}` patterns, resolve against the data object, sanitize output (escape HTML in HTML renderer, no escape needed in PDF). Supports array iteration for `order_items_table` block — block-specific renderer iterates `data.order.items[]` and renders one row per item. Handles missing values with empty string fallback (no "undefined" leaking through). Supports basic formatters: `{{order.total | currency}}`, `{{order.date | date:"MMM d, yyyy"}}` — keep formatter list small (currency, date, uppercase, lowercase) and extensible.

**HTML renderer** (used by builder preview + future web view): produces email-safe table-based HTML for compatibility, or div-based for modern preview (toggle via render mode flag). Uses inline styles only (no `<style>` tag) for email-safety down the line. Handles all 14 block types from task-218.

**PDF renderer** with `@react-pdf/renderer`: server-side function that takes (document, data, styles) and returns a PDF buffer/stream. Map each block type to a React-PDF component:
- `text` / `heading` → `<Text>` with style
- `image` → `<Image src={resolved}>` (handles `{{store.logo}}` URL resolution)
- `divider` / `spacer` → `<View>` with margin/border
- `columns` → `<View style={{flexDirection:'row'}}>` with child column views
- `address_block` → `<View>` with stacked `<Text>` lines from billing/shipping data
- `order_items_table` → React-PDF table emulation with header row + iterated item rows + configurable columns
- `totals_block` → right-aligned table with conditional rows
- `barcode` → use `bwip-js` (Node-compatible) to generate Code128 PNG buffer, embed as `<Image>`
- `qr_code` → use `qrcode` npm package, generate PNG buffer, embed as `<Image>`
- `signature_line` → `<View>` with bottom border + label
- `html` → not supported in PDF (skip with warning), supported in HTML
- `page_break` → React-PDF `<View break />`

API endpoint: `POST /api/templates/render` accepts `{template_id, version_id?, entity_type, entity_id, format}` — fetches template + entity data, picks renderer, returns PDF blob (for `format=pdf`) or HTML string. Logs entry to `template_renders` table.

Sample data fixtures (used by builder preview, not API): hardcoded representative invoice + pickslip data so previews look real even before any orders exist. For real renders, data comes from the actual order via existing orderService + storeService.

PDF page setup: A4 (595×842pt) by default, configurable via document.page_settings (size, margins, orientation). Header/footer support deferred unless user requests.

## Checklist
- [ ] Variable interpolation engine: resolves `{{path.to.value}}`, supports nested paths, formatters (currency/date/uppercase/lowercase), array iteration via block-aware rendering, missing-value fallback to empty string
- [ ] HTML renderer for all 14 block types: inline-styled, table-based for compatibility, used by builder live preview, supports light/dark preview mode
- [ ] PDF renderer with react-pdf for all 14 block types except `html` (skipped in PDF): A4 default, configurable margins, page-break support
- [ ] Composite block renderers: `order_items_table` (header + iterated rows + configurable columns subtotal), `totals_block` (configurable visible rows), `address_block` (formatted address from billing/shipping data), `barcode` (Code128 via bwip-js), `qr_code` (via qrcode npm)
- [ ] Renderer registry pattern: `output_format → renderer function`, easy to add `email-html` later without touching existing code
- [ ] Render API endpoint accepting template_id + entity_id + format, returning PDF buffer or HTML, with quota check + auth + render audit log entry
- [ ] Sample data fixtures for invoice + pickslip: representative order with line items, customer, addresses, totals — used by builder preview
- [ ] Real-data resolver: given entity_type + entity_id, fetches order/store data and shapes it to match the variable catalog from task-218

## Acceptance
- A built invoice template renders to a downloadable A4 PDF that matches the live preview within reasonable visual tolerance
- A pickslip template renders with a working scannable Code128 barcode of the order number
- Missing variables (e.g. order has no shipping address) render as empty space, not "undefined" or crashes
- The same template document produces both HTML preview and PDF output through the registry
