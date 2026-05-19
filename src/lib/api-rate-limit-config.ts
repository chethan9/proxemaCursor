/**
 * Prefixes excluded from global `/api/*` middleware rate limiting.
 * Keep in sync with [`src/middleware.ts`](../middleware.ts).
 */
export const API_RATE_LIMIT_EXCLUDED_PREFIXES = [
  "/api/cron/",
  "/api/webhooks/",
  "/api/billing/webhooks/",
  "/api/i18n/",
  "/api/dev/",
] as const;
