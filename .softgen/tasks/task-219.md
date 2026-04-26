---
title: Visual templates builder — three-pane editor with drag-drop
status: in_progress
priority: high
type: feature
tags: [templates, builder, editor, dnd]
created_by: agent
created_at: 2026-04-26T13:05:00Z
position: 219
---

## Notes
Depends on task-218 (foundation must exist). Builds the three-pane editor: elements library left, drag-drop canvas middle, live preview right. Reference design: clean white panels, faint borders, dashed drop-zones with floating "+" button when hovered, blocks selectable on click with property inspector replacing the elements panel temporarily.

Tech: `@dnd-kit/core` + `@dnd-kit/sortable` for drag-drop (already React 18 compatible, lightweight, accessible). No GrapesJS, no iframe-based editors.

Top bar: back arrow, template name + type badge (Invoice / Pick Slip), inline-rename pencil, draft/published status pill, undo/redo buttons, "Save Template" (saves new version), "Save & Close" with split dropdown for "Save as Sample" (admin only). Auto-save indicator shows last-saved timestamp.

Left panel — Elements tab: Basic group (Text, Heading, Image, Divider, Spacer, Columns, HTML) and Blocks tab: composite WooCommerce blocks per template type — for invoice: Store Header, Customer Info, Billing Address, Shipping Address, Order Items Table, Totals, Payment Info, Footer Note. For pickslip: Store Header, Order Barcode, Shipping Label, Items Table (no prices), Notes Box, Signature Line. Each element is a draggable card with icon + label.

Middle panel — Canvas: A4-proportioned page (for PDF templates) with configurable margins shown as dashed inset. Device toggle in toolbar (Desktop/Tablet/Mobile preview widths). Drop zones between blocks shown as thin dashed lines that thicken to "Drag element or block here" + center "+" when dragging or hovering. Click block to select (blue outline + drag handle + duplicate + delete handles). Drag handle on left edge of selected block. Inline editing for text blocks (contentEditable). Variable insertion via "{{" trigger showing autocomplete dropdown of catalog variables for that template type.

Right panel — Preview: same block tree rendered with sample data (fixtures from task-218). Device toggles (desktop/tablet/mobile) for preview width. Light/dark mode toggle (preview-only, not applied to PDF). Live updates as user edits. "Send Test" button stubbed (greyed with tooltip "Email sending coming soon" — wired in future task).

Property Inspector: when a block is selected, left panel switches from Elements/Blocks to a properties form for that block — text alignment, font size, color, padding, image src (upload or pick from media), columns count, table column visibility toggles for order_items_table, totals row visibility toggles for totals_block, etc. Back arrow returns to Elements/Blocks library.

Undo/redo: keep history stack of document states (cap at 50 entries). Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z keyboard shortcuts.

Save behavior: "Save Template" creates a new row in template_versions, updates templates.current_version_id. Auto-save fires 2s after last edit if dirty, also saves a version (silently). Show "Saved 12s ago" timestamp.

Discard guard: leaving the page with unsaved changes shows confirm dialog (use existing useUnsavedChangesGuard hook).

## Checklist
- [ ] Three-pane layout: left (260px), middle (flex, with A4 canvas centered + device toolbar), right (380px) — collapsible panels, full-height, white panels with subtle borders
- [ ] Elements tab in left panel: 7 basic elements (Text, Heading, Image, Divider, Spacer, Columns, HTML) as draggable icon cards in a 3-column grid
- [ ] Blocks tab in left panel: type-specific composite blocks (8 for invoice, 6 for pickslip) as draggable cards
- [ ] Drag-drop canvas with sortable block list, dashed drop zones between blocks that show "Drag element or block here" + "+" on hover/drag, blue outline + drag/duplicate/delete handles when selected
- [ ] Inline text editing with variable autocomplete on "{{" trigger, dropdown shows variable path + sample value, Escape to cancel
- [ ] Property inspector replaces elements/blocks panel when block selected: per-block-type form (text style, image src, table column toggles, totals row toggles, columns count) with back arrow to return to library
- [ ] Live preview right panel: renders block tree with sample data fixtures, desktop/tablet/mobile width toggle, light/dark mode toggle (preview only), updates within 200ms of edits
- [ ] Top bar: back to templates list, inline-rename template name, type badge, undo/redo, auto-save timestamp, "Save Template" button, "Save & Close" with admin-only "Save as Sample" split option
- [ ] Undo/redo stack (50 entries) with Cmd+Z / Cmd+Shift+Z keyboard shortcuts
- [ ] Auto-save 2s debounced after edits, leaves-page guard on unsaved changes
- [ ] "Send Test" button stubbed with tooltip "Email sending coming soon" — visible but disabled

## Acceptance
- Dragging an Image element from left panel onto canvas adds an image block at the drop position
- Clicking a text block lets the user type inline; typing "{{" shows a dropdown of available variables
- Selecting a block shows its properties on the left; deselecting (click empty canvas) returns to the elements library
- Right preview reflects every edit within 200ms with the seeded sample order data
- Reloading the page after an auto-save restores the latest document state