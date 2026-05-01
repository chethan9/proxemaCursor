# Proxima Cursor

Source repository: **https://github.com/chethan9/proxemaCursor**

## Docs

- [Deployment Guide](./docs/DEPLOYMENT.md) — safe-deploy workflow, migration runner, rollback procedures

## Cloudflare Images (optional acceleration)

Server (upload/delete/repair): set `CLOUDFLARE_PRODUCT_IMAGES_ENABLED=true`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_IMAGES_ACCOUNT_HASH`. Optional variants: `CLOUDFLARE_IMAGES_VARIANT_THUMB`, `_CARD`, `_EDIT`, `_ZOOM`.

Client (serve mirrored URLs in catalog + edit preview): set `NEXT_PUBLIC_CLOUDFLARE_PRODUCT_IMAGES=true` when the server flag is on.

Observability: set `CLOUDFLARE_IMAGE_MIRROR_METRICS=true` to emit JSON lines for mirror outcomes and cron repair batches. Cron batch size: `CF_MIRROR_REPAIR_BATCH` (default 50).

Super admins can manage integration settings (encrypted API token, account IDs, variants, repair batch, metrics) at **Settings → Cloudflare Images** (`/admin/cloudflare-images`). Database credentials override environment variables when enabled and complete; apply migration `20260502120000_cloudflare_images_settings.sql` so the singleton settings row exists.

## Deploy refresh

Each production bundle includes `NEXT_PUBLIC_APP_BUILD_ID` (typically `VERCEL_GIT_COMMIT_SHA`). The app compares it to `localStorage` and reloads once when a new deploy is detected, so users are not asked to hard-refresh after releases. Long-lived tabs poll `GET /api/build-info` every five minutes.

## Navigation (menu editor)

Pages under `/admin/*` should wrap content with **`AppLayout` only**, not `SettingsLayout`. Otherwise the primary sidebar / panel submenu plus the Settings inner nav produce duplicate columns. See comments on `SettingsLayout` and `MENU_REGISTRY` in the codebase.

## Publish

Default Git remote `origin` targets the repo above. Push with:

```bash
git push origin main
```
