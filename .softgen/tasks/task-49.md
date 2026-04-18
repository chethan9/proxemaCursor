---
title: Deployment workflow documentation (docs/DEPLOYMENT.md)
status: todo
priority: high
type: chore
tags: [docs, deployment]
created_by: agent
created_at: 2026-04-18
position: 49
---

## Notes
Single doc covering:

1. Environment setup (dev vs prod Supabase, env vars in each, where to set them in Vercel)
2. Branching workflow: feature/* → staging (later) → main
3. Pre-deploy checklist (10-item list covering migrations, staging smoke test, webhook verification, API consumer verification, rollback readiness)
4. Migration rules: expand-contract pattern, backward-compat requirement, no DROP in same deploy as code stops using column
5. Running migrations: `npm run db:migrate` with DATABASE_URL
6. Rollback procedure: Vercel instant rollback, DB reverse migration
7. Post-deploy monitoring: Vercel logs, Supabase logs, webhook events table, sync runs table
8. Disaster recovery: webhook URL repair action, PITR (when enabled), manual SQL via Supabase dashboard
9. What NOT to do section: editing prod data via dashboard, hotfixing, destructive SQL without backup
10. Future improvements: staging environment setup (deferred until closer to launch), Supabase PITR ($25/mo), feature flags column on clients table

Keep under ~250 lines, scannable with clear H2 sections.

## Checklist
- [ ] Create docs/DEPLOYMENT.md with all 10 sections above
- [ ] Cross-reference task-47 (dynamic webhook URLs) and task-48 (migration runner)
- [ ] Add link from README.md to DEPLOYMENT.md
- [ ] Include expand-contract migration examples (add column → dual-write → backfill → drop old)
- [ ] Include exact Vercel env var names and Supabase dashboard screenshots references (not actual screenshots)