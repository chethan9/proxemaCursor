---
title: API Management system with keys, logs, and swagger
status: todo
priority: high
type: feature
tags: [api, security, management]
created_by: agent
created_at: 2026-04-17
position: 15
---

## Notes
Full API management: global API Management page in sidebar + per-site API Access tab. API keys with scopes, authorized source IPs/domains, rate limiting, call logging, and embedded swagger docs. API keys are per-client (not per-site) for downstream app access.

## Checklist
- [ ] Create `api_keys` table: id, client_id, name, key_hash, key_prefix, scopes, rate_limit, allowed_origins, is_active, created_at, last_used_at, expires_at
- [ ] Create `api_call_logs` table: id, api_key_id, method, path, status_code, response_time_ms, ip_address, user_agent, created_at
- [ ] Build API key generation/revocation service
- [ ] Update API v1 middleware to validate keys, log calls, enforce rate limits and allowed origins
- [ ] Create global API Management page (/api-management) with: key list, create/revoke, usage stats, call log history with filters
- [ ] Add API Access tab to site detail page showing keys that have access to this site's client
- [ ] Add embedded Swagger/OpenAPI reference section
- [ ] Add to sidebar navigation