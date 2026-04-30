import type { GatewayName } from "./types";

export type PaymentRegionRoutingRow = {
  country_code: string;
  gateway: string;
  enabled?: boolean | null;
  priority?: number | null;
};

export const MYFATOORAH_COUNTRIES = ["KW", "SA", "AE", "BH", "OM", "QA", "JO"] as const;

function normalizeGatewayId(g: string): GatewayName {
  const x = g.toLowerCase();
  if (x === "myfatoorah" || x === "razorpay" || x === "tap") return x;
  return "razorpay";
}

/**
 * Pick gateway from admin-configured rows: exact ISO country match (by lowest priority),
 * else wildcard row with country_code '*', else legacy hardcoded map.
 */
export function resolveGatewayFromRouting(
  country: string | null | undefined,
  rows: PaymentRegionRoutingRow[],
): GatewayName {
  const upper = (country || "US").toUpperCase();
  const active = rows.filter((r) => r.enabled !== false);
  const sorted = [...active].sort((a, b) => (a.priority ?? 1) - (b.priority ?? 1));

  const exact = sorted.filter((r) => r.country_code.toUpperCase() === upper);
  if (exact.length) return normalizeGatewayId(exact[0].gateway);

  const wildcard = sorted.filter((r) => r.country_code === "*");
  if (wildcard.length) return normalizeGatewayId(wildcard[0].gateway);

  return getGatewayForCountry(country);
}

const COUNTRY_CURRENCY: Record<string, string> = {
  KW: "KWD", SA: "SAR", AE: "AED", BH: "BHD", OM: "OMR", QA: "QAR", JO: "JOD",
  IN: "INR",
  US: "USD", GB: "GBP", CA: "CAD", AU: "AUD",
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", BE: "EUR", IE: "EUR", AT: "EUR", PT: "EUR", FI: "EUR",
  SG: "SGD", MY: "MYR", JP: "JPY", BR: "BRL", MX: "MXN", ZA: "ZAR", NZ: "NZD", TH: "THB", ID: "IDR", PH: "PHP",
  CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN",
};

