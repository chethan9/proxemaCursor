---
title: Image upload reliability + error recovery
status: todo
priority: medium
type: bug
tags: [products, uploads, ux]
created_by: agent
created_at: 2026-04-22T15:55:00Z
position: 145
---

## Notes
Bug report Px-15. `ImagePickerDialog` → `useUploadWpMedia` mutation has no timeout. When the WordPress REST endpoint stalls (large file, slow host, token refresh), the user sees the spinning loader indefinitely and the file never appears.

Fix approach:
- Wrap the upload fetch with an `AbortController` + ~60s timeout
- On timeout/failure, clear the spinner, surface a destructive toast with the filename and a "Retry" button
- Show per-file progress (uploaded/failed count) when multi-upload so one bad file doesn't stall the rest
- On the server side (`/api/stores/[storeId]/wp/media.ts`), ensure errors from WP are caught and returned as JSON with a proper status — not a hanging stream

## Checklist
- [ ] Add AbortController + 60s timeout to `useUploadWpMedia` mutation (service: `wpMediaService.ts`)
- [ ] In `ImagePickerDialog.handleFiles`, process uploads sequentially with a try/catch per file; accumulate successes and failures; after loop, show a toast summarizing "X uploaded, Y failed — retry?"
- [ ] Replace the always-spinning "Upload New" button state with an inline progress strip showing "Uploading 2/5…" when multi-file
- [ ] If any upload fails, keep the dialog open with the uploaded items already selected so the user can retry just the failed ones
- [ ] Verify `/api/stores/[storeId]/wp/media.ts` returns an error JSON with 4xx/5xx status on WP failure (not a timeout/hang on the API side)

## Acceptance
- Uploading a 5MB image over a throttled connection either completes or fails cleanly within 60s
- Multi-file upload with one bad file: the others still succeed; a toast shows "4 uploaded, 1 failed"
- Retry button on the failure toast re-uploads just the failed file
