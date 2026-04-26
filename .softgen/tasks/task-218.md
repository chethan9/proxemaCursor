---
title: Templates foundation — schema, document model, sample templates, list page
status: done
priority: high
type: feature
tags: [templates, foundation, schema]
created_by: agent
created_at: 2026-04-26T13:00:00Z
position: 218
---

## Notes
First of 4 tasks for the visual templates builder. This task lays the foundation: data model, block-tree TypeScript types, variable catalog system, sample (admin-provided) templates, and the templates list page. Builder UI, PDF rendering, and production wiring come in tasks 219-221.

Document storage strategy: each template stores a versioned JSON block tree (NOT HTML). Renderers transform that tree into HTML / PDF / etc at output time. This gives one template → many outputs, easy theme swaps, and supports future template types (email, report) without schema changes.

Ownership model: admin-owned sample templates (`is_sample = true`, `client_id NULL`) visible to every client. Client-owned templates (`client_id` set) visible only to that client. When a client "uses" a sample, options: (a) reference it directly (read-only), or (b) fork — clone the document into a new client-owned template they can edit.

Tables to create:
- `templates` — id, client_id (nullable for samples), is_sample, name, description, type (`invoice` | `pickslip` — extensible enum), is_default_for_type, current_version_id, created_at, updated_at, created_by
- `template_versions` — id, template_id, version_number, document (jsonb block tree), styles (jsonb — colors, fonts, spacing), created_at, created_by, change_note
- `template_renders` — id, template_id, version_id, entity_type (`order` | `order_pickslip`), entity_id, output_format (`pdf`), output_url (or storage path), rendered_at, rendered_by

RLS: clients see samples (`is_sample = true`) + their own templates. Only admins can create/edit samples.

Variable catalog (per type, in code not DB): invoice exposes `store.{name,address,logo,email,phone}`, `order.{number,date,status,currency}`, `order.customer.{name,email,phone}`, `order.billing.{first_name,last_name,address_1,address_2,city,state,postcode,country}`, `order.shipping.*` same shape, `order.items[].{name,sku,quantity,price,total,image}`, `order.totals.{subtotal,shipping,tax,discount,total}`, `order.payment.{method,transaction_id}`, `order.notes`. Pick-slip catalog is a subset focused on fulfillment: store, order.number, order.shipping.*, items (no prices), order.notes, customer phone, barcode for order number.

Block types (TypeScript discriminated union): `text` (rich text with variable mentions), `heading`, `image` (src or `{{store.logo}}`), `divider`, `spacer`, `columns` (2-3 column grid), `address_block` (preset for billing/shipping), `order_items_table` (composite block — renders rows from `order.items[]` with configurable columns), `totals_block` (configurable rows: subtotal/shipping/tax/discount/total), `barcode` (pickslip only — renders order number as Code128), `qr_code` (encodes URL or order number), `signature_line`, `html` (raw HTML escape hatch), `page_break` (PDF only).

Three sample templates per type seeded via migration:
- **Invoice samples:** "Classic" (centered logo, two-column billing/shipping, line items table, right-aligned totals, footer with store contact), "Modern" (left-aligned bold logo, accent color band, condensed table, large total emphasis), "Minimal" (no logo image — store name as text, no color, monospace numbers, single thin divider)
- **Pick-slip samples:** "Standard Warehouse" (large order number + barcode at top, shipping address prominent, items table with SKU/qty/location, signature line at bottom), "Compact" (header strip with order# + date + barcode, dense items list, no signature), "Detailed" (order# + barcode, customer phone, shipping address, items with thumbnails + SKU + qty + bin location, notes box, signature + print date)

Templates list page accessible to all users, grouped by type. Each card shows name, type badge, sample/custom badge, last edited, "Use" button (samples) or "Edit" button (custom). "+ New template" CTA → type picker (invoice/pickslip) → blank canvas (handled in task-219).

## Checklist
- [ ] Database tables: templates, template_versions, template_renders with RLS (samples visible to all authed users, custom scoped to client) and FKs
- [ ] Seed migration creating 3 invoice samples + 3 pickslip samples (Classic/Modern/Minimal, Standard/Compact/Detailed) with full block-tree documents
- [ ] TypeScript block document model — discriminated union for all 14 block types listed above, document root schema, version metadata
- [ ] Variable catalog registry — typed per template type, used for autocomplete + render-time interpolation, includes invoice + pickslip catalogs with all fields above
- [ ] Service layer: list templates (filtered by type + client), get template + current version, create template (blank or fork from sample), update document (creates new version), delete custom template, set as default for type
- [ ] Templates list page: tabs for Invoice / Pick Slip, grid of cards, sample badge vs custom badge, "Set as default" toggle for client's chosen template per type, search by name, "+ New template" CTA opening type picker
- [ ] Empty state when client has no custom templates yet — shows "Start from a sample" with the 3 samples for the active type
- [ ] Fork-from-sample flow: clicking "Customize" on a sample creates a client-owned copy with name "Copy of [sample name]" and navigates to the builder

## Acceptance
- Admin samples are visible to every client, read-only, cannot be deleted or renamed by clients
- A client can fork any sample into their own editable copy without affecting the original
- Custom templates created by client A are not visible to client B
- Templates list shows both invoice and pickslip types in clear tabs with the 3 seeded samples per type
