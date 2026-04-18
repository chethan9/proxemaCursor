---
title: Create menu registry from current sidebar routes
status: todo
priority: urgent
type: feature
tags: [menu-editor, foundation]
created_by: agent
created_at: 2026-04-18T11:51:00Z
position: 23
---

## Notes
Extract all routes currently hardcoded in AppSidebar.tsx into a single typed registry. This becomes the source of truth — any new page added to the app just adds one line here, and the menu editor auto-detects it.

Shape: `{ id, defaultLabel, defaultIcon (lucide name string), href, defaultGroup, defaultOrder, superAdminOnly? }`
Groups: overview, management, operations, developer, administration, system

## Checklist
- [ ] Create src/lib/menu-registry.ts with MenuRegistryItem type + MENU_REGISTRY array mirroring current AppSidebar items (Dashboard, Clients, Sites, Sync Runs, Webhooks, Activity, API, Users, Roles, Settings, etc.)
- [ ] Export helper getRegistryItem(id) and getAllRegistryIds()
- [ ] Keep icon as string (lucide name) so it can be serialized/edited; add icon resolver util resolveIcon(name) returning LucideIcon component