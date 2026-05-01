# Agent instructions

## Completion workflow (do not ask—execute)

When work is finished (features merged, migrations added, or the user signals completion):

1. **Git**: Ensure changes are committed and **`git push`** to the tracked remote and branch (typically `origin main`).
2. **Supabase**: For new SQL under `supabase/migrations/`, apply to the linked project (**proximaCursor**, ref `fyqvmbrgyncthksbgrrr`) via Supabase MCP **`apply_migration`** or CLI—not only committing files locally.
3. **Local dev + browser**: If **`npm run dev`** is not running, start it; default URL is **http://localhost:3000**. Open that URL in the browser for a quick smoke check.

**Vercel:** Do not run production deploys as part of this workflow. The human deploys when they want (dashboard, `npm run deploy:prod`, or git integration if enabled).

Only skip a step when it is impossible (auth failure, missing tooling)—report the blocker briefly instead of asking for permission when automation is available.

## Global navigation / menu editor

When adding a new **top-level** route under `src/pages/` (anything **not** under `src/pages/sites/`), add a matching row to **`MENU_REGISTRY`** in [`src/lib/menu-registry.ts`](src/lib/menu-registry.ts): `href`, label, icon (must exist on `ICON_MAP`), default group/order, and **`superAdminOnly`** or **`permission`** to match the page guard. Store/scoped routes stay in **`SITE_MENU_REGISTRY`** only.
