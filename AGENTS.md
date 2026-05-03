# Agent instructions

## Completion workflow

When work is finished (unless the user opts out):

1. **Git**: Do **not** run **`git commit`** or **`git push`** unless the user explicitly asks in the current message. Otherwise leave changes uncommitted and report `git status`/summary for the user to handle.
2. **Supabase**: For new SQL under `supabase/migrations/`, apply to the linked project (**proximaCursor**, ref `fyqvmbrgyncthksbgrrr`) via Supabase MCP **`apply_migration`** or CLI—**only when migrations were added in this task** and the user has not asked to skip remote apply.
3. **Local dev + browser**: If **`npm run dev`** is not running, start it; default URL is **http://localhost:3000**. Open that URL in the browser for a quick smoke check when useful.

**Vercel:** Never run deploys (`vercel deploy`, etc.) or otherwise publish to production unless the user explicitly asks in the current message.

**Git:** Do not **`git push`** (or similar remote git writes) unless the user explicitly asks in the current message. The only routine remote write without a separate ask is **Supabase migration apply** (item 2)—not Vercel, not git push.

**Remote-write default:** Outside of explicit user instruction, the only allowed remote write is applying Supabase migrations as described above.

Report blockers briefly when a step is impossible (auth failure, missing tooling).

## Global navigation / menu editor

When adding a new **top-level** route under `src/pages/` (anything **not** under `src/pages/sites/`), add a matching row to **`MENU_REGISTRY`** in [`src/lib/menu-registry.ts`](src/lib/menu-registry.ts): `href`, label, icon (must exist on `ICON_MAP`), default group/order, and **`superAdminOnly`** or **`permission`** to match the page guard. Store/scoped routes stay in **`SITE_MENU_REGISTRY`** only.
