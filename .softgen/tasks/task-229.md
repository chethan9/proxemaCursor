---
title: Replace maily.to with HTML/Handlebars template system
status: done
priority: urgent
type: feature
tags: [templates, email, invoices, pdf]
created_by: agent
created_at: 2026-04-26
position: 229
---

## Notes
Full replacement of @maily-to block editor with HTML/Handlebars template system for invoices and pick slips. Monaco code editor with Handlebars syntax highlighting, live preview pane, sample templates users can fork and customize, version history per template.

## Checklist
- [x] Remove all @maily-to dependencies and components (WooBlocksToolbar, render-custom-nodes, lib/templates/nodes)
- [x] Install handlebars + @types/handlebars
- [x] Create lib/templates/render-html.ts with Handlebars compiler + helpers registration
- [x] Create lib/templates/helpers.ts with formatCurrency, formatDate, etc.
- [x] Create lib/templates/resolve-order.ts to prepare order data for rendering
- [x] Replace rich editor in templates/[id].tsx with Monaco HTML editor (syntax: html, formatOnPaste, formatOnType)
- [x] Adjust templates/[id].tsx live preview to render HTML via /api/templates/[id]/render
- [x] Create /api/templates/[id]/render endpoint that compiles Handlebars, resolves order data, returns HTML
- [x] Create 5 sample HTML templates in src/lib/templates/samples/ (invoice-classic, invoice-minimal, invoice-modern, pickslip-warehouse, pickslip-compact)
- [x] Create scripts/seed-template-samples.mjs to populate sample templates into templates table with is_sample flag and initial version
- [x] Update templates/index.tsx to display sample vs custom templates, fork sample workflow
- [x] Update invoiceService and downloadService to use new HTML render pipeline
- [x] Test full workflow: fork sample → customize HTML → save → generate PDF from order

## Acceptance
- Templates/[id] page shows Monaco HTML editor with Handlebars syntax
- Live preview pane updates as user types
- Sample templates appear in templates/index, forkable with one click
- Generated PDFs from bulk invoice jobs use new HTML templates
- All maily.to code removed from codebase