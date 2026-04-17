---
title: Site/Store Management
status: todo
priority: high
type: feature
tags: [sites, stores, onboarding]
created_by: agent
created_at: 2026-04-17
position: 4
---

## Notes
Store listing, filtering, and onboarding flow. Stores connect to WooCommerce via API keys.

## Checklist
- [ ] Create storeService.ts with CRUD and connection testing
- [ ] Create SitesPage with filterable data table
- [ ] Create AddSiteDialog with WooCommerce credentials form (URL, consumer key/secret)
- [ ] Create SiteWorkspace modal/page for individual site operations
- [ ] Add site status indicators (connected, syncing, error)