---
title: HTML-based template system (replace maily.to builder)
status: todo
priority: high
type: feature
tags: [templates, refactor, pdf, cleanup]
created_by: agent
created_at: 2026-04-26
position: 229
---

## Notes

Pivot from the maily.to block editor to a **raw HTML template system** with Handlebars variable substitution. Users can pick from premade samples or write/paste their own HTML. Server compiles HTML + order data → renders to PDF via existing Puppeteer pipeline.

**Why:** the block editor is overkill for invoices/pickslips (highly structured documents), CSS conflicts with Tailwind, and users genuinely want "looks professional out of the box" not "build from scratch". HTML templates are reliable, portable, and easy to design externally then paste in.

### Cleanup — remove these

- Uninstall `@maily-to/core` from package.json
- Delete `src/lib/templates/nodes/` (entire folder: 8 files)
- Delete `src/lib/templates/render-custom-nodes.ts`
- Delete `src/components/template-builder/WooBlocksToolbar.tsx`
- Delete `src/components/template-builder/` folder if empty after
- Strip maily references from `src/lib/templates/render-html.ts` and `src/pages/templates/[id].tsx`

### New schema

`template_versions.config` (jsonb) shape becomes `{ html: string, name: string }` — drop the Tiptap JSON doc structure. Keep migration backward-compatible by detecting old shape and ignoring (templates already wiped per task-228, so no real data to migrate).

### Render pipeline

- Install `handlebars` package
- `render-html.ts` → compile template's `html` string with Handlebars, pass resolved variables, return final HTML
- `render-pdf.ts` → unchanged (Puppeteer takes HTML, returns PDF)
- Register Handlebars helpers in a new `src/lib/templates/helpers.ts`:
  - `{{currency amount currencyCode}}` — formatted money
  - `{{date value format}}` — store-aware date formatting
  - `{{barcode value format width height}}` — returns `<img src="data:..."/>` via bwip-js
  - `{{qrcode value size}}` — returns `<img src="data:..."/>` via qrcode
  - `{{eq a b}}`, `{{gt a b}}` — comparison helpers for `{{#if}}`
  - `{{multiply a b}}` — for line item totals
- Keep `bwip-js` and `qrcode` deps — they're used by the helpers

### Variable model

Document the available context passed to every template:
- `order` — number, date, status, currency, total, subtotal, tax, shipping, discount, payment_method_title, customer_note
- `customer` — first_name, last_name, email, phone, full_name (computed)
- `billing` / `shipping` — first_name, last_name, address_1, address_2, city, state, postcode, country
- `items` — array of `{ name, sku, qty, price, total, image, meta }` for `{{#each items}}`
- `store` — name, url, logo_url, currency
- `meta` — printed_at, template_name

`src/lib/templates/resolve-order.ts` already builds most of this — adapt it to flatten into the Handlebars context shape.

### Premade samples (5 baked-in HTML files)

Store in `src/lib/templates/samples/` as `.html` files (raw, with Handlebars tokens):
1. `invoice-modern.html` — clean serif header, light accent stripe, two-column billing/shipping, items table with thumbnails
2. `invoice-classic.html` — bold company header, ruled lines, monospaced totals block, traditional accountant style
3. `invoice-minimal.html` — single-color, lots of whitespace, no logo block, mobile-friendly
4. `pickslip-warehouse.html` — large SKU + qty columns, big barcode top-right, signature line
5. `pickslip-compact.html` — half-page format, dense layout, two orders per A4

Each file includes inline `<style>` (no external CSS), uses Handlebars tokens, and is print-optimized (`@page` margins, page-break rules).

Ship a small script `scripts/seed-template-samples.mjs` that reads the files and inserts/upserts them into `templates` + `template_versions` as `is_sample = true`. Run via `node scripts/seed-template-samples.mjs` after migration. The script should be idempotent — match by sample slug.

### Editor UI

`src/pages/templates/[id].tsx` becomes an HTML code editor + live preview:

