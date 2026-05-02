import type { NextApiRequest, NextApiResponse } from "next";
import { assertStoreAccess } from "@/lib/assert-store-access";
import { resolveUserFromRequest } from "@/lib/server-auth";
import { signIntegrationPayload, WP_STATE_TTL_MS } from "@/lib/integration-state.server";

/**
 * Returns a short-lived signed `state` query value for WordPress application-password redirect URLs.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const storeId = typeof req.query.storeId === "string" ? req.query.storeId.trim() : "";
  if (!storeId) return res.status(400).json({ error: "storeId required" });

  const user = await resolveUserFromRequest(req);
  if (!user?.userId) return res.status(401).json({ error: "Unauthorized" });

  const gate = await assertStoreAccess(user.userId, storeId);
  if (gate.allowed === false) return res.status(gate.status).json({ error: gate.message });

  const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo.trim() : null;

  const state = signIntegrationPayload({
    kind: "wp",
    userId: user.userId,
    storeId,
    returnTo: returnTo && returnTo.startsWith("/") ? returnTo : null,
    exp: Date.now() + WP_STATE_TTL_MS,
  });

  return res.status(200).json({ state });
}
