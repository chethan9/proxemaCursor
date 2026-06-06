import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getPolarClient } from "./polar-client.server";
import { getPolarServerEnv } from "./polar-env.server";
import {
  getPolarPlanEnvRefs,
  parsePolarPlanRefs,
  type PolarPlanEnvRefs,
  type PolarPlanRefs,
} from "./polar-types";

type PlanRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  prices: Record<string, number> | null;
  billing_interval: string;
  trial_days: number;
  polar_refs: unknown;
};

function primaryPriceMinor(prices: Record<string, number> | null): { amountMinor: number; currency: string } {
  const p = prices || {};
  const currency =
    p.USD != null ? "USD" : Object.keys(p).find((k) => typeof p[k] === "number") ?? "USD";
  const major = p[currency] ?? 0;
  return { amountMinor: Math.round(major * 100), currency };
}

function recurringInterval(interval: string): "month" | "year" {
  return interval === "year" ? "year" : "month";
}

export async function syncPlanToPolar(planId: string): Promise<{ env: string; refs: PolarPlanEnvRefs }> {
  const { data: plan, error } = await supabaseAdmin.from("plans").select("*").eq("id", planId).single();
  if (error || !plan) throw new Error(error?.message || "Plan not found");

  const row = plan as PlanRow;
  if (row.slug === "enterprise" || (row.prices && Object.keys(row.prices).length === 0)) {
    throw new Error("Enterprise/custom plans are not synced to Polar");
  }

  const env = await getPolarServerEnv();
  const polar = await getPolarClient();
  const { amountMinor, currency } = primaryPriceMinor(row.prices);
  if (amountMinor <= 0) throw new Error("Plan has no price to sync");

  const existing = getPolarPlanEnvRefs(row.polar_refs, env);
  const interval = recurringInterval(row.billing_interval);
  const trialInterval = row.trial_days > 0 ? ("day" as const) : null;
  const trialIntervalCount = row.trial_days > 0 ? row.trial_days : null;

  let productId = existing?.product_id;
  let priceId = existing?.price_id;

  if (productId) {
    await polar.products.update({
      id: productId,
      productUpdate: {
        name: row.name,
        description: row.description ?? undefined,
      },
    });
  } else {
    const created = await polar.products.create({
      name: row.name,
      description: row.description ?? `Proxima plan: ${row.slug}`,
      recurringInterval: interval,
      recurringIntervalCount: 1,
      trialInterval,
      trialIntervalCount,
      metadata: { proxima_plan_id: row.id, proxima_plan_slug: row.slug },
      prices: [
        {
          amountType: "fixed",
          priceAmount: amountMinor,
          priceCurrency: currency.toLowerCase() as "usd",
        },
      ],
    });
    productId = created.id;
    const fixed = created.prices?.find((p) => p.amountType === "fixed");
    priceId = fixed?.id;
  }

  if (!priceId && productId) {
    const fetched = await polar.products.get({ id: productId });
    const fixed = fetched.prices?.find((p) => p.amountType === "fixed");
    priceId = fixed?.id;
  }

  const envRefs: PolarPlanEnvRefs = {
    product_id: productId!,
    price_id: priceId,
    synced_at: new Date().toISOString(),
  };

  const merged: PolarPlanRefs = { ...parsePolarPlanRefs(row.polar_refs), [env]: envRefs };
  await supabaseAdmin.from("plans").update({ polar_refs: merged as never }).eq("id", planId);

  return { env, refs: envRefs };
}

export async function ensurePlanPolarRefs(planId: string): Promise<PolarPlanEnvRefs> {
  const env = await getPolarServerEnv();
  const { data: plan } = await supabaseAdmin.from("plans").select("polar_refs").eq("id", planId).single();
  const existing = getPolarPlanEnvRefs(plan?.polar_refs, env);
  if (existing?.product_id) return existing;
  const { refs } = await syncPlanToPolar(planId);
  return refs;
}

export async function syncAllPlansToPolar(): Promise<Array<{ planId: string; ok: boolean; error?: string }>> {
  const { data: plans } = await supabaseAdmin.from("plans").select("id, slug, is_custom").eq("is_active", true);
  const results: Array<{ planId: string; ok: boolean; error?: string }> = [];
  for (const p of plans || []) {
    if (p.is_custom || p.slug === "enterprise") continue;
    try {
      await syncPlanToPolar(p.id);
      results.push({ planId: p.id, ok: true });
    } catch (e) {
      results.push({ planId: p.id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}
