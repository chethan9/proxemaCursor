# HTML Template Authoring Rules

Hand this to any developer or AI generating invoice / pick-slip templates for Proxima Cursor. Follow it and PDFs will render cleanly without orphan footers, mid-row page breaks, or overflow artifacts.

---

## 1. Page geometry (non-negotiable)

```css
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body { margin: 0; }
```

- **Page size:** A4 (210mm × 297mm).
- **Margin:** 14mm on all sides → safe area is **182mm × 269mm** (~688px × 1017px at 96dpi).
- **Never** put content outside the body. No fixed/absolute positioning that escapes the flow.
- **Do not** set `body { padding }` — the `@page { margin }` already handles it.

---

## 2. Font + spacing scale

| Use | Size | Weight |
|---|---|---|
| Brand / invoice number | 18-22px | 700 |
| Section headers (Bill To, Items) | 10px uppercase tracked | 600-700 |
| Body / table cells | 11-12px | 400-500 |
| Small print (SKU, footer fine) | 9-10px | 400 |
| Grand total | 14-16px | 700 |

**Line-height:** 1.4-1.6 for body, 1.2 for headings.

**Spacing scale (use these only):** 4, 6, 8, 12, 16, 20, 24, 32px. No arbitrary values.

---

## 3. Item table — fitting rules

The items table is the only variable-height block. Plan around it.

**Row height:** keep rows at **38-48px** (12px vertical padding + 12-13px line). With image cells, 56-60px max.

**How many items fit on page 1:**
- Header + addresses + payment block + totals + footer ≈ **480-540px** of fixed chrome.
- Available for items on page 1 ≈ **480-530px**.
- **Without images:** ~10-12 rows fit on page 1.
- **With images (44×44):** ~8-9 rows fit on page 1.

**For overflow (more rows than page 1):**
```css
table.items { page-break-inside: auto; }
table.items thead { display: table-header-group; }     /* repeat header on each page */
table.items tfoot { display: table-footer-group; }
table.items tr { page-break-inside: avoid; page-break-after: auto; }
```

This makes the header repeat on page 2+ and prevents a row from splitting mid-cell.

---

## 4. Footer orphan prevention (the bug in the sample PDF)

The artifact you saw — page 2 containing only "Thank you" — happens when the footer block is pushed below the page-1 boundary.

**Rules:**

1. **Bind the footer to the totals block:**
   ```css
   .totals, .payment-block, .footer { page-break-inside: avoid; }
   .summary-row { page-break-before: avoid; }
   ```
2. **Keep cumulative chrome under 540px.** If your design needs more, drop one of: full FROM block, payment-block, or barcode footer.
3. **Never** place a standalone short element (signature line, "Thank you" banner) at the very bottom — it will orphan. Bundle it inside an `avoid` block with siblings.
4. **Test with 1 item, 5 items, 12 items, 25 items.** If any of those produces a near-empty trailing page, add `page-break-before: avoid` to the trailing block.

---

## 5. Address / column blocks

- Two columns, equal width, 24px gap.
- Each card: 14px padding, 6px radius, subtle background (`#f8fafc`) or 3px left accent border.
- Internal line spacing: 4px.
- Truncate / wrap long fields — never let an address overflow horizontally.

---

## 6. Images

- **Logo:** `max-height: 48px; max-width: 140px; object-fit: contain;`
- **Product thumbnail in items:** exactly `44px × 44px`, `object-fit: cover`, 4px radius, 1px border.
- **Never** use `width: 100%` on an image without a max — Woo image URLs can be 2000px wide and break layout calc.
- Wrap images in `{{#if image}}…{{/if}}` — missing images break alignment.

---

## 7. Numbers & currency

- All money values: use `{{currency value order.currency}}` — never raw `{{value}}`.
- Negative values (discounts): prefix with `−` (U+2212), not hyphen.
- Right-align all numeric columns.
- Use `font-variant-numeric: tabular-nums` on totals tables for alignment.

---

## 8. Conditional rendering

Hide rows/blocks when their value is zero or empty:

```handlebars
{{#if (gt totals.shipping 0)}}<tr>...</tr>{{/if}}
{{#if billing.company}}<div>{{billing.company}}</div>{{/if}}
{{#if payment.transaction_id}}<div>...</div>{{/if}}
```

Empty blocks waste vertical space and risk pushing chrome below the fold.

---

## 9. Color rules

- One brand color (default `#0f172a` slate-900) for emphasis: header bar, grand-total border, table-head background.
- Body text: `#0f172a`. Muted text: `#64748b`. Borders: `#e2e8f0`. Soft fills: `#f8fafc`, `#f1f5f9`.
- **No gradients. No drop-shadows.** They render inconsistently in headless Chrome.
- **No web fonts unless self-hosted.** Stick to the system stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.

