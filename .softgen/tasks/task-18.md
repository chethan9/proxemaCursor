---
title: Add user profile settings page
status: in_progress
priority: high
type: feature
tags: [settings, profile, auth]
created_by: agent
created_at: 2026-04-18
position: 18
---

## Notes
Authenticated users need a page to update their own profile (full_name, email, password). Add route at /settings/profile. Link from sidebar user menu and settings index. Use existing AuthProvider for user context and authService for updates.

## Checklist
- [ ] Fix src/integrations/supabase/types.ts barrel (auto-generator keeps wiping it)
- [ ] Create src/pages/settings/profile.tsx: form for full_name, email (with warning it triggers re-verify), password change (current + new + confirm), save buttons per section
- [ ] Update src/pages/settings/index.tsx to link to the new profile page