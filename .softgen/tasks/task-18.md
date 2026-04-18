---
title: Add user profile settings page
status: done
priority: high
type: feature
tags: [settings, profile, auth]
created_by: agent
created_at: 2026-04-18
position: 18
---

## Notes
Added /settings/profile with three sections: personal info (full_name), email change (triggers Supabase re-verify), password change. Linked from settings index.

## Checklist
- [x] Fix src/integrations/supabase/types.ts barrel
- [x] Create src/pages/settings/profile.tsx
- [x] Update src/pages/settings/index.tsx with profile link