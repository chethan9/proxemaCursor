---
title: Site card redesign (Grid view)
status: todo
priority: high
type: feature
tags: [ui, projects, card]
created_by: agent
created_at: 2026-04-22
position: 135
---

## Notes

Grid-view card for the Projects page. Works standalone and becomes the canonical site card (reused on client detail page, settings site list, etc).

**Visual header:**
- Favicon fetched from `{site_url}/wp-json/` root endpoint (`site_icon_url` or `site_logo_url`) — cached on `stores.favicon_url`
- Background tint derived from brand — extract dominant color from favicon or fall back to a deterministic hash-based pastel
- Screenshot preview stays **out of scope for v1** — add placeholder area that will later hold a Microlink-generated screenshot (task for v2)

**Body:**
- Site name (bold) + URL (mono, truncated, click-to-copy)
- Client chip + super-admin-only "Reassign" hover link
- Health score with tooltip explaining the breakdown
- Connection badges row: "WooCommerce API ✓/✗", "WP Media ✓/✗", "Webhooks N/total"
- Last sync line: "Synced 15m ago • 1,034 products • 5,000 orders"

**Action row (inline on the card):**
- Primary: "Sync all" button (disabled while a sync is running, shows spinner + "Syncing…" when active)
- Secondary buttons: "Open site home" (→ `/sites/{id}/home`), "Edit" (opens EditSiteDialog), "Open storefront" (external link icon → the live Woo URL)
- Kebab menu: Sync products only / Sync orders only / View sync history / Delete

**Status states:**
- Healthy: subtle emerald top border
- Warning (recent sync failure or low health): amber top border + warning tooltip
- Critical (disconnected or no successful sync in 24h): rose top border + "Reconnect" CTA

**Uptime sparkline:**
- Placeholder area reserved for the 24h uptime sparkline — the real widget lands in task 136 and slots into this reserved slot when uptime data is available

## Checklist

- [ ] Add `favicon_url` column to `stores` table via migration
- [ ] Create API endpoint `GET /api/stores/[storeId]/fetch-site-metadata` that hits `{url}/wp-json/` and extracts site_icon_url, site name, description
- [ ] Call fetch-site-metadata automatically on site creation and on manual refresh, cache result on store row
- [ ] Design and build `SiteCard` component in `src/components/project/SiteCard.tsx` used by the grid view
- [ ] Favicon display with deterministic fallback color tile when no favicon available
- [ ] Connection badges: WooCommerce API (consumer_key present), WP Media (wp_app_password present), Webhooks (count registered vs expected)
- [ ] Last-sync line with friendly relative time and fleet stats (products / orders counts from site_stats)
- [ ] Inline Sync-all button with live state from `useActiveSync`; disables while running, shows progress % if available
- [ ] Open-store, Edit, Open-storefront quick actions
- [ ] Kebab menu with Sync-aspect and history options
- [ ] Status top-border color driven by health score + last sync recency
- [ ] Reserve placeholder slot for uptime sparkline (task 136) — empty until uptime data exists
- [ ] Client chip with super-admin-only quick reassign (opens EditSiteDialog focused on client field)

## Acceptance

- Grid card shows favicon + brand tint for every site within 24h of creation
- Sync-all button enqueues and reflects live sync status without leaving the card
- Clicking Edit opens EditSiteDialog; clicking Open site home navigates to `/sites/{id}/home`
- Critical state (disconnected site) shows rose border + "Reconnect" CTA on the card