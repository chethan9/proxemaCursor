---
title: Harden types.ts against regeneration wipes
status: done
priority: high
type: chore
tags: [typescript, supabase, build]
created_by: agent
created_at: 2026-04-23T13:25:00Z
position: 169
---

## Notes

Context: `src/integrations/supabase/types.ts` is supposed to re-export `Tables`, `TablesInsert`, `TablesUpdate`, `Enums`, `Functions` generic helpers on top of the auto-generated `database.types.ts`. These helpers are imported across the codebase (services, API routes, components).

Problem: every time `execute_sql_query` runs, the Supabase type regeneration step overwrites `types.ts` and strips the re-export block. This has broken the Vercel build twice today — once in commit `81c8db6`, again in `5a0d3b2`. Each time the fix is manual re-adding the same five lines. This will keep happening on every schema change.

Goal: the re-export block must survive every type regeneration automatically, so DB schema changes never break the build.

Approach options (executor picks best):
- Option A: move the generic helpers into a new file (e.g. `src/integrations/supabase/helpers.ts`) that is never touched by the generator, and update imports project-wide.
- Option B: modify the regeneration flow so that `types.ts` is preserved as a thin wrapper and only `database.types.ts` gets regenerated (current intent — but it's not holding).
- Option C: add a post-regeneration hook that re-appends the missing exports.

Files involved: `src/integrations/supabase/types.ts`, `src/integrations/supabase/database.types.ts` (read-only, auto-generated), every file importing `Tables`/`TablesInsert`/`TablesUpdate` from `@/integrations/supabase/types`.

## Checklist

- [ ] Investigate what regenerates `types.ts` and why the current re-export block keeps getting wiped (check agent runtime, check for any generator script in `scripts/`)
- [ ] Pick a durable approach: relocate helpers to a non-generated file, OR make the generator preserve the wrapper, OR add a restore hook
- [ ] Implement the chosen approach so `Tables`, `TablesInsert`, `TablesUpdate`, `Enums`, `Functions` exports are guaranteed available from a stable import path
- [ ] If helpers moved to a new file, update all imports across `src/` to point at the new path (verify with a project-wide grep)
- [ ] Run a schema-changing query (e.g. add a dummy column then drop it) and confirm `types.ts`/helpers block still compiles cleanly
- [ ] Run the full build locally to confirm no TypeScript errors
- [ ] Document the contract in `docs/MIGRATIONS.md` or a new short doc so the next agent doesn't try to edit the auto-generated file

## Acceptance

- After running any `execute_sql_query` that triggers type regeneration, `npm run build` still passes without any manual edits to `types.ts`.
- Every existing import of `Tables` / `TablesInsert` / `TablesUpdate` from `@/integrations/supabase/types` continues to resolve (or has been updated to a new stable path).