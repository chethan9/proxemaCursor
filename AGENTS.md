# Agent instructions

## Project map (remember for this repo)

| Item | Value |
|------|--------|
| **Workspace path** | `/Users/wb/Desktop/proxemacr` (open this folder in Cursor; same as *Desktop/proxemacr*) |
| **App GitHub** | `https://github.com/chethan9/proxemaCursor` |
| **Docs GitHub (canonical Docusaurus)** | `https://github.com/chethan9/wiki` — production docs and Vercel “Edit this page” target this repo |
| **Docs live URL** | `https://wiki-pi-blue.vercel.app` |
| **Database** | **Supabase** — `supabase/` (migrations, local config). Use Supabase MCP or CLI; project ref in workflow below. |

Local preview of docs beside the app: `documentation/` (mirror; align edits with `chethan9/wiki` for production).

## Vercel (MCP + CLI)

- **MCP server:** `plugin-vercel-vercel`. Use **`list_projects`** (requires `teamId` from [`.vercel/project.json`](./.vercel/project.json) `orgId`), **`get_deployment`**, **`list_deployments`**, and **`get_deployment_build_logs`** to inspect status and failed builds.
- **`deploy_to_vercel`:** In this integration, the tool does **not** start a remote deploy by itself; it returns guidance to run **`vercel deploy`** (or rely on **Git → Vercel**). The agent should still **invoke it** when the user asks to deploy, then run the **CLI** from the correct directory with a linked **`.vercel`** (or use **`vercel pull`** first).
- **Docs site (`wiki-pi-blue.vercel.app`):** Vercel project name **`wiki`**. Work from a clone of **`chethan9/wiki`**, then `vercel pull --yes --environment production`, `vercel build --prod`, `vercel deploy --prebuilt --prod --yes` (reliable for Docusaurus). The main app project is **`proximacursor`**—do not deploy it unless the user names it.

## Completion workflow

When work is finished (unless the user opts out):

1. **Git**: Do **not** run **`git commit`** or **`git push`** unless the user explicitly asks in the current message. Otherwise leave changes uncommitted and report `git status`/summary for the user to handle.
2. **Supabase**: For new SQL under `supabase/migrations/`, apply to the linked project (**proximaCursor**, ref `fyqvmbrgyncthksbgrrr`) via Supabase MCP **`apply_migration`** or CLI—**only when migrations were added in this task** and the user has not asked to skip remote apply.
3. **Local dev + browser**: If **`npm run dev`** is not running, start it; default URL is **http://localhost:3000**. Open that URL in the browser for a quick smoke check when useful.

**Vercel:** Never run deploys (`vercel deploy`, etc.) or otherwise publish to production unless the user explicitly asks in the current message.

**Git:** Do not **`git push`** (or similar remote git writes) unless the user explicitly asks in the current message. The only routine remote write without a separate ask is **Supabase migration apply** (item 2)—not Vercel, not git push.

**Remote-write default:** Outside of explicit user instruction, the only allowed remote write is applying Supabase migrations as described above.

Report blockers briefly when a step is impossible (auth failure, missing tooling).

## Security

- Follow [`.cursor/rules/security-baseline.mdc`](./.cursor/rules/security-baseline.mdc). Validated env lives in [`src/env.ts`](./src/env.ts); service-role keys stay server-only.
- HTTP APIs: global limits via [`src/middleware.ts`](./src/middleware.ts) when Upstash env is set; exclusions in [`src/lib/api-rate-limit-config.ts`](./src/lib/api-rate-limit-config.ts).
- Supabase login abuse: configure dashboard controls per [`documentation/security/supabase-auth-hardening.md`](./documentation/security/supabase-auth-hardening.md) (browser auth does not hit Next.js `/api/*`).
- CI: [`.github/workflows/security.yml`](./.github/workflows/security.yml) runs `npm audit` and TruffleHog (Docker).

## Global navigation / menu editor

When adding a new **top-level** route under `src/pages/` (anything **not** under `src/pages/sites/`), add a matching row to **`MENU_REGISTRY`** in [`src/lib/menu-registry.ts`](src/lib/menu-registry.ts): `href`, label, icon (must exist on `ICON_MAP`), default group/order, and **`superAdminOnly`** or **`permission`** to match the page guard. Store/scoped routes stay in **`SITE_MENU_REGISTRY`** only.