- **Left pane (60%):** Monaco editor (`@monaco-editor/react`) configured for HTML, dark/light matching theme, autocomplete on Handlebars tokens
- **Right pane (40%):** live preview iframe, sandboxed, refreshes on debounce (500ms after typing stops). Preview uses a sample order context (mock data) so user sees real-looking output without needing a real order
- **Top bar:** template name (editable), type badge (invoice/pickslip), Save button, "Set as default" toggle, Preview-with-real-order dropdown (lists last 5 orders for the user's stores → renders preview with that order)
- **Right sidebar (collapsible):** "Available variables" tree — categories (Order / Customer / Billing / Shipping / Items / Store), click any token to copy `{{order.number}}` to clipboard. Below: helpers reference (`{{currency}}`, `{{barcode}}`, etc.) with one-line examples
- **Mobile:** stack vertically, preview becomes a "Show preview" button that opens a sheet

### Templates index page

- Sample gallery section: visual cards (HTML thumbnail rendered via small iframe or static screenshot), "Use this template" button → forks the sample HTML into a new user template
- "Your templates" section: existing card grid
- "Start blank" button creates a minimal stub HTML template
- "Import HTML" button: paste raw HTML into a dialog → creates new template with that HTML

### Activity log

Log `template.created`, `template.updated`, `template.deleted`, `template.set_default`, `template.forked_from_sample` with template id + name in metadata.

### Edge cases

- Invalid Handlebars syntax → render endpoint returns 400 with line/column of error, editor shows error toast in preview pane
- Missing variables (`{{order.foo}}` where `foo` doesn't exist) → render as empty string, don't crash
- HTML sanitization: do NOT sanitize template HTML (users author it), but the user-facing iframe preview should be sandboxed (`sandbox="allow-same-origin"` only) so injected scripts can't escape
- Large templates (>100KB) — show editor warning but allow save
- Print scaling — encourage `@page { size: A4; margin: 15mm }` in samples

## Checklist

- [ ] Remove `@maily-to/core` dependency from `package.json`
- [ ] Delete `src/lib/templates/nodes/` folder, `render-custom-nodes.ts`, `WooBlocksToolbar.tsx`
- [ ] Install `handlebars` and `@monaco-editor/react`
- [ ] New `src/lib/templates/helpers.ts` registers Handlebars helpers (currency, date, barcode, qrcode, eq, gt, multiply)
- [ ] Update `render-html.ts` to compile template HTML string with Handlebars + resolved order context
- [ ] Adapt `resolve-order.ts` to produce flat context object matching the variable model in Notes
- [ ] Update `template_versions.config` shape to `{ html: string, name: string }` — services + types
- [ ] Build 5 premade HTML samples under `src/lib/templates/samples/` (3 invoices + 2 pickslips), inline-styled, print-optimized, Handlebars-tokenized
- [ ] Seed script `scripts/seed-template-samples.mjs` upserts samples idempotently as `is_sample = true`
- [ ] Run the seed script and confirm 5 samples appear in Templates index
- [ ] Templates index gallery shows sample cards with thumbnail preview iframes and "Use this template" button that forks HTML into a new user template
- [ ] "Start blank" button creates a minimal stub HTML template
- [ ] "Import HTML" dialog: paste raw HTML, creates new template with that HTML
- [ ] Editor page: Monaco HTML editor (left) + live preview iframe (right) with 500ms debounce
- [ ] Editor top bar: name, type badge, Save, Set-as-default, "Preview with real order" dropdown listing last 5 orders
- [ ] Editor variables sidebar: collapsible tree of available tokens (Order/Customer/Billing/Shipping/Items/Store) with click-to-copy, plus helpers reference
- [ ] Mobile editor stacks vertically; preview becomes a sheet
- [ ] Render endpoint returns 400 with parse error details on invalid Handlebars; editor shows error in preview
- [ ] Missing variables render as empty string (silent fallback, no crash)
- [ ] Preview iframe is sandboxed
- [ ] Activity log entries: created, updated, deleted, set_default, forked_from_sample
- [ ] Quick-print buttons on orders list (task-227) continue to work — verify defaultInvoice/defaultPickslip resolution still picks the right templates after schema change

## Acceptance

- A user lands on Templates with 5 sample templates pre-seeded; clicking "Use this template" on a sample opens the HTML editor with the sample's HTML loaded
- Typing in the editor updates the live preview within 500ms with mock order data; clicking "Preview with real order" renders against actual order data
- Saving a template and clicking "Print invoice" on an order produces a correct PDF with order data filled in via Handlebars
- An invalid Handlebars syntax shows a clear error in the preview pane without crashing the editor
- All maily.to references and Tiptap node files are gone from the codebase