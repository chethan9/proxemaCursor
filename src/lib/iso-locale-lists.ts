import { REGION_CURRENCY_CODES } from "@/lib/region-countries";

const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };

/** ISO 3166-1 alpha-2 codes (excludes non-country / special region codes). */
export function listIsoRegionCodes(): string[] {
  try {
    if (typeof intl.supportedValuesOf === "function") {
      return intl
        .supportedValuesOf("region")
        .filter((c) => /^[A-Z]{2}$/.test(c) && !["ZZ", "XA", "XB", "EU", "UN"].includes(c))
        .sort((a, b) => a.localeCompare(b));
    }
  } catch {
    /* ignore */
  }
  return ["AE", "AU", "BH", "CA", "DE", "FR", "GB", "IN", "JO", "JP", "KW", "OM", "QA", "SA", "SG", "US"];
}

/** ISO 4217 currency codes when supported; otherwise region-derived list. */
export function listIsoCurrencyCodes(): string[] {
  try {
    if (typeof intl.supportedValuesOf === "function") {
      return intl
        .supportedValuesOf("currency")
        .filter((c) => /^[A-Z]{3}$/.test(c))
        .sort((a, b) => a.localeCompare(b));
    }
  } catch {
    /* ignore */
  }
  return [...REGION_CURRENCY_CODES];
}

export function regionLabel(code: string, lang: string): string {
  try {
    const dn = new Intl.DisplayNames([lang || "en"], { type: "region" });
    return dn.of(code) || code;
  } catch {
    return code;
  }
}

export function currencyLabel(code: string, lang: string): string {
  try {
    const dn = new Intl.DisplayNames([lang || "en"], { type: "currency" });
    const name = dn.of(code);
    return name ? `${code} — ${name}` : code;
  } catch {
    return code;
  }
}
