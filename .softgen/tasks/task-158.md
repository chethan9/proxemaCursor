---
title: Public pricing page + country/currency detection + Subscribe flow
status: done
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
1. Cloudflare `cf-ipcountry` request header (when present) ✅
2. Vercel `x-vercel-ip-country` header (fallback) ✅
3. `Intl.DateTimeFormat().resolvedOptions().timeZone` → client-side country guess ✅
4. Default: US / USD ✅

Detected currency is shown by default; a regional switcher in the pricing header lets visitors change country → currency manually. Stored in localStorage for return visits.

**Logged-in users** always see their account's currency (from `clients.currency`), with the same switcher available if they want to compare regions.

## Checklist
- [x] `/pricing` public route with plan cards pulling from `plans` table
- [x] Each card: name, price in resolved currency, CTA button
- [x] Server-side `cf-ipcountry` detection via gSSP
- [x] `x-vercel-ip-country` as secondary gSSP source
- [x] Timezone heuristic as client-side fallback
- [x] localStorage persistence for visitor currency choice
- [x] Falls back to "Contact sales" mailto if plan has no price in selected currency
- [x] Country/currency switcher with regions grouped (Middle East / Asia / Europe / Americas / Oceania / Africa)
- [x] Monthly/Yearly billing toggle at top with "-17%" badge
- [x] "Most popular" ribbon on the Growth plan card
- [x] Plan card: feature list, quota highlights (max sites / products / users / API calls), trial days CTA variant
- [x] FAQ section below cards with 8 common questions
- [x] Logged-in: mark current plan card, show "Upgrade"/"Downgrade" buttons based on position, use user's account currency
- [x] Enterprise "Contact Sales" card with mailto
- [x] Upgrade flow: prorated prompt dialog before redirecting to checkout
- [x] Downgrade flow: "Change applies on {period_end}" confirmation dialog, schedule via subscriptions.pending_plan_id + subscription_events
- [x] Write activity_log + subscription_events entries on plan change request

## Acceptance
- Anonymous visitor from Kuwait (KW header) lands on /pricing and sees prices in KWD; switcher reflects "Kuwait · KWD"
- Anonymous visitor from India sees INR; switcher reflects "India · INR"
- Visitor switches country to "United States · USD" → prices update without reload; selection persists on return (localStorage)
- Logged-in Kuwaiti customer on Starter clicks Upgrade to Growth → prorated dialog → MyFatoorah checkout in KWD
- Logged-in Indian customer on Scale clicks Downgrade to Growth → dialog confirms period-end date → scheduled change written to subscriptions.pending_plan_id with activity_log entry
- Plan with no price in visitor's currency shows "Contact sales" button that opens mailto
