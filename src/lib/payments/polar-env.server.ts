import { loadGatewayConfig } from "./config";

export type PolarServerEnv = "sandbox" | "production";

/** Active Polar environment key stored in plans.polar_refs and gateway extra_config. */
export async function getPolarServerEnv(): Promise<PolarServerEnv> {
  const fromEnv = process.env.POLAR_SERVER?.trim().toLowerCase();
  if (fromEnv === "production" || fromEnv === "live") return "production";
  if (fromEnv === "sandbox" || fromEnv === "test") return "sandbox";

  const cfg = await loadGatewayConfig("polar");
  if (cfg?.mode === "live") return "production";
  return "sandbox";
}

export function polarServerToSdk(server: PolarServerEnv): "sandbox" | "production" {
  return server;
}
