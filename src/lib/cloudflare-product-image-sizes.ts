/**
 * Product catalog uses the **thumb** Cloudflare Images variant for grid/list thumbnails
 * (see `getProductThumbnailWithMirrors` → `thumb` then `card`).
 *
 * The app does not resize on the client: **set variant sizes in the Cloudflare dashboard**
 * so `thumb` matches the largest on-screen cell (roughly 320–400px for dense grids; list row avatars ~40px use the same URL but CSS-scales down).
 *
 * Master uploads are optionally downscaled before upload (`CF_MIRROR_MASTER_MAX_EDGE_PX`, see `cloudflare-images.server.ts`)
 * to save storage; keep enough resolution for your **zoom** / **edit** variants.
 */
export const CLOUDFLARE_CATALOG_THUMB_TARGET_MAX_PX = 384;
