# Page Conventions

Every new page or feature must follow these rules. This is the checklist for review.

## 1. Data fetching
- **ALWAYS** use a React Query hook from `src/hooks/queries/*`. Never call Supabase directly from a page/component.
- If no hook exists for your data, create one in `src/hooks/queries/<feature>.ts`.
- Query keys live in `src/lib/query-client.ts` under `queryKeys`. Add new keys there — never inline.

## 2. Loading states
- Use `isLoading` for initial skeleton/shimmer. **Never** `isFetching` — it re-triggers on background refetches and causes flicker.
- Persisted cache means first paint can be instant; shimmer only shows on first-ever load.

## 3. Paginated lists (products, orders, logs, any table)
Wire `useBackgroundPagination` in the list component:
```ts
useBackgroundPagination({
  enabled: !!storeId && totalCount > 0,
  totalCount,
  pageSize,
  currentPage: page,
  queryKeyFn: (p) => queryKeys.xxx(storeId, { ...opts, page: p, pageSize }),
  queryFn: (p) => fetchXxx({ ...opts, page: p, pageSize }),
  maxRecords: 5000,
  resetKey: `${JSON.stringify(opts)}|${pageSize}`,
});
```
- `maxRecords: 5000` — hard cap on background prefetch
- `resetKey` must include every filter/search/sort — cancels in-flight prefetch on change

## 4. Search
- Always debounce with `useDebouncedValue(search, 300)`.
- Filter server-side (Supabase `.ilike` or RPC). Never filter client-side on paginated data.
- Include debounced value in `resetKey` so pagination resets on new search.

## 5. Sidebar nav additions
When adding a nav item to a site-scoped page, add hover prefetch in `SiteSidebar.tsx` matching the destination's query key + fn. Missing this = slow tab switch.

## 6. CSV export
Use the shared helper — never roll your own:
```ts
import { exportCsv } from "@/lib/exportCsv";

exportCsv(
  filteredRows,
  [
    { key: "id", label: "ID", accessor: (r) => r.id },
    { key: "name", label: "Name", accessor: (r) => r.name },
  ],
  `products-${storeId}`
);
```
Handles escaping, UTF-8 BOM for Excel, timestamped filename.

## 7. Logs / list pages — required controls
Every logs or list page must have:
- Site filter (dropdown, scoped to user's sites)
- Status filter (enum values from schema)
- Date range (preset: 24h / 7d / 30d / custom)
- Debounced text search
- CSV export button
- Pagination with total count

## 8. File size
- Hard limit: 300 lines per file.
- If a component grows past this, split into `src/components/<feature>/` with one responsibility per file (FilterBar, Table, DetailPanel, BulkActions).
- Page files should be thin orchestrators — fetch data, compose components, pass props.

## 9. Server-only imports
- `src/integrations/supabase/admin.ts` (service role) must never be imported by a file that's reachable from a page.
- Server-only helpers go in `src/pages/api/*` or modules imported only from there.
- Pure crypto/utility helpers go in their own file (e.g. `api-token.ts`) — not mixed with server-only code.

## 10. Error observability
- Mutations: show toast on success + error.
- Long-running ops (sync, webhook register): log to DB and surface in UI with status badge.

## Quick checklist before merging a page
- [ ] Uses React Query hook (no raw Supabase in component)
- [ ] `isLoading` for shimmer
- [ ] `useDebouncedValue` on search
- [ ] `useBackgroundPagination` wired with `maxRecords: 5000` and full `resetKey`
- [ ] Query keys in `queryKeys` map
- [ ] Hover prefetch added to sidebar if applicable
- [ ] CSV export uses `exportCsv` util
- [ ] File under 300 lines; split if not
- [ ] No server-only imports leaking client-side