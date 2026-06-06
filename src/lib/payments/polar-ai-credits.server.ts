import { supabaseAdmin } from "@/integrations/supabase/admin";
import { loadGatewayConfig } from "./config";
import { getPolarClient } from "./polar-client.server";
import { getPolarServerEnv } from "./polar-env.server";
import type { PolarAiCreditsRefs } from "./polar-types";

const AI_CREDITS_SETTING_KEY = "polar_ai_credits_product";

function parseAiCreditsRefs(raw: unknown): PolarAiCreditsRefs {
  if (!raw || typeof raw !== "object") return {};
  return raw as PolarAiCreditsRefs;
}

async function loadAiCreditsRefs(): Promise<PolarAiCreditsRefs> {
  const cfg = await loadGatewayConfig("polar");
  const extra = (cfg?.extra_config || {}) as Record<string, unknown>;
  return parseAiCreditsRefs(extra[AI_CREDITS_SETTING_KEY]);
}

async function saveAiCreditsRefs(refs: PolarAiCreditsRefs): Promise<void> {
  const cfg = await loadGatewayConfig("polar");
  const extra = { ...(cfg?.extra_config as Record<string, unknown> | null), [AI_CREDITS_SETTING_KEY]: refs };
  await supabaseAdmin
    .from("payment_gateway_settings")
    .upsert(
      {
        gateway_name: "polar",
        enabled: cfg?.enabled ?? true,
        mode: cfg?.mode ?? "test",
        extra_config: extra as never,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "gateway_name" },
    );
}

export async function ensurePolarAiCreditsProduct(): Promise<string> {
  const env = await getPolarServerEnv();
  const refs = await loadAiCreditsRefs();
  if (refs[env]?.product_id) return refs[env]!.product_id;

  const polar = await getPolarClient();
  const created = await polar.products.create({
    name: "Proxima AI Credits",
    description: "One-time AI image generation credits",
    metadata: { proxima_type: "ai_credits" },
    prices: [{ amountType: "custom", priceCurrency: "usd" }],
  });

  const merged: PolarAiCreditsRefs = {
    ...refs,
    [env]: { product_id: created.id, synced_at: new Date().toISOString() },
  };
  await saveAiCreditsRefs(merged);
  return created.id;
}
