---
title: Proxima rebrand cleanup, billing/pricing nav items, home page audit
status: todo
priority: urgent
type: bug
tags: [branding, navigation, polish]
created_by: agent
created_at: 2026-04-23T06:10:00Z
position: 161
---

## Notes

Three linked fixes discovered from user screenshot of /pricing page.

**Evidence from screenshot:**
- Sidebar correctly shows "Proxima" (BrandingProvider works)
- Header of main content shows "WooSync" — this is the hardcoded string in `src/pages/pricing.tsx` line 32: `<Link href="/" className="font-semibold">WooSync</Link>`
- Sidebar has: Projects / Health / Clients / Developer / Administration / Settings — no link to Billing, Pricing, or Payment Methods pages despite those pages existing

**1 — WooSync → Proxima sweep**

The brand is Proxima. "WooSync" must not appear in any user-visible copy (page titles, headers, buttons, toast messages, SEO defaults). It's fine to keep in internal package names, repo URLs, commit messages.

Files known to contain the literal "WooSync":
- `src/pages/pricing.tsx` — header link (visible in screenshot)
- `src/pages/index.tsx` — check "Welcome to Proxima" already there, but check page copy and SEO
- `src/components/SEO.tsx` — check default title/description
- `src/pages/_document.tsx` — check static SEO defaults
- `src/components/SyncProgressBanner.tsx` — task-74 mentions toast message "your store is live on Proxima" (verify)
- Any page title passed to AppLayout (`<AppLayout title="...">`)

The build agent should grep the entire `src/` tree for `WooSync` and `woosync` (case insensitive) and replace all user-visible instances with `Proxima` / `proxima`. Leave `package.json` name + any import paths untouched.

**2 — Add billing / pricing / payment methods to navigation**

Recently shipped pages that have no nav entry yet:
- `/pricing` — public page, should be accessible for signed-in users too (link in Settings menu OR in user dropdown)
- `/billing` — user's own billing dashboard
- `/billing/payment-methods` — saved cards management
- `/settings/plans` — already in sidebar admin group (verify)

Sidebar structure lives in `src/components/layout/AppSidebar.tsx` (large file — scan for existing item definitions to match the pattern). Decision for where each goes:
- Add a top-level "Billing" group / section for regular users (above or below "Settings") containing:
  - Billing overview → `/billing`
  - Payment methods → `/billing/payment-methods`
  - View plans → `/pricing`
- Keep `/settings/plans` in the admin/super-admin group (for managing the plan catalog, not subscribing)

If sidebar groups use the menu-editor system (`src/lib/menu-registry.ts` + menu config DB), add the new items through that registry so they survive customization. Otherwise hard-code into AppSidebar like the existing items.

**3 — Home page audit**

`src/pages/index.tsx` already says "Welcome to Proxima" on the empty state. User said "fix home page" — check for:
- Any leftover WooSync strings (page description, SEO title via AppLayout or SEO component)
- Visual regression: empty state render path, redirect-to-/projects path for users with a stored default_landing_path
- Layout issues visible in the screenshot context

If nothing else broken, the home page fix is just the WooSync rename from item 1.

## Checklist

- [ ] `grep -ri "woosync" src/ public/` and replace every user-visible instance with "Proxima" (preserve case: "WooSync" → "Proxima", "woosync" → "proxima")
- [ ] Fix `src/pages/pricing.tsx` header link text from "WooSync" to "Proxima" — confirmed visible in screenshot
- [ ] Check `src/components/SEO.tsx` default title + description — update to Proxima if WooSync still lurks
- [ ] Check `src/pages/_document.tsx` static SEOElements defaults — update to Proxima
- [ ] Check any toast / banner / empty-state copy in `src/components/**/*.tsx` for WooSync literals
- [ ] Add "Billing" menu section to `src/components/layout/AppSidebar.tsx` with items: Billing overview (`/billing`), Payment methods (`/billing/payment-methods`), Plans/Pricing (`/pricing`)
- [ ] Use CreditCard / Receipt / DollarSign icons from lucide-react for the new menu items (verify they exist in the installed version before committing)
- [ ] If menu system is registry-driven via `src/lib/menu-registry.ts`, register the new items there instead of hard-coding — check existing pattern
- [ ] Verify home page `src/pages/index.tsx` renders Proxima everywhere (title, empty state, any stat labels) — no WooSync literals
- [ ] Run the app locally, visit /, /pricing, /billing and confirm no WooSync text appears anywhere in the rendered DOM

## Acceptance

- Search the running app for "WooSync" in any rendered text — zero matches
- Signed-in user can navigate from sidebar to /billing, /billing/payment-methods, and /pricing with one click each
- Super admins still see "Plans" under admin group (existing), now also see the Billing section like regular users
- Home page opening shot matches screenshot aesthetic with "Proxima" wherever "WooSync" used to appear
