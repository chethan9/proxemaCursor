/**
 * Locale-aware number and currency formatters.
 *
 * Pair with `useRouter().locale` or `i18n.language` from next-i18next to get
 * locale-aware output. For Arabic we force Latin numerals so operator
 * dashboards stay consistent with backend/log data.
 */

function resolveLocale(locale?: string | null): string | undefined {
  if (!locale) return undefined;
  if (locale.startsWith("ar")) return "ar-u-nu-latn";
  return locale;
}

export function formatNumber(
  value: number | null | undefined,
  locale?: string | null,
  options?: Intl.NumberFormatOptions
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  try {
    return new Intl.NumberFormat(resolveLocale(locale), options).format(value);
  } catch {
    return String(value);
  }
}

export function formatCurrency(
  value: number | string | null | undefined,
  currency: string | null | undefined,
  locale?: string | null,
  options?: Omit<Intl.NumberFormatOptions, "style" | "currency">
): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(n)) return "";
  const code = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(resolveLocale(locale), {
      style: "currency",
      currency: code,
      ...options,
    }).format(n);
  } catch {
    return `${code} ${n.toFixed(2)}`;
  }
}

export function formatPercent(
  value: number | null | undefined,
  locale?: string | null,
  fractionDigits = 0
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
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
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  try {
    return new Intl.NumberFormat(resolveLocale(locale), {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return String(value);
  }
}