/** Bulk invoice PDF/ZIP artifacts in Storage — purged by cron after this window; UI shows matching expiry. */
export const BULK_INVOICE_ARTIFACT_RETENTION_DAYS = 3;
export const BULK_INVOICE_ARTIFACT_RETENTION_MS =
  BULK_INVOICE_ARTIFACT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
