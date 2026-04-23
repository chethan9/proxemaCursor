---
title: Public pricing page + country/currency detection + Subscribe flow
status: todo
priority: medium
type: feature
tags: [billing, marketing, pricing, currency]
created_by: agent
created_at: 2026-04-22T22:20:00Z
position: 158
---

## Notes
The "how much?" page. Public (no login needed) with CTA to signup or upgrade.

**Status (as of 2026-04-23):** stub implementation only. `pricing.tsx` shows 4 cards with price + basic info; `CurrencySwitcher.tsx` is a flat 7-currency dropdown; no FAQ, no yearly toggle, no current-plan marking, no upgrade/downgrade flow, no localStorage persistence, no IP/timezone fallback chain. Real work still ahead.

**Currency detection cascade (for anonymous visitors):**
1. Cloudflare `cf-ipcountry` request header (when present) ✅ wired
2. `x-forwarded-for` → server-side lookup via a cached ipapi.co call (fall back silently on failure)
3. `Intl.DateTimeFormat().resolvedOptions().timeZone` → rough country guess (client-side hint passed as query param on first load)
4. Default: US / USD ✅ wired

Detected currency is shown by default; a small switcher in the pricing header lets visitors change country → currency manually. Stored in localStorage for return visits.

**Logged-in users** always see their account's currency (from `clients.currency`), with the same switcher available if they want to compare regions.

**Layout:** 4 pricing cards side-by-side on desktop, stacked on mobile. Popular plan (Growth) highlighted with "Most popular" ribbon. Yearly toggle shows 2 months free equivalent.

## Checklist
- [x] `/pricing` public route with plan cards pulling from `plans` table
- [x] Each card: name, price in resolved currency, CTA button
- [x] Server-side `cf-ipcountry` detection via gSSP
- [ ] Falls back to "Contact us" if plan has no price in that currency — currently disables button but doesn't show sales email
- [ ] Country/currency switcher with regions grouped (Middle East / Asia / Americas / Europe / Africa) — currently flat 7-currency list
- [ ] `x-forwarded-for` → ipapi.co server-side fallback when `cf-ipcountry` absent
- [ ] Timezone heuristic as last fallback (client-side)
- [ ] localStorage persistence for visitor currency choice
- [ ] Monthly/Yearly billing toggle at top with "-17%" badge computed from actual prices
- [ ] "Most popular" ribbon on the Growth plan card
- [ ] Plan card: feature list, quota highlights (max sites / products / users), trial days CTA variant
- [ ] FAQ section below cards: 8 common questions (currency accepted, change country later, missing country, cancel, quota handling, etc.)
- [ ] Logged-in: mark current plan card, show "Upgrade"/"Downgrade" buttons based on position, use user's account currency
- [ ] Enterprise "Contact Sales" card with mailto or contact form
- [ ] Upgrade flow: prorated prompt dialog before redirecting to checkout
- [ ] Downgrade flow: "Change applies on {period_end}" confirmation dialog, schedule via subscription_events
- [ ] Write activity_log + subscription_events entry on plan change request

## Acceptance
- Anonymous visitor from Kuwait (KW VPN) lands on /pricing and sees prices in KWD without a click; switcher reflects "Kuwait / KWD"
- Anonymous visitor from India lands on /pricing and sees prices in INR; switcher reflects "India / INR"
- Visitor switches country to "United States / USD" → prices update without reload; selection persists on return
- Logged-in Kuwaiti customer on Starter clicks Upgrade to Growth → MyFatoorah checkout in KWD
- Logged-in Indian customer on Scale clicks Downgrade to Growth → dialog confirms period-end date → scheduled change shows in /billing in INR
- Plan with no price in visitor's currency shows "Contact us" instead of a number, disables Subscribe button, shows sales email link
