---
title: Page conventions doc + shared CSV export util
status: done
priority: urgent
type: chore
tags: [standards, docs]
created_by: agent
created_at: 2026-04-18
position: 40
---

## Notes
Create a single source-of-truth document every new page/feature must follow, so caching + prefetch + pagination + search + export are consistent. Also extract a reusable CSV export helper.

Doc location: `docs/PAGE_CONVENTIONS.md` (repo root `docs/` folder). Keep concise, checklist-style.

Must cover:
- Data fetching ONLY via `src/hooks/queries/*` (never raw Supabase in components)
- Paginated lists MUST wire `useBackgroundPagination` with maxRecords 5000, resetKey on filter change
- Use `isLoading` (not `isFetching`) for shimmer
- Debounced search with 300ms via `useDebouncedValue`
- Query keys centralized in `src/lib/query-client.ts` `queryKeys`
- Hover prefetch on sidebar nav additions
- File size limit 300 lines; split into `components/<feature>/` if exceeded
- Server-only imports (admin client, service role) never in files imported by pages
- CSV export via shared `src/lib/exportCsv.ts`
- Logs/list pages must have: status filter + site filter + date range + CSV export

Shared util: `src/lib/exportCsv.ts` — takes array of objects + column map, triggers browser download. Handles escaping, BOM for Excel.

## Checklist
- [x] Create docs/PAGE_CONVENTIONS.md with the full checklist above
- [x] Create src/lib/exportCsv.ts: exportCsv(rows, columns, filename) with proper escaping, UTF-8 BOM, timestamped filename fallback
- [x] Add example usage snippet to doc referencing exportCsv