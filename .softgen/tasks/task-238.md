---
title: Fix JSX parse error in ProductsTab grid card render
status: todo
priority: urgent
type: bug
tags: [products, regression]
created_by: agent
created_at: 2026-04-26T23:50:00Z
position: 238
---

## Notes

Last grid-card relative-positioning patch in `src/components/explore/ProductsTab.tsx` left the table-render block with unbalanced JSX. Compile error reported:

```
./src/components/explore/ProductsTab.tsx
1240:28  Error: Parsing error: Expected corresponding JSX closing tag for 'TableRow'.
```

The error region is the bottom of the `viewMode === "table"` table body — the `<TableRow>` opened with `onClick={() => setExpandedRowId(...)}` is closed with `</TableCell>` instead of `</TableRow>`, and the outer `<Table>` appears twice (`</Table>` repeated).

The grid view itself (the surface the relative-positioning fix targeted) is rendering — the parse error is purely in the table-view sibling block.

**Surgical fix:**
1. Find the closing of the row mapped over `products.map((p) => { ... return (<React.Fragment><TableRow>...children...`. The final close should be `</TableRow></React.Fragment>` not `</TableCell></React.Fragment>`.
2. Confirm only one `</Table>` at the end of the `<div className="overflow-x-auto ...">` wrapper.
3. Run `next lint` (or build) to confirm no remaining JSX errors.

Do NOT refactor the file structure beyond fixing the malformed close tags — `ProductsTab.tsx` is 1252 lines and other tasks (task-220 onwards) plan its split.

## Checklist

- [ ] Open `src/components/explore/ProductsTab.tsx` and locate the table-view product row render (`products.map((p) => { ... return (<React.Fragment key={p.id}><TableRow ...>`).
- [ ] Replace the trailing `</TableCell>` with `</TableRow>` so each row closes correctly inside the fragment.
- [ ] Remove the duplicate `</Table>` close at the end of the `<div className="overflow-x-auto ...">` wrapper, leaving exactly one.
- [ ] Verify the file compiles clean with `npx next lint --quiet` showing no JSX errors.
- [ ] Sanity-check both views render: `viewMode = "table"` shows rows, `viewMode = "grid"` still shows cards with per-card hover checkbox.

## Acceptance

- `next lint` / build passes with no JSX parse errors in `ProductsTab.tsx`.
- Switching between table and grid views in /explore works as before.