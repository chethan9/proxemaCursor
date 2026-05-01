# Proxima Cursor

Source repository: **https://github.com/chethan9/proxemaCursor**

## Docs

- [Deployment Guide](./docs/DEPLOYMENT.md) — safe-deploy workflow, migration runner, rollback procedures

## Cloudflare Images (optional acceleration)

Server (upload/delete/repair): set `CLOUDFLARE_PRODUCT_IMAGES_ENABLED=true`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_IMAGES_ACCOUNT_HASH`. Optional variants: `CLOUDFLARE_IMAGES_VARIANT_THUMB`, `_CARD`, `_EDIT`, `_ZOOM`.

Client (serve mirrored URLs in catalog + edit preview): set `NEXT_PUBLIC_CLOUDFLARE_PRODUCT_IMAGES=true` when the server flag is on.

Observability: set `CLOUDFLARE_IMAGE_MIRROR_METRICS=true` to emit JSON lines for mirror outcomes and cron repair batches. Cron batch size: `CF_MIRROR_REPAIR_BATCH` (default 50).

## Publish

Default Git remote `origin` targets the repo above. Push with:

```bash
git push origin main
```
