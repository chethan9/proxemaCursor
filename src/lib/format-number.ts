/**
 * Locale-aware number, currency, and date formatters.
 *
 * Pair with `useRouter().locale` or `i18n.language` from next-i18next.
 * Defaults to "en" when no locale is provided.
 *
 * For Arabic, we force Latin (Western Arabic) numerals via the `-u-nu-latn`
 * extension so operator dashboards stay readable across locales. If a future
 * project wants Arabic-Indic numerals, remove the resolveLocale mapping.
 */

function resolveLocale(locale?: string | null): string {
  if (!locale) return "en";
  if (locale.startsWith("ar")) return "ar-u-nu-latn";
  return locale;
}

export function formatNumber(
  value: number | null | undefined,
  locale?: string | null,
  options?: Intl.NumberFormatOptions
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  try {
    return new Intl.NumberFormat(resolveLocale(locale), options).format(value);
  } catch {
    return String(value);
  }
}

export function formatCurrency(
  value: number | null | undefined,
  currency: string,
  locale?: string | null,
  options?: Omit<Intl.NumberFormatOptions, "style" | "currency">
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  try {
    return new Intl.NumberFormat(resolveLocale(locale), {
      style: "currency",
      currency,
      ...options,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatPercent(
  value: number | null | undefined,
  locale?: string | null,
  fractionDigits = 0
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  try {
    return new Intl.NumberFormat(resolveLocale(locale), {
      style: "percent",
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  } catch {
    return `${(value * 100).toFixed(fractionDigits)}%`;
  }
}

export function formatCompact(
  value: number | null | undefined,
  locale?: string | null
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  try {
    return new Intl.NumberFormat(resolveLocale(locale), {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return String(value);
  }
}

export function formatDate(
  value: string | number | Date | null | undefined,
  locale?: string | null,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }
): string {
  if (!value) return "—";
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat(resolveLocale(locale), options).format(d);
  } catch {
    return "—";
  }
}

export function formatDateTime(
  value: string | number | Date | null | undefined,
  locale?: string | null,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }
): string {
  if (!value) return "—";
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat(resolveLocale(locale), options).format(d);
  } catch {
    return "—";
  }
}

export function formatTime(
  value: string | number | Date | null | undefined,
  locale?: string | null,
  options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }
): string {
  return formatDateTime(value, locale, options);
}