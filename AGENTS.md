# Agent instructions

## Completion workflow (do not ask—execute)

When work is finished (features merged, migrations added, or the user signals completion):

1. **Git**: Ensure changes are committed and **`git push`** to the tracked remote and branch (typically `origin main`).
2. **Supabase**: For new SQL under `supabase/migrations/`, apply to the linked project (**proximaCursor**, ref `fyqvmbrgyncthksbgrrr`) via Supabase MCP **`apply_migration`** or CLI—not only committing files locally.
3. **Vercel**: Deploy production with **`npx vercel deploy --prod --yes`** from the repo root when a deploy is needed (or rely on git integration if it already deployed the pushed commit). Confirm success (e.g. https://proximacursor.vercel.app).
4. **Local dev + browser**: If **`npm run dev`** is not running, start it; default URL is **http://localhost:3000**. Open that URL in the browser for a quick smoke check.

Only skip a step when it is impossible (auth failure, missing tooling)—report the blocker briefly instead of asking for permission when automation is available.
