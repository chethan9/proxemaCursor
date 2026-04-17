---
title: Site/Store Management
status: done
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
- [x] Create storeService.ts with CRUD and connection testing
- [x] Create SitesPage with filterable data table
- [x] Create AddSiteDialog with WooCommerce credentials form (URL, consumer key/secret)
- [x] Create SiteWorkspace modal/page for individual site operations
- [x] Add site status indicators (connected, syncing, error)