/** WooCommerce-style merchant industry / store focus */
export const STORE_TYPE_IDS = [
  "physical_products",
  "digital_products",
  "subscriptions_memberships",
  "services_bookings",
  "marketplace",
  "wholesale_b2b",
  "food_beverage",
  "fashion_apparel",
  "electronics_tech",
  "health_beauty",
  "home_garden",
  "other",
] as const;

export type StoreTypeId = (typeof STORE_TYPE_IDS)[number];

export const ACQUISITION_SOURCE_IDS = [
  "direct",
  "referral",
  "instagram",
  "search_engine",
  "facebook",
  "linkedin",
  "youtube",
  "tiktok",
  "podcast",
  "event",
  "other",
] as const;

export type AcquisitionSourceId = (typeof ACQUISITION_SOURCE_IDS)[number];

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function listTimeZones(): string[] {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    if (typeof intl.supportedValuesOf === "function") {
      return intl.supportedValuesOf("timeZone").slice().sort((a, b) => a.localeCompare(b));
    }
  } catch {
    /* ignore */
  }
  return FALLBACK_TIMEZONES.slice();
}
