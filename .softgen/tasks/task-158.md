---
title: Public pricing page + currency detection + upgrade/downgrade flow
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

**Currency detection cascade (for anonymous visitors):**
1. Cloudflare `cf-ipcountry` request header (when present)
2. `x-forwarded-for` → server-side lookup via a cached ipapi.co call (fall back silently on failure)
3. `Intl.DateTimeFormat().resolvedOptions().timeZone` → rough country guess (client-side hint passed as query param on first load)
4. Default: US / USD

Detected currency is shown by default; a small switcher in the pricing header lets visitors change country → currency manually. Stored in localStorage for return visits.

**Logged-in users** always see their account's currency (from `clients.currency`), with the same switcher available if they want to compare regions.

**Layout:** 4 pricing cards side-by-side on desktop, stacked on mobile. Popular plan (Growth) highlighted with "Most popular" ribbon. Yearly toggle shows 2 months free equivalent.

## Checklist
- [ ] `/pricing` public route with 4 plan cards pulling from `plans` table
- [ ] Each card: name, price rendered in resolved currency (falls back to "Contact us" if plan has no price in that currency), key features list, quota highlights, CTA button
- [ ] Country/currency switcher in header: dropdown of supported countries grouped by region (Middle East / Asia / Americas / Europe / Africa), auto-picked on first visit, sticky via localStorage
- [ ] Server-side country detection via middleware → passed as initial prop; client-side switcher overrides without page reload
- [ ] Monthly/Yearly toggle at top: yearly shows "-17%" badge (or computed from actual prices), values update per currency
- [ ] FAQ section below cards: 8 common questions (currency accepted, can I change country later, what if my country isn't listed, can I cancel, quota handling, etc)
- [ ] Logged-in state: current plan card marked, others show "Upgrade" (higher) or "Downgrade" (lower); prices always in user's account currency
- [ ] Enterprise card has "Contact Sales" button → opens prefilled mailto or contact form
- [ ] Clicking Upgrade: immediate flow via checkout (task-152), prorated prompt shown before redirect
- [ ] Clicking Downgrade: scheduled for next period, confirmation dialog explains "Change applies on {period_end}"
- [ ] Plan changes write to activity_log + subscription_events

## Acceptance
- Anonymous visitor from Kuwait (or using KW VPN) lands on /pricing and sees prices in KWD without any click; switcher reflects "Kuwait / KWD"
- Anonymous visitor from India lands on /pricing and sees prices in INR; switcher reflects "India / INR"
- Visitor switches country to "United States / USD" → prices update without reload; selection persists on return
- Logged-in Kuwaiti customer on Starter clicks Upgrade to Growth → MyFatoorah checkout in KWD
- Logged-in Indian customer on Scale clicks Downgrade to Growth → dialog confirms period-end date → scheduled change shows in /billing in INR
- Plan with no price in the visitor's currency shows "Contact us" instead of a number, disables the Subscribe button, and shows sales email link