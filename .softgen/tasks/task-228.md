---
title: Replace template builder with EmailBuilder.js + Puppeteer PDF
status: todo
priority: high
type: feature
tags: [templates, refactor, pdf, editor]
created_by: agent
created_at: 2026-04-26
position: 228
---

## Notes

The custom template builder (`src/components/template-builder/*`, `src/lib/templates/render-pdf.tsx`) is buggy and unmaintainable — every block, prop, drag interaction, and PDF mapping is hand-rolled. Replace with **EmailBuilder.js** (Waypoint, MIT — https://github.com/usewaypoint/email-builder-js) and switch the print path to **Puppeteer HTML→PDF**.

User decision: **wipe all existing templates** (samples + any user-created). They will author fresh sample templates from inside the new editor after this lands. No migration script needed.

**Why EmailBuilder.js**
- Block-based editor with built-in Text, Heading, Image, Columns, Container, Divider, Spacer, Button, HTML — already production-quality, drag/select/inspector all work.
- JSON-first config; HTML render is a single function call (`renderToStaticMarkup`).
- Pluggable block registry — we add domain blocks (OrderItemsTable, TotalsBlock, AddressBlock, Barcode, QrCode, SignatureLine, PageBreak) as our own block packages.
- MIT licensed; we self-host the editor inside the existing `/templates/[id]` page.

**Why Puppeteer for PDF**
- `@react-pdf/renderer` is the bottleneck — limited CSS, no web fonts, no real barcode/QR images, hand-mapped per-block. Replace with Puppeteer (`puppeteer-core` + `@sparticuz/chromium` for Vercel) that renders the EmailBuilder.js HTML to PDF with pixel parity.
- Cold start ~1s on Vercel; warm <300ms — acceptable for print.

**Architecture**
- Editor route (`/templates/[id]`): replace canvas + inspector + element panel with EmailBuilder.js `<EditorContent />` + `<Sidebar />`. Wire into existing top bar (Save / Rename / type badge).
- Document schema: `templates.document` JSONB now stores EmailBuilder.js config (`{ root, blocks }`). Bump `templates.schema_version` to 2.
- Custom block registry: new dir `src/lib/templates/email-builder/blocks/` with one file per domain block (OrderItemsTable, Totals, Address, Barcode, QrCode, SignatureLine, PageBreak). Each exports `{ Editor, Reader, schema }` — Editor is the inspector form, Reader is the rendered output.
- Variable interpolation: keep current `{{order.x}}` syntax; pre-process JSON before render by walking string fields and replacing tokens via existing `interpolate()` helper.
- Render pipeline: new `src/lib/templates/render-html.ts` (uses EmailBuilder.js `renderToStaticMarkup`) replaces both old renderers. New `src/lib/templates/render-pdf.ts` boots Puppeteer, navigates to a data URL with the HTML, calls `page.pdf()`, returns Buffer.
- Print API (`/api/templates/[id]/render`): unchanged signature, internally swaps to new pipeline.

**Wipe step**
- Single SQL migration: `TRUNCATE template_versions, templates RESTART IDENTITY CASCADE;` (or `DELETE FROM templates;` if FKs are RESTRICT). Removes all sample + user-created templates from production. User has confirmed.
- Delete old builder code (`src/components/template-builder/*`, old `render-pdf.tsx`, `block-defaults.ts`, old `sample-data.ts`) once new editor is wired.
- After deploy, user opens `/templates` → `New template` → builds fresh samples in the new editor and marks them as defaults. Onboarding now starts from zero templates and prompts the user to create one.

**Bundle / performance**
- EmailBuilder.js depends on MUI (~150KB gzipped). Lazy-load the editor with `next/dynamic({ ssr: false })` so only `/templates/[id]` pulls it in. App shell + templates index stay light.
- Puppeteer adds ~50MB to the serverless bundle. Use `@sparticuz/chromium` (~50MB compressed). Verify cold-start within Vercel function size limits before merging.

**Custom domain blocks — initial set**
- `OrderItemsTable` — line items with toggleable Image / SKU / Qty / Price / Total / Bin columns, header bg color, zebra striping.
- `TotalsBlock` — subtotal/shipping/tax/discount/total rows, currency-aware, "emphasize total" toggle.
- `AddressBlock` — billing or shipping, toggleable name/company/phone/email, label.
- `Barcode` — code128 / EAN-13, source = order_number or custom, real SVG via `bwip-js`.
- `QrCode` — value (with token interpolation), size, real PNG via `qrcode` lib.
- `SignatureLine` — label, width %.
- `PageBreak` — forces new page in PDF (CSS `page-break-after: always`).

**UX after wipe**
- Templates index shows empty state with "Create your first template" CTA pointing to the new builder.
- Order detail / orders-list quick-print actions hide "Print invoice" / "Print pickslip" until a default of that type exists; show a one-line nudge "No invoice template yet — create one in Templates".
- Site Configuration → Default templates card shows empty selectors with the same nudge.

**Open questions to resolve in build session**
- MUI theme inside the editor — match shadcn neutral palette via MUI theme override so the editor doesn't visually clash. Acceptable as long as it's only on the editor route.
- Live preview pane — EmailBuilder.js has `<Reader />` for that; keep our existing right-side preview using it.

## Checklist

- [ ] Install `@usewaypoint/email-builder` and dependencies (peer: MUI, emotion).
- [ ] Install `puppeteer-core` + `@sparticuz/chromium` for serverless PDF rendering.
- [ ] Install `bwip-js` (barcode) and `qrcode` (QR) for image generation in custom blocks.
- [ ] Add `templates.schema_version` column (default 2) and document v2 schema in `docs/templates-module.sql`.
- [ ] SQL migration: wipe all rows from `template_versions` and `templates` (CASCADE). Confirms with comment "user-approved wipe — fresh start".
- [ ] Replace `/templates/[id]` editor surface with EmailBuilder.js `<EditorBlock />` + `<Sidebar />` lazy-loaded; keep existing top bar (save / rename / type badge / dirty indicator).
- [ ] Custom domain block: OrderItemsTable — Editor inspector for column toggles + header color; Reader emits HTML table with zebra striping and currency-formatted cells.
- [ ] Custom domain block: TotalsBlock — Editor toggles for subtotal/shipping/tax/discount/total + emphasize; Reader emits right-aligned totals table.
- [ ] Custom domain block: AddressBlock — Editor source toggle (billing/shipping) + field toggles + label; Reader emits formatted address.
- [ ] Custom domain block: Barcode — Editor source/value/format/size; Reader emits inline SVG via `bwip-js`.
- [ ] Custom domain block: QrCode — Editor value/size; Reader emits inline PNG data-URI via `qrcode`.
- [ ] Custom domain block: SignatureLine — Editor label/width; Reader emits styled signature line.
- [ ] Custom domain block: PageBreak — Editor (no props); Reader emits `<div style="page-break-after: always">`.
- [ ] Variable interpolation pass walks the EmailBuilder.js config and resolves `{{order.x}}` tokens against order/customer/store/branding data before render.
- [ ] New `src/lib/templates/render-html.ts` calls EmailBuilder.js `renderToStaticMarkup` with interpolated config.
- [ ] New `src/lib/templates/render-pdf.ts` boots Puppeteer + Chromium, sets HTML, runs `page.pdf({ format, printBackground: true })`, returns Buffer.
- [ ] `/api/templates/[id]/render` swaps to new pipeline; preserves all existing query params (`format`, `store_id`, `order_id`, `download`).
- [ ] Templates index empty state: "No templates yet — create your first one" with CTA to `/templates/[id]?type=invoice` and `?type=pickslip`.
- [ ] Order quick-print actions and Default Templates selectors gracefully handle the empty state with a "create one" nudge instead of crashing.
- [ ] Lazy-load editor with `next/dynamic({ ssr: false })` to keep app shell light.
- [ ] MUI theme override matches shadcn neutral palette so the editor doesn't visually clash.
- [ ] Verify Vercel function bundle is under 250MB after Chromium addition; document in `docs/DEPLOYMENT.md`.
- [ ] Delete old builder files (`src/components/template-builder/*`, old `render-pdf.tsx`, `block-defaults.ts`, `sample-data.ts` if unused) after cut-over.
- [ ] Smoke test: create a fresh template, save, render PDF for a real order, verify barcode + QR + totals + address render correctly.
- [ ] Add `KNOWN_TRAPS.md` entry: "Puppeteer cold start on Vercel — first render after idle ~1s; warm in subsequent calls."

## Acceptance

- Opening the templates page after deploy shows zero templates and an empty-state CTA — no broken samples lingering.
- Creating a new template loads the EmailBuilder.js editor with the seven custom domain blocks available alongside built-ins.
- Saving and re-opening a template restores the exact same layout (no data loss).
- Rendering an invoice for a real order produces a PDF that matches the on-screen preview, with working order items table, totals, address, barcode, and QR.
- The editor route is the only place MUI is loaded; the rest of the app's bundle is unchanged.

