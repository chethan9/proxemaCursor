function parseWooDateValue(value: unknown, assumeUtcWhenMissingOffset: boolean): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  const hasOffset = /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(raw);
  const candidate = assumeUtcWhenMissingOffset && !hasOffset ? `${raw}Z` : raw;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

/**
 * WooCommerce typically sends both local and GMT timestamps.
 * Prefer GMT to avoid timezone ambiguity when persisting into timestamptz columns.
 */
export function normalizeWooDate(localValue: unknown, gmtValue?: unknown): string | null {
  return (
    parseWooDateValue(gmtValue, true) ??
    parseWooDateValue(localValue, false)
  );
}
