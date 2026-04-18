---
title: Auth foundation - roles, permissions, login, bootstrap
status: in_progress
priority: urgent
type: feature
tags: [auth, rbac, security]
created_by: agent
created_at: 2026-04-18
position: 17
---

## Notes
One user = one client (can manage multiple sites of that client). Super admin has global access.
Robust super admin protection: bootstrap page works only if no super admin exists, only super admins promote others, last super admin can't demote self.
Permissions stored as JSON array on roles table, wildcard '*' = all.
Existing data cleared per user approval.

## Checklist
- [x] Clear existing data (stores, clients, syncs, etc.)
- [x] Schema: profiles.role, profiles.client_id, profiles.is_active, roles table
- [x] Seed system roles: super_admin, admin, user with permissions
- [x] RLS helpers: is_super_admin, current_user_client_id, has_permission, can_bootstrap_super_admin, bootstrap_super_admin RPC
- [x] Profile auto-create trigger on signup
- [x] Tighten RLS on all 21 tables to role/client based
- [x] permissions.ts lib with constants and helpers
- [x] AuthProvider with user/profile/role/permissions/signOut/hasPermission/isSuperAdmin
- [x] Login page with email/password
- [x] Signup page with email verification
- [x] Forgot password page
- [x] Reset password page
- [x] Confirm email callback page
- [x] Bootstrap page (first super admin)
- [x] _app.tsx wrapping with AuthProvider