---
title: Move store creation to admin-client API route
status: todo
priority: urgent
type: bug
tags: [api, supabase, stores, rls]
created_by: agent
created_at: 2026-04-18T03:50:00Z
position: 19
---

## Notes
The "Add Site" dialog hangs on "Creating..." indefinitely. Root cause: `createStore()` in `src/services/storeService.ts` runs the INSERT through the browser Supabase client, which is subject to RLS evaluation against the user's JWT. Direct SQL insert works instantly, proving the DB/RLS is fine in isolation — the hang is in the browser client's request.

The rest of the API layer already migrated to the admin client (commits `aba0351`, `2e1e8b6`). Store creation is the last client-side write holdout. Moving it to an API route with the admin Supabase client will eliminate the hang and make behavior consistent with the rest of the system.

Flow after fix:
1. User submits "Add Site" form → browser POSTs to `POST /api/stores/create`
2. API route validates the session (get user from auth header), checks permissions, inserts via admin client, returns the new store row
3. Browser uses returned row to proceed with OAuth redirect OR manual-key sync trigger

Keep auth: API route must require a logged-in user and respect super_admin / client-scoped access (mirror `is_super_admin()` / `current_user_client_id()` logic in JS).

## Checklist
- [ ] Create `src/pages/api/stores/create.ts`: POST handler, validate Supabase session from auth cookie/header, check user is active + (super_admin OR client_id matches body.client_id), insert via admin client, return `{ store }`
- [ ] Update `src/services/storeService.ts` `createStore()`: replace direct Supabase insert with `fetch("/api/stores/create", { method: "POST", headers: { Authorization: Bearer ${session.access_token} }, body: JSON.stringify(input) })`, throw on non-2xx
- [ ] Verify `src/pages/sites/index.tsx` `handleCreateStore` still works end-to-end: OAuth mode redirects to WooCommerce, manual mode closes dialog and triggers initial sync
- [ ] Test in browser: add site via OAuth — dialog should close / redirect within 1-2s, no more "Creating..." hang
- [ ] Test in browser: add site via Manual Keys — dialog closes, store appears in table, sync triggers