---

## 10. Available data (see editor sidebar for full list)

Top-level keys:
- `store` — name, logo, email, phone, website, url, currency, address.{line1,line2,city,state,country,zip}
- `order` — id, number, date, date_iso, status, currency, currency_symbol, notes, total, subtotal, tax_total, shipping_total, discount_total, payment_method, payment_method_title, transaction_id
- `customer` — id, name, first_name, last_name, email, phone
- `billing` / `shipping` — name, first_name, last_name, company, address.{line1,line2}, city, state, zip, country, email, phone (billing only)
- `payment` — method, title, status, transaction_id
- `shipping_method` — name, tracking_number
- `totals` — subtotal, discount, shipping, tax, total
- `meta` — note, gift_message, delivery_date, custom_field_1/2, printed_at, template_name, template_type
- `items[]` — name, sku, quantity, qty, price, subtotal, total, image, variation_text, variation.{key} (per-attribute)

---

## 11. Helpers cheatsheet

| Helper | Example | Purpose |
|---|---|---|
| `currency` | `{{currency totals.total order.currency}}` | Format money |
| `formatCurrency` | `{{formatCurrency totals.total}}` | Alias of `currency` |
| `date` | `{{date order.date_iso "short"}}` | Format date — `short`/`long`/`iso`/`datetime`/`time` |
| `formatDate` | `{{formatDate order.date_iso}}` | Alias of `date` |
| `barcode` | `{{barcode order.number height=12}}` | Inline SVG barcode |
| `qrcode` | `{{qrcode order.number size=120}}` | Inline QR image |
| `ifCond` | `{{#ifCond order.status "completed"}}…{{/ifCond}}` | Equality block |
| `gt` / `lt` / `eq` | `{{#if (gt totals.discount 0)}}…{{/if}}` | Comparators |
| `multiply` / `add` / `subtract` / `divide` | `{{multiply price quantity}}` | Math |
| `uppercase` / `capitalize` / `titlecase` | `{{uppercase order.status}}` | Case |
| `default` | `{{default customer.phone "—"}}` | Fallback |
| `concat` | `{{concat store.url "/orders/" order.number}}` | String concat |
| `address` | `{{address billing}}` | Render full address block |

---

## 12. Pre-render checklist

Before shipping a template, verify:

- [ ] 1 item: no orphan trailing page
- [ ] 8 items: fits on page 1
- [ ] 25 items: header repeats on page 2+, no row splits, totals stay together
- [ ] Missing logo, missing phone, missing tracking — no broken layout
- [ ] Long customer name (40+ chars) — no horizontal overflow
- [ ] Discount = 0, tax = 0, shipping = 0 — those rows hide cleanly
- [ ] All currency values use the `currency` helper, not raw output
- [ ] No font weights below 400 or above 800
- [ ] No `position: absolute` or `position: fixed` outside `@page` margins
- [ ] Print preview at 100% zoom matches actual PDF output

---

## 13. CSS skeleton — copy-paste starting point

```css
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; font-size: 12px; line-height: 1.5; margin: 0; }

.header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #0f172a; margin-bottom: 20px; }
.addresses { display: flex; gap: 24px; margin-bottom: 20px; }
.address-card { flex: 1; padding: 12px 14px; background: #f8fafc; border-radius: 6px; }

table.items { width: 100%; border-collapse: collapse; margin-bottom: 16px; page-break-inside: auto; }
table.items thead { display: table-header-group; }
table.items tr { page-break-inside: avoid; }
table.items th { padding: 10px 12px; background: #0f172a; color: #fff; font-size: 10px; text-transform: uppercase; }
table.items td { padding: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }

.summary-row { display: flex; justify-content: space-between; gap: 24px; page-break-before: avoid; page-break-inside: avoid; }
.totals { width: 280px; font-variant-numeric: tabular-nums; }
.payment-block, .footer { page-break-inside: avoid; }
.footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
```

---

## 14. Hard rules summary (give this to AI prompts)

1. A4, 14mm margin, body without padding.
2. All sizes from the spacing scale: 4, 6, 8, 12, 16, 20, 24, 32px.
3. Item rows: 38-48px (or 56-60px with images).
4. Wrap totals + payment + footer in `page-break-inside: avoid`.
5. Add `page-break-before: avoid` to the totals block.
6. `<thead>` repeats: `display: table-header-group`.
7. Hide zero/empty values with `{{#if}}` blocks.
8. Money always through `{{currency value order.currency}}`.
9. System fonts only. No web fonts. No gradients. No shadows.
10. Test with 1, 8, 25 items before shipping.
