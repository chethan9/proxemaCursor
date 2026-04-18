---
title: Fix Vercel build — move _shared.tsx out of pages/ directory
status: done
priority: urgent
type: bug
tags: [deployment, build]
created_by: agent
created_at: 2026-04-18
position: 46
---

## Notes
Vercel build fails: `pages/sites/[id]/_shared` has no default React component export. Next.js Page Router treats every file in `pages/` as a route — `_shared` is not a reserved prefix (only `_app`, `_document`, `_error`).

Also `src/pages/sites/[id]/index.tsx` is empty (0 lines) — will cause the same error. Redirect it to the home subpage.

## Checklist
- [ ] Create src/components/site/shared.tsx with the exact content of src/pages/sites/[id]/_shared.tsx
- [ ] Update import in src/pages/sites/[id]/products.tsx: `from "./_shared"` → `from "@/components/site/shared"`
- [ ] Update import in src/pages/sites/[id]/orders.tsx
- [ ] Update import in src/pages/sites/[id]/tags.tsx
- [ ] Update import in src/pages/sites/[id]/categories.tsx
- [ ] Update import in src/pages/sites/[id]/home.tsx
- [ ] Delete src/pages/sites/[id]/_shared.tsx
- [ ] Replace src/pages/sites/[id]/index.tsx with a default export that redirects to `/sites/[id]/home` using useRouter
- [ ] check_for_errors with build=true