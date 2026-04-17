---
title: Build public REST API with token authentication for Flutter app
status: todo
priority: high
type: feature
tags: [api, auth, security]
created_by: agent
created_at: 2026-04-17T21:50:00Z
position: 10
---

## Notes
Flutter app needs secure REST API to read synced data from WooSync backend (not from WordPress directly - that's the whole point of WooSync).

Security model:
- Each client gets one or more API tokens (created in client detail page)
- Token scope defines what the token can read (all sites for that client, or specific sites)
- Tokens passed as `Authorization: Bearer <token>` header
- Every API call validates token, checks it's not revoked/expired, updates last_used_at
- Token can only access data for sites belonging to its client_id (isolation)

API base path: `/api/v1/` (versioned for future compatibility)

All endpoints return JSON with consistent shape: `{ data, meta: { total, page, per_page }, error? }`

Pagination via `?page=1&per_page=50` query params, max 200 per_page.

## Checklist
- [ ] Create `src/lib/api-auth.ts` - `validateApiToken(req)` middleware: reads Bearer token, queries api_tokens, checks revoked/expired, returns { client_id, scopes } or throws 401
- [ ] Create `src/services/apiTokenService.ts` - createToken, listTokens, revokeToken, rotateToken functions
- [ ] Create API v1 endpoints (all require token auth, all scoped to token's client):
  - [ ] GET `/api/v1/sites` - list sites for token's client
  - [ ] GET `/api/v1/sites/[id]` - single site with health + counts
  - [ ] GET `/api/v1/sites/[id]/products` - paginated products + search query param
  - [ ] GET `/api/v1/sites/[id]/products/[productId]` - single product with full raw_data
  - [ ] GET `/api/v1/sites/[id]/orders` - paginated orders + status filter
  - [ ] GET `/api/v1/sites/[id]/orders/[orderId]` - single order
  - [ ] GET `/api/v1/sites/[id]/customers` - paginated customers
  - [ ] GET `/api/v1/sites/[id]/customers/[customerId]` - single customer
  - [ ] GET `/api/v1/sites/[id]/categories` - all categories (usually small)
  - [ ] GET `/api/v1/sites/[id]/tags` - all tags
  - [ ] GET `/api/v1/sites/[id]/coupons` - all coupons
  - [ ] GET `/api/v1/sites/[id]/sync-status` - latest sync_run per aspect + overall health
- [ ] Add rate limiting: track requests per token per minute in a simple in-memory Map, return 429 after 100 req/min
- [ ] Create API tokens UI in client detail page (new page src/pages/clients/[id].tsx if not exists) - list, create (show token once), revoke
- [ ] Create `/api/v1/docs` page or static markdown showing endpoint list + auth example for Flutter devs
- [ ] Add request logging middleware that stores in new `api_request_logs` table (optional, flag via env var)
