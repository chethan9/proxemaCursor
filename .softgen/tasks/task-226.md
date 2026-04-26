---
title: KNOWN_TRAPS.md — recurring footguns reference
status: done
priority: medium
type: chore
tags: [docs, dx, knowledge]
created_by: agent
created_at: 2026-04-26
position: 226
---

## Notes

Create `docs/KNOWN_TRAPS.md` — a living list of bug classes we've already hit and the prevention/detection guidance for each. The planning agent reads this on every pass so the same trap doesn't re-surface in new code.

**Format per entry** — short, actionable, no prose:
```
### [Trap name]
**Symptom:** What the user sees / error message.
**Cause:** Why it happens.
**Prevention:** What to do in new code.
**Detection:** How we catch it now (lint rule, type check, runtime guard).
**First seen:** Commit / date / task ID.
```

**Initial entries to seed:**

1. **`supabaseAdmin` client leak** — server-only client pulled into client bundle via top-level import in a shared lib. Symptom: "Application error: a client-side exception". Prevention: `import "server-only"` + ESLint rule (task-224). First seen: 2026-04-26.

2. **RLS policy mismatch — auth.uid() on unauthenticated tables** — INSERT fails with 42501 because policy expects auth but the UI has no login. Prevention: follow RLS Decision Tree T3 for any table written from a public/landing page. Detection: smoke-test create flows from a logged-out browser before merge.

3. **`react-leaflet` v5 with React 18** — peer-dep warning, then runtime crash on map mount. Prevention: pin to `react-leaflet@4.x` while project is on React 18.

4. **`@react-three/fiber` v9 with React 18** — same pattern. Pin `@react-three/fiber@8` and `@react-three/drei@9`.

5. **Hex colors with Tailwind opacity modifiers** — `bg-primary/50` produces white when `--primary` is a hex value. Prevention: always use HSL space-separated triplets in `globals.css` (`--primary: 221 83% 53%`).

6. **Apostrophes in SQL string literals** — `'Springfield's'` throws 42601. Prevention: double-quote (`'Springfield''s'`) or use parameterized queries via Supabase client.

7. **`.single()` on potentially-empty result** — throws PGRST116 even on success. Prevention: use `.maybeSingle()` unless the row is guaranteed to exist.

8. **Missing FK trigger after Supabase auth signup** — new auth user has no `profiles` row, FK violations cascade. Prevention: keep the `handle_new_user` trigger from supabase debugging protocol installed and backfilled.

9. **Stale react-query cache after mutation** — UI shows old data. Prevention: invalidate or update affected query keys in mutation `onSuccess`.

10. **Cron `/api/cron/*` running on Vercel free tier hobby plan** — silently skipped past 1/day limit. Prevention: monitor cron logs; upgrade to Pro before relying on per-minute crons.

**Workflow integration**
- Add a one-liner to `docs/JOURNAL.md` whenever a new trap is added.
- Reference `KNOWN_TRAPS.md` from `README.md` and `docs/CODEBASE_INDEX.md` so it's discoverable.
- Update `docs/JOURNAL.md` task-completion entry to point to the trap when fixing.

## Checklist

- [ ] Create `docs/KNOWN_TRAPS.md` with the format documented above.
- [ ] Seed with the 10 entries listed in Notes (all already-encountered or known footguns in this codebase).
- [ ] Cross-link from `README.md` (one-line note in the Documentation section).
- [ ] Cross-link from `docs/CODEBASE_INDEX.md`.
- [ ] Add a note in `docs/JOURNAL.md` about the doc's existence and update protocol.
- [ ] Verify markdown renders cleanly on GitHub (preview links, headings, code blocks).

## Acceptance

- `docs/KNOWN_TRAPS.md` exists, is discoverable from README and codebase index, and has 10 actionable entries with cause + prevention guidance.
- Future bug fixes follow the protocol: a new trap entry is added the same time the fix lands.
