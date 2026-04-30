import type { NextApiRequest, NextApiResponse } from "next";
import { getAllGateways, getDefaultCurrencyForCountry } from "@/lib/payments";
import { getResolvedGatewayForCountry } from "@/lib/payments/gateway-routing.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { country } = req.query;
  const countryCode = typeof country === "string" ? country.toUpperCase() : undefined;

  const gateways = await Promise.all(
    getAllGateways().map(async (g) => {
      const base = { name: g.name, configured: g.isConfigured(), supportedCurrencies: g.supportedCurrencies() };
      if (!g.isConfigured()) return { ...base, status: "not-configured" as const };
      try {
        const ok = await probeGateway(g.name);
        return { ...base, status: ok ? ("ok" as const) : ("error" as const) };
      } catch {
        return { ...base, status: "error" as const };
      }
    })
  );

  const resolved = countryCode
    ? {
        country: countryCode,
        gateway: await getResolvedGatewayForCountry(countryCode),
        currency: getDefaultCurrencyForCountry(countryCode),
      }
    : null;

  return res.status(200).json({ gateways, resolved });
}

async function probeGateway(name: string): Promise<boolean> {
  if (name === "tap") {
    const key = process.env.TAP_SECRET_KEY;
    if (!key) return false;
    const r = await fetch("https://api.tap.company/v2/charges?limit=1", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(3000),
    });
    return r.status < 500;
  }
  return true;
}