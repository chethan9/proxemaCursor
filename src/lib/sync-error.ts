export interface WooErrorContext {
  url?: string;
  method?: string;
  params?: Record<string, unknown>;
  status?: number;
  body?: string;
  headers?: Record<string, string>;
}

export class WooApiError extends Error {
  context: WooErrorContext;
  constructor(message: string, context: WooErrorContext) {
    super(message);
    this.name = "WooApiError";
    this.context = context;
  }
}

export function isRetryableError(status?: number, errName?: string): boolean {
  if (errName === "AbortError" || errName === "FetchError" || errName === "TypeError") return true;
  if (!status) return true;
  if (status === 408 || status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

const BACKOFF_SECONDS = [30, 120, 300, 900];

export function nextRetryDelaySeconds(attempt: number): number | null {
  if (attempt < 1 || attempt > BACKOFF_SECONDS.length) return null;
  return BACKOFF_SECONDS[attempt - 1];
}

export const MAX_SYNC_ATTEMPTS = 5;

export function buildCurlCommand(ctx: WooErrorContext, consumerKey?: string, consumerSecret?: string): string {
  const method = ctx.method || "GET";
  const url = ctx.url || "";
  const key = consumerKey || "$WC_KEY";
  const secret = consumerSecret || "$WC_SECRET";
  return `curl -X ${method} "${url}" -u "${key}:${secret}" -H "Accept: application/json"`;
}