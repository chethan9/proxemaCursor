---
title: Standardized save feedback toasts across all mutations
status: todo
priority: high
type: chore
tags: [ux, toast, consistency]
created_by: agent
created_at: 2026-04-23T05:50:15Z
position: 4
---

## Notes
Layer 4. Today every mutation caller writes its own toast copy — some say "Product updated", some say "Saved", some say nothing. Users don't get a consistent "your change landed" signal, which compounds the confusion from layers 1-3.

Standardize via the `successToast` / `errorToast` hooks built into `useSiteMutation` (task-163). The wrapper should accept either a boolean (use defaults) or a `{ title, description }` override.

**Default copy template:**
- Success: `title: "Saved"`, `description: "[Entity name] updated on [site name]"` (e.g. "Blue T-Shirt updated on acme.com")
- Create success: `title: "Created"`, `description: "[Entity name] added to [site name]"`
- Delete success: `title: "Deleted"`, `description: "[Entity name] removed from [site name]"`
- Error: `title: "Save failed"`, `description: <server error message, humanized>`, with a retry action button when the mutation is idempotent

Site name is resolved from the store id via `useStores`/`queryKeys.store(id)` — cached, no extra fetch.

Error humanization (reuse `src/lib/sync-error.ts` patterns where applicable): map common WooCommerce error codes to plain English ("product SKU already exists", "insufficient permissions on WooCommerce API key", "store unreachable — check site URL").

Toast variants:
- Success → default variant
- Destructive/delete → default variant (not destructive — destructive is for errors)
- Error → destructive variant
- Long-running (bulk ops) → loading toast that updates in place

## Checklist
- [ ] Add default toast copy generators in `src/lib/mutation-toasts.ts` for update/create/delete × each entity type
- [ ] Wire `useSiteMutation` (task-163) to call these defaults unless overridden
- [ ] Resolve site name inside the toast via cached `queryKeys.store(id)` — no extra network calls
- [ ] Humanize common Woo error codes in `src/lib/sync-error.ts` (extend existing map); surface the human message in error toasts
- [ ] Add retry action to error toasts for idempotent mutations (updates, not creates/deletes)
- [ ] Sweep codebase: remove ad-hoc `toast({ title: "Updated" })` calls that are now handled by the wrapper
- [ ] Bulk ops (bulk edit, bulk delete) use loading toast that updates as progress streams — reuse existing `BulkJobsToast.tsx` pattern, just standardize wording

## Acceptance
- Every mutation in the app produces a consistent "Saved" / "Created" / "Deleted" toast with entity name + site name
- Error toasts show human-readable messages, not raw JSON error codes
- Retry button on error toasts re-runs the mutation for update operations
- Grep for hand-written `toast({ title: "..." })` inside mutation success/error handlers returns zero results outside `mutation-toasts.ts` and `BulkJobsToast.tsx`
