import type { NextApiRequest, NextApiResponse } from "next";
import { resolveUserFromRequest } from "@/lib/server-auth";
import { applyAttribution } from "@/services/referralService.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const me = await resolveUserFromRequest(req);
  if (!me) return res.status(401).json({ error: "Unauthorized" });
  if (!me.clientId) return res.status(400).json({ error: "Profile is not associated with a client" });

  const code = String((req.body?.code ?? "")).trim();
  if (!code) return res.status(400).json({ error: "Referral code required" });
  if (code.length > 64) return res.status(400).json({ error: "Invalid referral code" });

  try {
    const attribution = await applyAttribution({
      code,
      referredClientId: me.clientId,
      metadata: {
        ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0] || null,
        user_agent: req.headers["user-agent"] || null,
      },
    });
    if (!attribution) return res.status(404).json({ error: "Referral code not found or program disabled" });
    return res.status(200).json({ attribution });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to attribute referral";
    return res.status(400).json({ error: msg });
  }
}
