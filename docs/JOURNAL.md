# Change Journal

Append-only log of meaningful changes. Newest on top. Every agent session that modifies code, schema, or docs adds an entry here.

**Entry format:**
```
## YYYY-MM-DD — short title
**Scope:** feature | bug | chore | refactor | docs | schema
**Commit:** <hash or "uncommitted">
**Files:** key files touched
**Why:** one-line reason
**What:** bullet list of changes
**Follow-ups:** anything deferred
```

Keep entries concise. Link to task files (`.softgen/tasks/task-N.md`) or PRs when relevant.

---

## 2026-04-19 — Codebase index + change journal introduced
**Scope:** docs
**Commit:** uncommitted
**Files:** `docs/CODEBASE_INDEX.md` (new), `docs/JOURNAL.md` (new)
**Why:** Make structural navigation and change tracking easier across sessions. Agent will append to JOURNAL.md on every meaningful change from now on.
**What:**
- Created `CODEBASE_INDEX.md` — full map of routes, API surface, services, hooks, libs, DB tables, design tokens, known refactor candidates.
- Created `JOURNAL.md` — this file. Append-only log format defined above.
**Follow-ups:**
- Refactor candidates listed in `CODEBASE_INDEX.md` (ProductsTab 1101 lines, OrdersTab 892, sync-runs page 675, etc.) — tackle opportunistically when touching those files for other reasons.
- Clean lint warnings (unused imports, exhaustive-deps in settings pages, 2 non-null assertions in `storeService.ts`).

## 2026-04-19 — Stable release v2 tag
**Scope:** chore
**Commit:** `217a3d7` (local; push deferred to user via Publish)
**Files:** repo-wide (no code changes, audit only)
**Why:** Mark a stable checkpoint after product/orders/filter refinements.
**What:**
- Verified `tsc --noEmit` clean.
- `next lint` — warnings only (unused imports, exhaustive-deps, 2 non-null assertions). No errors.
- Committed with message `chore: stable release v2`.
**Follow-ups:** User to click **Publish** to push to GitHub.