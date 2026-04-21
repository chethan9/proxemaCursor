---
title: Prevent duplicate site creation on slow networks
status: done
priority: high
type: bug
tags: [onboarding, race-condition]
created_by: agent
created_at: 2026-04-21T06:50:00Z
position: 111
---

## Notes
On slow networks, clicking "Connect Store" multiple times in the Add Site dialog creates multiple store rows because the button stays enabled during the async create + OAuth redirect window. Need to guard against double-submit.

Target file: `src/components/project/AddSiteDialog.tsx` (handleCreate, footer buttons).

Approach:
- Add a ref-based submit lock (survives re-renders, blocks reentry before React state updates).
- Keep button disabled for the entire create + redirect window (currently `creating` is reset in `finally`, but during OAuth the redirect is in-flight — keep it disabled until navigation).
- Update button label: "Redirecting..." during OAuth redirect window, "Creating..." during manual create.
- Also disable Cancel button while creating to prevent dialog close mid-request.
- Release the lock only on error (so user can retry); on success the page navigates away or dialog closes.

## Checklist
- [ ] Connect Store button cannot be triggered twice — second click is a no-op until first request resolves
- [ ] Button shows clear in-flight state ("Creating..." / "Redirecting...") matching the selected auth mode
- [ ] Cancel button disabled during submission so users can't close mid-request
- [ ] On error, lock releases and user can retry without reopening dialog
- [ ] Only one `stores` row is created per successful click, even on slow connections

## Acceptance
- Spam-clicking Connect Store on a throttled connection results in exactly one store row in the database.
- Button visibly shows a loading/redirecting state until navigation occurs.