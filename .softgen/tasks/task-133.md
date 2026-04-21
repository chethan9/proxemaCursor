---
title: Connection Diagnostic Wizard for WAF/firewall blocks
status: todo
priority: high
type: feature
tags: [onboarding, support, reliability, ux]
created_by: agent
created_at: 2026-04-21
position: 133
---

## Notes
Customers behind Cloudflare, Sucuri, WordFence, SiteGround security, or aggressive ModSecurity rules silently fail during onboarding or first sync with 403. Support has to explain the fix every time. Instead: auto-detect what's blocking, show a copy-paste fix tailored to the service, and re-probe on demand.

Depends on task 132 — `detectBlockingService()` helper + `blocking_service` field on error context must exist first.

Touch points:
- New backend: `src/pages/api/stores/[storeId]/diagnose.ts` — lightweight probe endpoint.
- New component: `src/components/project/ConnectionDiagnostic.tsx` — banner/card with detection result + fix instructions.
- Surface in onboarding: `src/pages/sites/connect/[id].tsx` when OAuth polling times out or credentials save succeeds but first probe fails.
- Surface on site detail: site home and/or site settings at `src/pages/sites/[id]/home.tsx` / `src/pages/sites/[id]/settings.tsx` when the last sync run has `blocking_service` set.
- Surface on sync runs page: `src/pages/sync-runs/index.tsx` — when an error row was WAF-classified, show "Diagnose" button jumping to the wizard.

## Checklist
- [ ] Backend: diagnose endpoint performs three probes — (1) GET to store root URL, (2) GET to `/wp-json/`, (3) authenticated GET to `/wp-json/wc/v3/system_status?per_page=1`. For each probe record status, blocking_service detection, response time, first 300 chars of body. Return a structured report: overall status (ok | auth_failed | blocked | unreachable), per-probe results, detected service, and a `fix_instructions` block keyed by service.
- [ ] Copy-paste fix library for Cloudflare (Custom WAF rule skipping managed rules + Bot Fight Mode on `/wp-json/*`), Sucuri (IP allowlist via Firewall dashboard), WordFence (Tools → Allowlisted URLs + IPs), AWS WAF (exception rule for path), ModSecurity/cPanel (disable specific rule IDs or allowlist). Each entry: title, step-by-step numbered instructions, one-click "copy rule expression" where applicable (e.g. CF expression string).
- [ ] ConnectionDiagnostic component: collapsible card showing the three-probe result with green/amber/red status icons, the detected blocking service name + logo/icon, the fix instructions, a "Copy fix for site admin" button that copies a ready-to-paste message the user can forward, and a "Run test again" button that re-hits the diagnose endpoint.
- [ ] Onboarding flow integration: if first sync or probe fails during connect, show the diagnostic card inline on the connect page instead of a generic "failed" message. Offer "I've fixed it — retry" and "Skip for now".
- [ ] Site detail integration: when last sync run has `blocking_service != null`, show a dismissable diagnostic banner at the top of site home and site settings. Auto-clears once a subsequent sync succeeds.
- [ ] Sync runs page: next to WAF-classified failed runs, show a small "Blocked by Cloudflare" chip and a "Diagnose" button that opens the wizard in a dialog.
- [ ] Include guidance for "unknown" case: when no known signature matches but response is 403 — show generic troubleshooting (check hosting security plugins, check server logs, provide your outbound IPs list, provide User-Agent string to allowlist).
- [ ] Security / rate limiting: the diagnose endpoint makes real outbound requests, so require auth (user must have access to the store) and rate-limit to ~1 probe per store per 30 seconds.

## Acceptance
- On a Cloudflare-protected store where sync currently fails, the user sees a card saying "Cloudflare Managed Challenge is blocking our app" with the exact Custom Rule expression and instructions their hosting admin needs.
- The "Copy fix for site admin" button copies a plain-text message the user can paste into email/Slack to hand off the fix.
- After the site admin applies the fix, clicking "Run test again" shows green checks across all three probes and clears the banner.
- The wizard appears in three places: onboarding (connect page), site detail banner, and sync runs page chip — with consistent content.
- Unknown/unclassified 403s still surface a generic troubleshooting card instead of a silent failure.