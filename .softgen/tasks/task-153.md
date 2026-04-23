---
title: Invoices + payment history storage
status: in_progress
priority: high
type: feature
tags: [billing, invoices, history]
created_by: agent
created_at: 2026-04-22T22:15:00Z
position: 153
---

## Notes
Every charge (success or failure) gets an `invoices` row. This is the durable record customers see in their billing history, even if the gateway's dashboard is down or they change gateways later.

**Currency is frozen at invoice creation** — if a client's account currency changes mid-subscription, existing unpaid invoices keep their original currency until the next renewal cycle. Prevents mid-cycle pricing confusion.

**`gateway_invoice_id` format differs per gateway** — MyFatoorah uses numeric `InvoiceId`, Razorpay uses alphanumeric `order_id` like `order_XYZ123`. Store as text, no parsing assumptions.

**Invoice vs charge:** one invoice per billing period, may have multiple charge attempts (initial + retries). Track attempts in `invoice_attempts` child table.

**Line items:** stored as jsonb array. Seed with: plan charge (base), coupon adjustment (negative), tax (if applicable). Keeps future extensibility (add-ons, overage) without schema changes.

**Printable view:** server-rendered HTML at `/billing/invoices/[id]/print` with browser print-to-PDF. No PDF library dependency for v1.

## Checklist
- [ ] `invoices` table: id, client_id, subscription_id, number (human, e.g. INV-000042), issued_at, period_start, period_end, subtotal_cents, discount_cents, tax_cents, total_cents, currency, status (draft/open/paid/void/uncollectible), paid_at, gateway_invoice_id, coupon_id, line_items (jsonb), created_at
- [ ] `invoice_attempts` table: id, invoice_id, attempted_at, success (bool), gateway_response (jsonb), failure_reason, created_at
- [ ] Invoice number sequence: per-year (INV-2026-000042), auto-generated via db function
- [ ] Invoices created: on checkout verify success, on renewal cron run (before charge attempt)
- [ ] Printable invoice page: company branding header, customer info, line items table, totals, status stamp, "Paid in full" watermark if paid
- [ ] RLS: customers see only their own client's invoices; admins see all
- [ ] Activity log entry on every invoice creation + status change

## Acceptance
- Successful checkout produces a paid invoice with single paid line item
- Printing an invoice produces a clean one-page layout ready for PDF export via browser print
- Admin voiding an invoice records the action in activity_log with reason