---
title: Invoices + payment history storage
status: done
priority: high
type: feature
tags: [billing, invoices, history]
created_by: agent
created_at: 2026-04-22T22:15:00Z
position: 153
---

## Notes
Every successful charge produces an invoice row. Durable record for customers' billing history, independent of gateway dashboard uptime.

**V1 shipped:** Single `invoices` table with period/status/amount/currency/gateway fields, audit trigger into activity_log, RLS (clients read own, admin writes), indexed on `(client_id, created_at)` and `(subscription_id)`.

Invoice numbering uses `INV-YYYY-NNNNNN` format generated at insert time via app layer (no DB sequence — keeps it race-free under concurrent writes via random suffix).

`invoice_attempts` child table + printable HTML view deferred until we have failed-charge retries (task 157) that actually need attempt tracking.

## Checklist
- [x] `invoices` table: id, client_id, subscription_id, invoice_number, amount_minor, discount_minor, currency, status (pending/paid/failed/refunded/void enum), period_start, period_end, gateway, gateway_invoice_ref, coupon_id, paid_at, created_at
- [x] RLS: customers see only their own client's invoices; admins see all
- [x] Audit trigger on invoices
- [x] `invoiceService` with `createInvoice`, `listInvoicesByClient`, `getInvoice`, `generateInvoiceNumber`
- [x] Verify endpoint writes paid invoice on successful checkout with period + coupon reference
- [ ] `invoice_attempts` child table — deferred until renewal cron has retry logic (task-157)
- [ ] Printable HTML invoice page — deferred (browser print-to-PDF from current /billing view adequate for v1)
- [ ] Invoice number DB sequence — deferred (app-layer generation with random suffix is race-safe)
- [ ] Billing page invoice history section — deferred to task-154 next pass

## Acceptance
- Successful checkout produces a paid invoice with amount/currency/period matching the subscription
- Coupon-discounted checkout stamps `coupon_id` on the invoice row
- RLS blocks cross-client reads (verified via non-admin user's query)
- Activity log contains an `invoices.created` entry for every insert