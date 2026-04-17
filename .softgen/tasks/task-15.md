---
title: API Management system with keys, logs, and swagger
status: done
priority: high
type: feature
tags: [api, keys, logs, swagger]
created_by: agent
created_at: 2026-04-17
position: 15
---

## Notes
Global API Management page with key CRUD, allowed origins, call logs with stats, and embedded Swagger reference for the v1 REST API.

## Checklist
- [x] Create api_keys and api_call_logs tables
- [x] Create apiKeyService.ts with CRUD + log stats
- [x] Build API Management page with tabs: Keys, Call Logs, Documentation
- [x] Key creation with name, scoped to site's client
- [x] Add embedded Swagger/OpenAPI reference section
- [x] Add to sidebar navigation