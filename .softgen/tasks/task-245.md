---
title: Numeric input audit — strict price + stock validation everywhere
status: done
priority: medium
type: chore
tags: [products, validation]
created_by: agent
created_at: 2026-04-27T11:40:00Z
position: 245
---

## Notes

Shared `NumberInput` primitive (`src/components/ui/number-input.tsx`) applied across price/stock fields; server validation rejects malformed payloads.

## Checklist

- [x] NumberInput primitive with integer/decimal/negative gating
- [x] Applied to all product price/stock fields
- [x] Server-side validation rejects NaN / malformed numbers