---
sidebar_position: 10
title: Troubleshooting & FAQ
---

# Troubleshooting & FAQ

## The page says I don’t have permission

Roles gate navigation items and URLs. Ask an owner or administrator to grant the relevant permission bundle—often split across catalog, developer tools, or billing scopes.

## Dashboard numbers don’t match WooCommerce

Scheduled refreshes, caching, or an incomplete sync run can cause temporary drift. Check **Sync Runs** when available; otherwise wait for the next refresh cycle.

## Product saves fail or spin indefinitely

- Confirm required fields (SKU uniqueness, variation completeness).
- Retry after a minute—upstream WooCommerce rate limits occasionally apply.
- Capture timestamps for support if failures persist.

## Menus look duplicated on admin pages

Internal guidance: mixed layouts (`AppLayout` vs `SettingsLayout`) can duplicate navigation columns on `/admin/*` routes. If you see duplicated sidebars, notify engineering—it’s a layout configuration issue, not your browser.

## Where to get help

Route issues through your organization’s support channel. Include store name, approximate time (UTC), what you clicked, and any error text shown on screen.
