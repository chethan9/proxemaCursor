# Agent instructions

## Completion workflow

When work is finished (unless the user opts out):

1. **Git**: Do **not** run **`git push`** unless the user explicitly asks to push (pushing triggers CI / production hooks). Local **`git commit`** only when the user asks to commit or agrees to a checkpoint—otherwise leave changes uncommitted or report `git status` for them to commit locally.
2. **Supabase**: For new SQL under `supabase/migrations/`, apply to the linked project (**proximaCursor**, ref `fyqvmbrgyncthksbgrrr`) via Supabase MCP **`apply_migration`** or CLI—**only when migrations were added in this task** and the user has not asked to skip remote apply.
3. **Local dev + browser**: If **`npm run dev`** is not running, start it; default URL is **http://localhost:3000**. Open that URL in the browser for a quick smoke check when useful.

**Vercel:** Never run production deploys (`vercel deploy`, etc.) unless the user explicitly asks.

Report blockers briefly when a step is impossible (auth failure, missing tooling).

## Global navigation / menu editor

When adding a new **top-level** route under `src/pages/` (anything **not** under `src/pages/sites/`), add a matching row to **`MENU_REGISTRY`** in [`src/lib/menu-registry.ts`](src/lib/menu-registry.ts): `href`, label, icon (must exist on `ICON_MAP`), default group/order, and **`superAdminOnly`** or **`permission`** to match the page guard. Store/scoped routes stay in **`SITE_MENU_REGISTRY`** only.
