import { Polar } from "@polar-sh/sdk";
import { getEffectiveSecret } from "./config";
import { getPolarServerEnv, polarServerToSdk } from "./polar-env.server";

let cached: { client: Polar; ts: number; token: string; server: string } | null = null;
const TTL_MS = 30_000;

export async function getPolarClient(): Promise<Polar> {
  const serverEnv = await getPolarServerEnv();
  const server = polarServerToSdk(serverEnv);
  const token = await getEffectiveSecret("polar", "POLAR_ACCESS_TOKEN");
  if (!token) throw new Error("Polar not configured (POLAR_ACCESS_TOKEN)");

  if (cached && cached.token === token && cached.server === server && Date.now() - cached.ts < TTL_MS) {
    return cached.client;
  }

  const client = new Polar({
    accessToken: token,
    server,
  });
  cached = { client, ts: Date.now(), token, server };
  return client;
}
