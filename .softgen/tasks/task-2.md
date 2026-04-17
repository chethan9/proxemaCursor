---
title: Design System and Core Layout
status: todo
priority: urgent
type: feature
tags: [ui, design-system, layout]
created_by: agent
created_at: 2026-04-17
position: 2
---

## Notes
Implement the ops console design system with dark sidebar, clean content area, and professional typography. Build the shell layout that all pages will use.

## Checklist
- [ ] Update globals.css with color tokens (sidebar colors, status colors)
- [ ] Configure tailwind.config.ts with custom colors and Inter/JetBrains Mono fonts
- [ ] Create AppLayout component with collapsible dark sidebar
- [ ] Create Sidebar component with navigation (Clients, Sites, Sync Runs)
- [ ] Create StatusBadge component for sync/webhook status indicators
- [ ] Update index.tsx with dashboard overview