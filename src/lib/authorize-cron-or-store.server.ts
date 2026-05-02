import type { NextApiRequest } from "next";
import { assertStoreAccess } from "@/lib/assert-store-access";
import { resolveUserFromRequest } from "@/lib/server-auth";

export type GateResult = { ok: true } | { ok: false; status: number; message: string };

/**
 * Allow either CRON_SECRET bearer (trusted workers) or a logged-in user with access to the store.
 */
export async function authorizeCronOrStoreMember(req: NextApiRequest, storeId: string): Promise<GateResult> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.authorization;
  if (cronSecret && auth === `Bearer ${cronSecret}`) {
    return { ok: true as const };
  }

  const user = await resolveUserFromRequest(req);
  if (!user?.userId) {
    return { ok: false as const, status: 401, message: "Unauthorized" };
  }

  const gate = await assertStoreAccess(user.userId, storeId);
  if (gate.allowed === false) {
    return { ok: false as const, status: gate.status, message: gate.message };
  }
  return { ok: true as const };
}

export function cronHeaders(): Record<string, string> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (cronSecret) h.Authorization = `Bearer ${cronSecret}`;
  return h;
}
