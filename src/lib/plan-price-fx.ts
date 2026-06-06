import { supabase } from "@/integrations/supabase/client";
import { SUPPORTED_CURRENCIES, type Currency } from "@/services/planService";

const THREE_DECIMAL_CURRENCIES = new Set(["KWD", "BHD", "OMR"]);

type FxPayload = {
  base?: string;
  rates?: Record<string, number>;
};

/** Minor units (cents / fils) from major amount. */
export function majorToMinor(amountMajor: number, currency: string): number {
  const factor = THREE_DECIMAL_CURRENCIES.has(currency) ? 1000 : 100;
  return Math.round(amountMajor * factor);
}

export function minorToMajor(amountMinor: number, currency: string): number {
  const factor = THREE_DECIMAL_CURRENCIES.has(currency) ? 1000 : 100;
  return amountMinor / factor;
}

/** Rates: units of each currency per 1 USD. */
function eurPayloadToUsdRates(payload: FxPayload): Record<string, number> | null {
  if (payload.base !== "EUR" || !payload.rates?.USD) return null;
  const usdPerEur = payload.rates.USD;
  if (!usdPerEur) return null;
  const out: Record<string, number> = { USD: 1 };
  for (const [cur, perEur] of Object.entries(payload.rates)) {
    if (cur === "USD") continue;
    out[cur] = perEur / usdPerEur;
  }
  return out;
}

async function fetchFxRatesFromDb(): Promise<Record<string, number> | null> {
  const { data, error } = await supabase
    .from("global_fx_rates")
    .select("payload, updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data?.payload) return null;

  const payload = data.payload as FxPayload;
  const fromEur = eurPayloadToUsdRates(payload);
  if (fromEur) return fromEur;

  if (payload.base === "USD" && payload.rates) {
    return { USD: 1, ...payload.rates };
  }
  return null;
}

async function fetchFxRatesFromFrankfurter(): Promise<Record<string, number>> {
  const res = await fetch("https://api.frankfurter.app/latest?from=USD");
  if (!res.ok) throw new Error("FX fetch failed");
  const body = (await res.json()) as { rates?: Record<string, number> };
  return { USD: 1, ...(body.rates ?? {}) };
}

export async function fetchUsdFxRates(): Promise<Record<string, number>> {
  try {
    const fromDb = await fetchFxRatesFromDb();
    if (fromDb) return fromDb;
  } catch {
    /* fall through */
  }
  return fetchFxRatesFromFrankfurter();
}

/** Derive all supported currency minor amounts from a USD minor anchor. */
export function derivePricesFromUsdMinor(
  usdMinor: number,
  usdRates: Record<string, number>,
  skip: ReadonlySet<string> = new Set(),
): Partial<Record<Currency, number>> {
  const usdMajor = minorToMajor(usdMinor, "USD");
  const out: Partial<Record<Currency, number>> = { USD: usdMinor };

  for (const cur of SUPPORTED_CURRENCIES) {
    if (cur === "USD" || skip.has(cur)) continue;
    const rate = usdRates[cur];
    if (typeof rate !== "number" || !Number.isFinite(rate)) continue;
    out[cur] = majorToMinor(usdMajor * rate, cur);
  }

  return out;
}
