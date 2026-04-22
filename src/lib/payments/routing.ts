import type { GatewayName } from "./types";

export const MYFATOORAH_COUNTRIES = ["KW", "SA", "AE", "BH", "OM", "QA", "JO"] as const;

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

export function getGatewayForCountry(country: string | null | undefined): GatewayName {
  if (!country) return "razorpay";
  const upper = country.toUpperCase();
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