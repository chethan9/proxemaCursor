/** Per-environment Polar product/price IDs on a plan row (plans.polar_refs jsonb). */
export type PolarPlanEnvRefs = {
  product_id: string;
  price_id?: string;
  synced_at?: string;
};

export type PolarPlanRefs = Partial<Record<"sandbox" | "production", PolarPlanEnvRefs>>;

export type PolarAiCreditsEnvRefs = {
  product_id: string;
  synced_at?: string;
};

export type PolarAiCreditsRefs = Partial<Record<"sandbox" | "production", PolarAiCreditsEnvRefs>>;

export function parsePolarPlanRefs(raw: unknown): PolarPlanRefs {
  if (!raw || typeof raw !== "object") return {};
  return raw as PolarPlanRefs;
}

export function getPolarPlanEnvRefs(raw: unknown, env: "sandbox" | "production"): PolarPlanEnvRefs | null {
  const refs = parsePolarPlanRefs(raw);
  return refs[env] ?? null;
}
