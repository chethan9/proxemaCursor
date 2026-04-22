import type { NextApiRequest, NextApiResponse } from "next";
import { getAllGateways, getGatewayForCountry, getDefaultCurrencyForCountry } from "@/lib/payments";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { country } = req.query;
  const countryCode = typeof country === "string" ? country.toUpperCase() : undefined;

  const gateways = getAllGateways().map((g) => ({
    name: g.name,
    configured: g.isConfigured(),
    supportedCurrencies: g.supportedCurrencies(),
  }));

  const resolved = countryCode
    ? {
        country: countryCode,
        gateway: getGatewayForCountry(countryCode),
        currency: getDefaultCurrencyForCountry(countryCode),
      }
    : null;

  return res.status(200).json({ gateways, resolved });
}