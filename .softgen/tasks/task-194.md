---
title: Admin payment gateway & API settings panel
status: todo
priority: high
type: feature
tag
...
ed by checking the network tab goes to `/api/billing/tap/charge` instead of `/api/billing/checkout?gateway=myfatoorah`.
- Regenerating a webhook secret shows the new value exactly once in a modal, stores the encrypted form in DB, and the old value stops validating incoming webhooks immediately.
- Activity log shows every credential change with secrets masked to last 4 chars (e.g. `sk_live_••••4242`), enabling dispute resolution and security audit trails.
- Switching a gateway from Test to Live mode requires double-confirmation and logs the change with the operating admin's identity for audit purposes.


[Tool result trimmed: kept first 100 chars and last 100 chars of 13197 chars.]