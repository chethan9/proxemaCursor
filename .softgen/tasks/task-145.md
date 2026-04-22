---
title: Image upload reliability + error recovery
status: done
priority: medium
type: bug
tags: [media, upload, ux]
created_by: agent
created_at: 2026-04-22T15:56:30Z
position: 145
---

## Notes
Bug Px-15. Image upload sometimes hangs — user sees perpetual loader and no indication of failure. `wpMediaService.uploadWpMedia` had no timeout/abort; if the WP backend stalled, the fetch never resolved.

Fix: add an `AbortController` with a 90s hard timeout (sized for large product photos on slow uplinks), surface per-file success/failure via toast, and propagate a readable timeout message.

## Checklist
- [x] Add `AbortController` + 90s timeout in `wpMediaService.uploadWpMedia`; convert `AbortError` to a friendly message referencing the file name
- [x] Accept optional upstream `AbortSignal` so the mutation can be cancelled
- [x] In `ImagePickerDialog.handleFiles`, collect per-file failures and emit a single summary toast ("N uploaded · M failed") with first 3 failure reasons
- [x] On full success, show a positive toast so the user knows the action completed

## Acceptance
- Upload 5 files with one intentionally failing → toast shows "4 uploaded · 1 failed" with the failing filename + reason
- A hung request aborts after 90s with a clear error toast instead of infinite spinner
- Successful uploads appear in the grid with the "just-uploaded" pulse ring as before
