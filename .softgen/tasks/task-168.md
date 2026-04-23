---
title: Parallelize webhook registration with WordPress media auth in connect flow
status: done
priority: high
type: feature
tags: [onboarding, ux, connect-flow]
created_by: agent
created_at: 2026-04-23
position: 1
---

## Notes
Today's connect flow (`src/pages/sites/connect/[id].tsx`) is strictly sequential:
1. Authorizing with WooCommerce
2. Receiving API credentials
3. Authorize WordPress media access (user leaves to WP, approves, returns)
4. Registering webhooks (kicks off only after step 3 completes/skips)

Problem: step 3 is the longest blocking step — user tabs away to WordPress, approves, tabs back. During those ~15–30 seconds we do nothing. Webhook registration then adds another few seconds on top. The whole "Authorize WordPress" card feels slow.

Target flow:
1. Authorizing with WooCommerce
2. Receiving API credentials
3. **As soon as step 2 lands, fire `POST /api/stores/[storeId]/register-webhooks` in the background** — UI shows the "Registering webhooks" row spinning concurrently with step 3
4. Authorize WordPress media access (user does their thing in parallel)
5. Both green → enable "Next" button

The UX win: by the time the user returns from WP media auth, webhooks are already registered and that row is already ✅ — the whole step 3 feels instant.

### Behavior rules

- **Start trigger:** the moment step 2 (`Receiving API credentials`) flips to ✅, kick off webhook registration without waiting for anything else. Use the existing `/api/stores/[storeId]/register-webhooks.ts` endpoint.
- **Independence:** webhook registration must not block media auth UI. User can click "Authorize via WordPress" whether webhooks are still spinning, done, or failed.
- **Independence the other way:** media auth completing should not re-trigger or wait on webhook registration.
- **Retry on failure:** if webhook registration errors, the row shows a red ✗ with inline "Retry" button + small error reason. User can retry any number of times.
- **Don't auto-advance to step 4 until both land:** Next button disabled until (webhooks=done OR webhooks=failed-but-acknowledged) AND (media=done OR media=skipped).
- **Skip media:** "Skip for now" on media access is still allowed. Webhooks continue / complete independently.
- **Double-fire guard:** use a ref/flag so the background kickoff only fires once per mount even if step 2 re-renders. If user returns to this page after a completed run (e.g. via "Reconnect"), re-run both concurrently on entry.
- **Race on step 2 remount:** if the component remounts (hot reload, navigation back) and API creds already exist in DB, we should check webhook status first (`GET` existing webhooks via `/api/webhooks` or a quick HEAD on register-webhooks) before firing again, to avoid duplicate webhook creation on the Woo side.
- **Progress wording:** keep the row label "Registering webhooks"; on completion flip to "Webhooks registered" with count badge (e.g. "(7)"). On failure: "Webhook registration failed — Retry".
- **Analytics / activity log:** log the start + outcome of background webhook registration to `activity_log` with actor=system, entity=store, action=webhooks_auto_register.

### Implementation outline

Connect page (`src/pages/sites/connect/[id].tsx`):
- Add state: `webhookStatus: "idle" | "running" | "done" | "failed"`, `webhookError: string | null`, `webhookCount: number`
- Add ref: `hasFiredWebhooksRef` to ensure single kickoff
- Effect: when `apiCredsReceived === true && !hasFiredWebhooksRef.current`, set ref true, flip status to running, call the register-webhooks endpoint, update state on resolve/reject
- Row rendering: map `webhookStatus` → icon (spinner/check/x) + label + optional Retry button
- "Next" / final step gate: `webhookStatus === "done" || webhookStatus === "failed"` (allow proceed with failure after ack) AND media step resolved

Register-webhooks API (`src/pages/api/stores/[storeId]/register-webhooks.ts`):
- Verify it's idempotent (safe to call again if already registered). If not, add an existence check — for each webhook topic, if already exists in our `webhooks` table AND on Woo side (or our mirror), skip re-creation.
- Return `{ registered: number, skipped: number, errors: Array<{topic, message}> }` so UI can show accurate count.

Audit: confirm `register-webhooks.ts` doesn't require media creds (it shouldn't — webhooks are WC API only, not WP media). If there's any coupling, decouple.

## Checklist
- [ ] Verify `register-webhooks.ts` is idempotent (no duplicate Woo webhooks on retry); add existence check if missing
- [ ] Make webhook registration endpoint return `{ registered, skipped, errors }` for accurate UI feedback
- [ ] Add `webhookStatus` / `webhookError` / `webhookCount` state + `hasFiredWebhooksRef` to connect page
- [ ] Fire webhook registration in a `useEffect` the moment API credentials step flips to done, guarded by the ref
- [ ] Render the "Registering webhooks" row as live status (spinner → check with count → error + Retry button)
- [ ] Remove the sequential dependency: media auth UI and button must stay interactive regardless of webhook status
- [ ] Disable "Next" / final-step button until (webhookStatus in {done, failed-acked}) AND (media in {done, skipped})
- [ ] Add "acknowledge error" behavior for failed webhook row so user can proceed with a known failure
- [ ] If returning to this page with API creds already present, re-check webhook state before re-registering (avoid duplicates)
- [ ] Log background registration start + outcome to `activity_log` (action=webhooks_auto_register)
- [ ] Smoke test: fresh connect → watch webhook row tick ✅ while user is still on the WP authorize tab
- [ ] Smoke test: webhook registration forced to fail (invalid URL) → row shows ✗ + Retry works
- [ ] Smoke test: "Skip for now" on media → webhooks still complete independently, Next stays disabled until webhooks resolve

## Acceptance
- On a fresh site connect, the "Registering webhooks" row starts spinning immediately after "Receiving API credentials" ✅, in parallel with the user tabbing out to WordPress for media auth
- When the user returns from WordPress media auth, webhooks are already done in the majority of cases
- Webhook errors don't block the flow — user sees a retry, can retry without leaving the page, and can proceed after acknowledgement
- No duplicate webhooks created on Woo side when the user reconnects or refreshes mid-flow
