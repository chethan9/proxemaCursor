# Proxima Cursor

Source repository: **https://github.com/chethan9/proxemaCursor**

## Docs

- [Deployment Guide](./docs/DEPLOYMENT.md) — safe-deploy workflow, migration runner, rollback procedures

### Analytics env cleanup (ops)

The embedded Metabase / standard reports product was removed. You can delete unused secrets such as `METABASE_EMBEDDING_SECRET`, other `METABASE_*` variables, and `ALLOWED_STANDARD_REPORT_HOSTS` from hosting providers after deploy.

## Cloudflare Images (optional acceleration)

Server (upload/delete/repair): set `CLOUDFLARE_PRODUCT_IMAGES_ENABLED=true`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_IMAGES_ACCOUNT_HASH`. Optional variants: `CLOUDFLARE_IMAGES_VARIANT_THUMB`, `_CARD`, `_EDIT`, `_ZOOM`.

Client (serve mirrored URLs in catalog + edit preview): set `NEXT_PUBLIC_CLOUDFLARE_PRODUCT_IMAGES=true` when the server flag is on.

Observability: set `CLOUDFLARE_IMAGE_MIRROR_METRICS=true` to emit JSON lines for mirror outcomes and cron repair batches. Cron batch size: `CF_MIRROR_REPAIR_BATCH` (default 50).

Super admins can manage integration settings (encrypted API token, account IDs, variants, repair batch, metrics) at **Settings → Cloudflare Images** (`/admin/cloudflare-images`). Database credentials override environment variables when enabled and complete; apply migration `20260502120000_cloudflare_images_settings.sql` so the singleton settings row exists.

## Deploy refresh

Each production bundle includes `NEXT_PUBLIC_APP_BUILD_ID` from `resolve-app-build-id.mjs`. **Vercel deployment id is preferred over git SHA** so redeploys of the same commit still register as a new build (otherwise long-lived tabs would never prompt). The client compares this id to `GET /api/build-info` (same resolver); long-lived tabs poll every five minutes and on window focus / visibility.

## Navigation (menu editor)

Pages under `/admin/*` should wrap content with **`AppLayout` only**, not `SettingsLayout`. Otherwise the primary sidebar / panel submenu plus the Settings inner nav produce duplicate columns. See comments on `SettingsLayout` and `MENU_REGISTRY` in the codebase.

## Publish

Default Git remote `origin` targets the repo above. Push with:

```bash
git push origin main
```