const ALL_COUNTRIES: { code: string; name: string; currency: string; region: string }[] = [
  { code: "KW", name: "Kuwait", currency: "KWD", region: "Middle East" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", region: "Middle East" },
  { code: "AE", name: "United Arab Emirates", currency: "AED", region: "Middle East" },
  { code: "BH", name: "Bahrain", currency: "BHD", region: "Middle East" },
  { code: "OM", name: "Oman", currency: "OMR", region: "Middle East" },
  { code: "QA", name: "Qatar", currency: "QAR", region: "Middle East" },
  { code: "JO", name: "Jordan", currency: "JOD", region: "Middle East" },
  { code: "IN", name: "India", currency: "INR", region: "Asia" },
  { code: "SG", name: "Singapore", currency: "SGD", region: "Asia" },
  { code: "MY", name: "Malaysia", currency: "MYR", region: "Asia" },
  { code: "TH", name: "Thailand", currency: "THB", region: "Asia" },
  { code: "ID", name: "Indonesia", currency: "IDR", region: "Asia" },
  { code: "PH", name: "Philippines", currency: "PHP", region: "Asia" },
  { code: "JP", name: "Japan", currency: "JPY", region: "Asia" },
  { code: "US", name: "United States", currency: "USD", region: "Americas" },
  { code: "CA", name: "Canada", currency: "CAD", region: "Americas" },
  { code: "MX", name: "Mexico", currency: "MXN", region: "Americas" },
  { code: "BR", name: "Brazil", currency: "BRL", region: "Americas" },
  { code: "GB", name: "United Kingdom", currency: "GBP", region: "Europe" },
  { code: "DE", name: "Germany", currency: "EUR", region: "Europe" },
  { code: "FR", name: "France", currency: "EUR", region: "Europe" },
  { code: "ES", name: "Spain", currency: "EUR", region: "Europe" },
  { code: "IT", name: "Italy", currency: "EUR", region: "Europe" },
  { code: "NL", name: "Netherlands", currency: "EUR", region: "Europe" },
  { code: "CH", name: "Switzerland", currency: "CHF", region: "Europe" },
  { code: "SE", name: "Sweden", currency: "SEK", region: "Europe" },
  { code: "NO", name: "Norway", currency: "NOK", region: "Europe" },
  { code: "DK", name: "Denmark", currency: "DKK", region: "Europe" },
  { code: "PL", name: "Poland", currency: "PLN", region: "Europe" },
  { code: "AU", name: "Australia", currency: "AUD", region: "Oceania" },
  { code: "NZ", name: "New Zealand", currency: "NZD", region: "Oceania" },
  { code: "ZA", name: "South Africa", currency: "ZAR", region: "Africa" },
];

export function getSupportedCountries() {
  return ALL_COUNTRIES;
}

export function getGatewayForCountry(country: string | null | undefined, overrides?: Record<string, GatewayName>): GatewayName {
  if (!country) return "razorpay";
  const upper = country.toUpperCase();
  if (overrides && overrides[upper]) return overrides[upper];
  if ((MYFATOORAH_COUNTRIES as readonly string[]).includes(upper)) return "myfatoorah";
  return "razorpay";
}

export function getDefaultCurrencyForCountry(country: string | null | undefined): string {
  if (!country) return "USD";
  return COUNTRY_CURRENCY[country.toUpperCase()] || "USD";
}

export function isMiddleEastCountry(country: string | null | undefined): boolean {
  if (!country) return false;
  return (MYFATOORAH_COUNTRIES as readonly string[]).includes(country.toUpperCase());
}

const TIMEZONE_COUNTRY_MAP: Record<string, string> = {
  "Asia/Kuwait": "KW",
  "Asia/Riyadh": "SA",
  "Asia/Dubai": "AE",
  "Asia/Bahrain": "BH",
  "Asia/Muscat": "OM",
  "Asia/Qatar": "QA",
  "Asia/Amman": "JO",
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Asia/Singapore": "SG",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Bangkok": "TH",
  "Asia/Jakarta": "ID",
  "Asia/Manila": "PH",
  "Asia/Tokyo": "JP",
  "Europe/London": "GB",
  "Europe/Berlin": "DE",
  "Europe/Paris": "FR",
  "Europe/Madrid": "ES",
  "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE",
  "Europe/Vienna": "AT",
  "Europe/Lisbon": "PT",
  "Europe/Zurich": "CH",
  "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK",
  "Europe/Warsaw": "PL",
  "Europe/Dublin": "IE",
  "Europe/Helsinki": "FI",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Los_Angeles": "US",
  "America/Denver": "US",
  "America/Phoenix": "US",
  "America/Anchorage": "US",
  "Pacific/Honolulu": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Montreal": "CA",
  "America/Mexico_City": "MX",
  "America/Sao_Paulo": "BR",
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Australia/Perth": "AU",
  "Australia/Brisbane": "AU",
  "Pacific/Auckland": "NZ",
  "Africa/Johannesburg": "ZA",
};

export function getBrowserTimezoneCountry(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONE_COUNTRY_MAP[tz] ?? null;
  } catch {
    return null;
  }
}

type HeaderBag = { headers: Record<string, string | string[] | undefined> };

export function resolveCountry(req: HeaderBag): { country: string; currency: string; source: "cloudflare" | "vercel" | "default" } {
  const get = (k: string): string | undefined => {
    const v = req.headers[k] ?? req.headers[k.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  };
  const cf = get("cf-ipcountry");
  if (cf && cf.length === 2 && cf !== "XX") {
    const country = cf.toUpperCase();
    return { country, currency: getDefaultCurrencyForCountry(country), source: "cloudflare" };
  }
  const vercel = get("x-vercel-ip-country");
  if (vercel && vercel.length === 2) {
    const country = vercel.toUpperCase();
    return { country, currency: getDefaultCurrencyForCountry(country), source: "vercel" };
  }
  return { country: "US", currency: "USD", source: "default" };
}