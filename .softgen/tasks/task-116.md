---
title: Auth & UI polish — 7 QA bugs
status: done
priority: high
type: bug
tags: [auth, ui, qa]
created_by: agent
created_at: 2026-04-21T12:45:00Z
position: 116
---

## Notes

All 7 QA findings fixed. Created reusable `PasswordInput` component at `src/components/ui/password-input.tsx`.

## Checklist

- [x] Fix reset-password auto-login: AuthProvider redirects to /auth/reset-password on PASSWORD_RECOVERY; page signs out after successful update
- [x] Fix signup silent success for existing email: detect empty `identities[]` and show error
- [x] Align project status filter label: "Setup Incomplete" (value `pending`)
- [x] Fix Danger Zone row alignment: input and Delete button on same baseline, helper below
- [x] Fix email-change redirect: pass `emailRedirectTo: /auth/confirm-email` to updateUser
- [x] Standardize password min length to 8 chars across signup, reset-password, profile
- [x] Add password visibility toggle (PasswordInput) to login, signup, reset-password (both), profile change-password (both)

## Acceptance

- Reset password link lands on the form; after update, user is signed out and sent to login.
- Signup with existing email shows clear error instead of "check your email".
- Project filter option reads "Setup Incomplete" matching the row badge.
- Edit Site Danger Zone input + Delete button aligned on same line.
- Email change confirmation lands on /auth/confirm-email, not login.
- All password fields have Eye/EyeOff toggle and enforce 8-char min consistently.