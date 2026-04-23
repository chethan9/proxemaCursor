---
title: Write-through mirror audit across all mutation endpoints
status: done
priority: urgent
type: chore
tags: [sync, backend, audit]
created_by: agent
created_at: 2026-04-23
position: 1
---

## Notes
Layer 1 of the "changes don't reflect" fix. Most single-entity update endpoints (products, categories, orders) already do the right thing: call Woo → update the Postgres mirror with Woo's response in the same request → return the updated row. This task is the audit pass to make sure **every** mutation endpoint follows that pattern and there are no gaps where a route writes to Woo but leaves the mirror stale (forcing the user to wait for the webhook).

The webhook at `src/pages/api/webhooks/incoming/[storeId].ts` stays as a reconciliation safety net — not removed, not bypassed. Goal is only that dashboard-initiated writes update our mirror synchronously so the UI never has to wait on the webhook roundtrip.

Endpoints to audit (under `src/pages/api/stores/[storeId]/`):
- `products/[productId].ts` (PUT) — already write-through, verify
- `products/create.ts`
- `products/[productId]/variations.ts`
- `orders/[orderId].ts` (PUT) — already write-through, verify
- `categories/[categoryId].ts` (PUT/DELETE) — already write-through, verify
- `categories/create.ts`
- `tags/[tagId].ts` (PUT/DELETE)
- `tags/create.ts`
- `customers/[customerId].ts`
- `customers/create.ts`
- `update.ts` (store update)
- `register-webhooks.ts`, `delete.ts` (store delete)

For each endpoint: Woo call happens first → on 2xx, upsert/update the mirror row using Woo's response (not the request payload) → return the fresh mirror row (or `{ success, data }`) to the client. Failed Woo calls must NOT update the mirror.

Also log `entity_changes` with `source: "dashboard"` so the UI can distinguish dashboard-originated changes from webhook reconciliations later (layer 3 depends on this).

## Checklist
- [ ] Audit every mutation endpoint under `src/pages/api/stores/[storeId]/*`, list any that write to Woo but don't update the mirror in the same request
- [ ] For each gap: call Woo first, then update Postgres mirror with Woo's response before responding to client
- [ ] Ensure every mutation endpoint returns the fresh mirror row in its response body (client uses this for optimistic reconciliation)
- [ ] Ensure every mutation writes an `entity_changes` row with `source: "dashboard"` and `status: "success"` or `"failed"`
- [ ] On Woo failure: do NOT touch the mirror; log `entity_changes` with status `"failed"` and include `retry_payload`
- [ ] Delete endpoints: remove from mirror only after Woo confirms deletion (already the pattern in `categories/[categoryId].ts`)
- [ ] Document the pattern in `docs/CODEBASE_INDEX.md` or a short `docs/MUTATION_PATTERN.md` so future endpoints follow it

## Acceptance
- Editing any product/order/category/tag/customer from the dashboard updates the mirror within the same HTTP request, before the webhook fires
- A database check immediately after a PUT returns the new value (no webhook dependency)
- Failed Woo writes leave the mirror untouched and produce a `failed` row in `entity_changes`
